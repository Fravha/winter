import { useState, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2, AlertCircle, Info, ChevronRight, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';

import { useCreateTransformation, useProductionOrders, useTransformationOrders, useProductionWorks, useProductionBatches, useWorkTypes } from '../../api/production.hooks';
import { useAuth } from '@/auth/AuthContext';
import { useArticulos } from '@/features/articulos/api/articulos.hooks';
import { mapProductionError } from '../../api/production.error';
import { createOperationKey, canonicalPayloadHash } from '../../utils/production-payload';
import { toLocalDateTimeInput } from '../../utils/production-date';

import { ProductionOrderSelect } from '../shared/ProductionOrderSelect';
import { TransformationOrderSelect, WorkSelect, BatchSelect } from '../shared/ProductionSharedSelects';
import { ArticuloSelect } from '@/features/inventory/components/SharedSelects';
import { RECEPTION_UNITS } from '../../types/production.types';
import { transformationCreateSchema, TransformationCreateFormValues } from '../../schemas/production.schema';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (id: string) => void;
}

const formSchema = z.object({
  productionOrderId: z.string().uuid('Requerido'),
  transformationOrderId: z.string().optional().or(z.literal('none')).or(z.literal('')),
  productionWorkId: z.string().optional().or(z.literal('none')).or(z.literal('')),
  performedAt: z.string().min(1, 'Requerido'),
  observations: z.string().max(2000, 'Máximo 2000 caracteres').optional().or(z.literal('')),
  inputs: z.array(z.object({
    productionBatchId: z.string().uuid('Requerido'),
    quantity: z.string().regex(/^(?:0|[1-9]\d{0,12})(?:\.\d{1,3})?$/, 'Decimal inválido').refine(v => Number(v) > 0, 'Mayor a 0'),
  })).min(1, 'Se requiere al menos un input'),
  outputs: z.array(z.object({
    articuloId: z.string().uuid('Requerido'),
    quantity: z.string().regex(/^(?:0|[1-9]\d{0,12})(?:\.\d{1,3})?$/, 'Decimal inválido').refine(v => Number(v) > 0, 'Mayor a 0'),
    unit: z.enum(RECEPTION_UNITS),
    observations: z.string().max(2000).optional().or(z.literal('')),
  })).min(1, 'Se requiere al menos un output'),
  losses: z.array(z.object({
    productionBatchId: z.string().optional().or(z.literal('none')).or(z.literal('')),
    quantity: z.string().regex(/^(?:0|[1-9]\d{0,12})(?:\.\d{1,3})?$/, 'Decimal inválido').refine(v => Number(v) > 0, 'Mayor a 0'),
    unit: z.enum(RECEPTION_UNITS),
    observations: z.string().max(2000).optional().or(z.literal('')),
  })).optional()
}).superRefine((v, ctx) => {
  const inputBatches = v.inputs.map(i => i.productionBatchId).filter(b => b !== '' && b !== 'none');
  if (new Set(inputBatches).size !== inputBatches.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['inputs'], message: 'No se puede duplicar el mismo lote de entrada' });
  }
});

export function CreateTransformationDialog({ open, onOpenChange, onSuccess }: Props) {
  const { can } = useAuth();
  const canCreateLoss = can('production:loss_create');

  const [step, setStep] = useState<'form' | 'summary'>('form');
  const [pendingPayload, setPendingPayload] = useState<TransformationCreateFormValues | null>(null);
  const [definitiveError, setDefinitiveError] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productionOrderId: '',
      transformationOrderId: '',
      productionWorkId: '',
      performedAt: toLocalDateTimeInput(),
      observations: '',
      inputs: [{ productionBatchId: '', quantity: '' }],
      outputs: [{ articuloId: '', quantity: '', unit: 'KG', observations: '' }],
      losses: [],
    }
  });

  const { fields: inputs, append: appendInput, remove: removeInput } = useFieldArray({ control: form.control, name: 'inputs' });
  const { fields: outputs, append: appendOutput, remove: removeOutput } = useFieldArray({ control: form.control, name: 'outputs' });
  const { fields: losses, append: appendLoss, remove: removeLoss } = useFieldArray({ control: form.control, name: 'losses' });

  const watchPO = form.watch('productionOrderId');

  useEffect(() => {
    if (watchPO && open && step === 'form') {
      form.setValue('transformationOrderId', '');
      form.setValue('productionWorkId', '');
      form.setValue('inputs', [{ productionBatchId: '', quantity: '' }]);
    }
  }, [watchPO, open]); // Removed step from deps to avoid weird cycles

  const { data: orders } = useProductionOrders({ pageSize: 100 });
  const { data: tOrders } = useTransformationOrders({ pageSize: 100 });
  const { data: works } = useProductionWorks({ pageSize: 100 });
  const { data: batches } = useProductionBatches({ pageSize: 100, productionOrderId: watchPO || undefined });
  const { data: workTypes } = useWorkTypes({ pageSize: 100 });
  const { data: articulos } = useArticulos({ page: 1, pageSize: 100, activo: true });

  const ordersMap = useMemo(() => new Map(orders?.data.map(o => [o.id, o.code])), [orders]);
  const tOrdersMap = useMemo(() => new Map(tOrders?.data.map(o => [o.id, o.code])), [tOrders]);
  const worksMap = useMemo(() => new Map(works?.data.map(w => [w.id, w])), [works]);
  const workTypesMap = useMemo(() => new Map(workTypes?.data.map(w => [w.id, `${w.code} · ${w.name}`])), [workTypes]);
  const batchesMap = useMemo(() => new Map(batches?.data.map(b => [b.id, b])), [batches]);
  const articulosMap = useMemo(() => new Map(articulos?.items.map(a => [a.id, `${a.codigo} · ${a.nombre}`])), [articulos]);

  const handlePreview = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    
    const values = form.getValues();
    let isoDate;
    try {
      isoDate = new Date(values.performedAt).toISOString();
    } catch {
      form.setError('performedAt', { message: 'Fecha inválida' });
      return;
    }

    const businessPayload: any = {
      productionOrderId: values.productionOrderId,
      performedAt: isoDate,
      inputs: values.inputs.map(i => ({ productionBatchId: i.productionBatchId, quantity: i.quantity })),
      outputs: values.outputs.map(o => ({ 
        articuloId: o.articuloId, 
        quantity: o.quantity, 
        unit: o.unit,
        ...(o.observations?.trim() ? { observations: o.observations.trim() } : {})
      })),
    };
    
    if (values.transformationOrderId && values.transformationOrderId !== 'none') {
      businessPayload.transformationOrderId = values.transformationOrderId;
    }
    if (values.productionWorkId && values.productionWorkId !== 'none') {
      businessPayload.productionWorkId = values.productionWorkId;
    }
    if (values.observations && values.observations.trim()) {
      businessPayload.observations = values.observations.trim();
    }
    if (canCreateLoss && values.losses && values.losses.length > 0) {
      businessPayload.losses = values.losses.map(l => ({
        ...(l.productionBatchId && l.productionBatchId !== 'none' ? { productionBatchId: l.productionBatchId } : {}),
        quantity: l.quantity,
        unit: l.unit,
        ...(l.observations?.trim() ? { observations: l.observations.trim() } : {})
      }));
    }

    const operationKey = createOperationKey();
    const requestHash = await canonicalPayloadHash(businessPayload);

    businessPayload.operationKey = operationKey;
    businessPayload.requestHash = requestHash;

    try {
      const safePayload = transformationCreateSchema.parse(businessPayload);
      setPendingPayload(safePayload);
      setStep('summary');
      setDefinitiveError(false);
    } catch (err: any) {
      toast({ title: 'Error de validación', description: 'Los datos no cumplen con el formato.', variant: 'destructive' });
      console.error(err);
    }
  };

  const createMutation = useCreateTransformation({
    onSuccess: (data) => {
      toast({
        title: "Transformación Registrada",
        description: `Se han generado ${data.outputs.length} lote(s) de salida.`,
      });
      onSuccess?.(data.id);
    },
    onError: (err: any) => {
      const mapped = mapProductionError(err);
      if (mapped.status !== 0) {
        setDefinitiveError(true);
      }
    }
  });

  const handleSubmit = () => {
    if (!pendingPayload || definitiveError) return;
    createMutation.mutate(pendingPayload);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (createMutation.isPending) return;
      onOpenChange(val);
      if (!val) { setTimeout(() => { setStep('form'); form.reset(); setPendingPayload(null); setDefinitiveError(false); }, 200); }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>{step === 'form' ? 'Nueva Transformación' : 'Confirmar Transformación'}</DialogTitle>
          <DialogDescription>
            {step === 'form' 
              ? 'Consuma lotes para generar nuevos productos o subproductos.'
              : 'Revise los datos. La operación es atómica e impactará los saldos y generará nuevos lotes de salida.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-muted/10">
          {step === 'form' ? (
            <Form {...form}>
              <form className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Contexto</h3>
                    
                    <FormField control={form.control} name="productionOrderId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orden de Producción *</FormLabel>
                        <FormControl>
                          <ProductionOrderSelect value={field.value} onValueChange={field.onChange} disabled={createMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="transformationOrderId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orden de Transformación</FormLabel>
                        <FormControl>
                          <TransformationOrderSelect value={field.value} onValueChange={field.onChange} productionOrderId={watchPO} disabled={!watchPO || createMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="productionWorkId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trabajo Asignado</FormLabel>
                        <FormControl>
                          <WorkSelect value={field.value} onValueChange={field.onChange} productionOrderId={watchPO} disabled={!watchPO || createMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="performedAt" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Operación *</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} disabled={createMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Detalles</h3>
                    <FormField control={form.control} name="observations" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observaciones</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Detalles de la transformación..." disabled={createMutation.isPending} className="h-32" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Inputs (Consumo)</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendInput({ productionBatchId: '', quantity: '' })} disabled={!watchPO || createMutation.isPending}>
                      <Plus className="h-4 w-4 mr-2" /> Agregar Lote
                    </Button>
                  </div>
                  
                  {/* Mobile Input Cards */}
                  <div className="md:hidden space-y-4">
                    {inputs.map((item, index) => (
                      <div key={item.id} className="bg-card border rounded-md p-4 space-y-3 relative">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:bg-destructive/10" onClick={() => removeInput(index)} disabled={inputs.length === 1 || createMutation.isPending}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        
                        <FormField control={form.control} name={`inputs.${index}.productionBatchId`} render={({ field }) => (
                          <FormItem className="pr-8">
                            <FormLabel className="text-xs">Lote de Entrada *</FormLabel>
                            <FormControl>
                              <BatchSelect value={field.value} onValueChange={field.onChange} productionOrderId={watchPO} disabled={!watchPO || createMutation.isPending} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-xs font-medium block mb-1.5">Saldo Disp.</span>
                            <div className="text-sm border rounded-md px-3 py-2 bg-muted/30">
                              {(() => {
                                const bId = form.watch(`inputs.${index}.productionBatchId`);
                                const b = bId && bId !== 'none' ? batchesMap.get(bId) : null;
                                return b ? `${b.balance.available} ${b.unit}` : '-';
                              })()}
                            </div>
                          </div>
                          <FormField control={form.control} name={`inputs.${index}.quantity`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Cantidad *</FormLabel>
                              <FormControl>
                                <Input placeholder="0.00" {...field} className="text-right" disabled={!watchPO || createMutation.isPending} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Input Table */}
                  <div className="hidden md:block bg-card border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Lote de Entrada *</TableHead>
                          <TableHead>Artículo</TableHead>
                          <TableHead>Saldo Disp.</TableHead>
                          <TableHead>Cantidad *</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inputs.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <FormField control={form.control} name={`inputs.${index}.productionBatchId`} render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <FormControl>
                                    <BatchSelect value={field.value} onValueChange={field.onChange} productionOrderId={watchPO} disabled={!watchPO || createMutation.isPending} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const bId = form.watch(`inputs.${index}.productionBatchId`);
                                const b = bId && bId !== 'none' ? batchesMap.get(bId) : null;
                                return b ? articulosMap.get(b.articuloId) || '-' : '-';
                              })()}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const bId = form.watch(`inputs.${index}.productionBatchId`);
                                const b = bId && bId !== 'none' ? batchesMap.get(bId) : null;
                                return b ? `${b.balance.available} ${b.unit}` : '-';
                              })()}
                            </TableCell>
                            <TableCell>
                              <FormField control={form.control} name={`inputs.${index}.quantity`} render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <FormControl>
                                    <Input placeholder="0.00" {...field} className="w-24 text-right" disabled={!watchPO || createMutation.isPending} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </TableCell>
                            <TableCell>
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeInput(index)} disabled={inputs.length === 1 || createMutation.isPending} className="text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {form.formState.errors.inputs && <p className="text-sm font-medium text-destructive">{form.formState.errors.inputs.root?.message || 'Error en inputs'}</p>}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Outputs (Generación)</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendOutput({ articuloId: '', quantity: '', unit: 'L', observations: '' })} disabled={!watchPO || createMutation.isPending}>
                      <Plus className="h-4 w-4 mr-2" /> Agregar Salida
                    </Button>
                  </div>
                  
                  {/* Mobile Output Cards */}
                  <div className="md:hidden space-y-4">
                    {outputs.map((item, index) => (
                      <div key={item.id} className="bg-card border rounded-md p-4 space-y-3 relative">
                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:bg-destructive/10" onClick={() => removeOutput(index)} disabled={outputs.length === 1 || createMutation.isPending}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        
                        <FormField control={form.control} name={`outputs.${index}.articuloId`} render={({ field }) => (
                          <FormItem className="pr-8">
                            <FormLabel className="text-xs">Artículo a Generar *</FormLabel>
                            <FormControl>
                              <ArticuloSelect value={field.value} onChange={field.onChange} disabled={!watchPO || createMutation.isPending} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        
                        <div className="grid grid-cols-2 gap-3">
                          <FormField control={form.control} name={`outputs.${index}.quantity`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Cantidad *</FormLabel>
                              <FormControl>
                                <Input placeholder="0.00" {...field} className="text-right" disabled={!watchPO || createMutation.isPending} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`outputs.${index}.unit`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Unidad *</FormLabel>
                              <Select value={field.value} onValueChange={field.onChange} disabled={!watchPO || createMutation.isPending}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {RECEPTION_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={form.control} name={`outputs.${index}.observations`} render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Observaciones</FormLabel>
                            <FormControl>
                              <Input placeholder="Opcional..." {...field} disabled={!watchPO || createMutation.isPending} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    ))}
                  </div>

                  {/* Desktop Output Table */}
                  <div className="hidden md:block bg-card border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Artículo a Generar *</TableHead>
                          <TableHead>Cantidad *</TableHead>
                          <TableHead>Unidad *</TableHead>
                          <TableHead>Observaciones</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outputs.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <FormField control={form.control} name={`outputs.${index}.articuloId`} render={({ field }) => (
                                <FormItem className="min-w-[200px] space-y-0">
                                  <ArticuloSelect value={field.value} onChange={field.onChange} disabled={!watchPO || createMutation.isPending} />
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </TableCell>
                            <TableCell>
                              <FormField control={form.control} name={`outputs.${index}.quantity`} render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <FormControl>
                                    <Input placeholder="0.00" {...field} className="w-24 text-right" disabled={!watchPO || createMutation.isPending} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </TableCell>
                            <TableCell>
                              <FormField control={form.control} name={`outputs.${index}.unit`} render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <Select value={field.value} onValueChange={field.onChange} disabled={!watchPO || createMutation.isPending}>
                                    <FormControl><SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {RECEPTION_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </TableCell>
                            <TableCell>
                              <FormField control={form.control} name={`outputs.${index}.observations`} render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <FormControl>
                                    <Input placeholder="Opcional..." {...field} disabled={!watchPO || createMutation.isPending} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </TableCell>
                            <TableCell>
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeOutput(index)} disabled={outputs.length === 1 || createMutation.isPending} className="text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {canCreateLoss && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="text-sm font-medium text-muted-foreground">Pérdidas (Opcional)</h3>
                      <Button type="button" variant="outline" size="sm" onClick={() => appendLoss({ productionBatchId: '', quantity: '', unit: 'KG', observations: '' })} disabled={!watchPO || createMutation.isPending}>
                        <Plus className="h-4 w-4 mr-2" /> Registrar Pérdida
                      </Button>
                    </div>
                    
                    {losses.length > 0 && (
                      <>
                        {/* Mobile Loss Cards */}
                        <div className="md:hidden space-y-4">
                          {losses.map((item, index) => (
                            <div key={item.id} className="bg-card border rounded-md p-4 space-y-3 relative">
                              <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:bg-destructive/10" onClick={() => removeLoss(index)} disabled={createMutation.isPending}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              
                              <FormField control={form.control} name={`losses.${index}.productionBatchId`} render={({ field }) => (
                                <FormItem className="pr-8">
                                  <FormLabel className="text-xs">Lote Afectado (Opcional)</FormLabel>
                                  <FormControl>
                                    <BatchSelect value={field.value} onValueChange={field.onChange} productionOrderId={watchPO} disabled={!watchPO || createMutation.isPending} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              
                              <div className="grid grid-cols-2 gap-3">
                                <FormField control={form.control} name={`losses.${index}.quantity`} render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Cantidad *</FormLabel>
                                    <FormControl>
                                      <Input placeholder="0.00" {...field} className="text-right" disabled={!watchPO || createMutation.isPending} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={form.control} name={`losses.${index}.unit`} render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-xs">Unidad *</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange} disabled={!watchPO || createMutation.isPending}>
                                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                      <SelectContent>
                                        {RECEPTION_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                              </div>
                              <FormField control={form.control} name={`losses.${index}.observations`} render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs">Observaciones</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Opcional..." {...field} disabled={!watchPO || createMutation.isPending} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </div>
                          ))}
                        </div>

                        {/* Desktop Loss Table */}
                        <div className="hidden md:block bg-card border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader className="bg-muted/50">
                              <TableRow>
                                <TableHead>Lote Afectado (Opcional)</TableHead>
                                <TableHead>Cantidad *</TableHead>
                                <TableHead>Unidad *</TableHead>
                                <TableHead>Observaciones</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {losses.map((item, index) => (
                                <TableRow key={item.id}>
                                  <TableCell>
                                    <FormField control={form.control} name={`losses.${index}.productionBatchId`} render={({ field }) => (
                                      <FormItem className="space-y-0">
                                        <FormControl>
                                          <BatchSelect value={field.value} onValueChange={field.onChange} productionOrderId={watchPO} disabled={!watchPO || createMutation.isPending} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )} />
                                  </TableCell>
                                  <TableCell>
                                    <FormField control={form.control} name={`losses.${index}.quantity`} render={({ field }) => (
                                      <FormItem className="space-y-0">
                                        <FormControl>
                                          <Input placeholder="0.00" {...field} className="w-24 text-right" disabled={!watchPO || createMutation.isPending} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )} />
                                  </TableCell>
                                  <TableCell>
                                    <FormField control={form.control} name={`losses.${index}.unit`} render={({ field }) => (
                                      <FormItem className="space-y-0">
                                        <Select value={field.value} onValueChange={field.onChange} disabled={!watchPO || createMutation.isPending}>
                                          <FormControl><SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger></FormControl>
                                          <SelectContent>
                                            {RECEPTION_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )} />
                                  </TableCell>
                                  <TableCell>
                                    <FormField control={form.control} name={`losses.${index}.observations`} render={({ field }) => (
                                      <FormItem className="space-y-0">
                                        <FormControl>
                                          <Input placeholder="Opcional..." {...field} disabled={!watchPO || createMutation.isPending} />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )} />
                                  </TableCell>
                                  <TableCell>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeLoss(index)} disabled={createMutation.isPending} className="text-destructive hover:bg-destructive/10">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </form>
            </Form>
          ) : pendingPayload && (
            <ScrollArea className="h-full p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-primary/10 border-primary/20 border p-4 rounded-lg flex gap-3 text-primary">
                  <Info className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold mb-1">Impacto de la Operación</p>
                    <p>Al confirmar, se consumirán los saldos de los lotes de entrada ({pendingPayload.inputs.length}), se generarán nuevos lotes de salida ({pendingPayload.outputs.length}) y registrarán las pérdidas especificadas ({pendingPayload.losses?.length || 0}). Esta operación es atómica y no se puede deshacer.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border p-4 rounded-lg bg-card">
                  <div className="col-span-2 md:col-span-1"><span className="text-xs text-muted-foreground block">Fecha:</span> {new Date(pendingPayload.performedAt).toLocaleString('es-BO')}</div>
                  <div className="col-span-2 md:col-span-1"><span className="text-xs text-muted-foreground block">Orden Producción:</span> {ordersMap.get(pendingPayload.productionOrderId) || 'No disponible'}</div>
                  <div className="col-span-2 md:col-span-1"><span className="text-xs text-muted-foreground block">Orden Transf.:</span> {pendingPayload.transformationOrderId ? tOrdersMap.get(pendingPayload.transformationOrderId) || 'No disponible' : 'No asociada'}</div>
                  <div className="col-span-2 md:col-span-1"><span className="text-xs text-muted-foreground block">Trabajo:</span> {(() => {
                    if (!pendingPayload.productionWorkId) return 'No asociado';
                    const work = worksMap.get(pendingPayload.productionWorkId);
                    if (!work) return 'No disponible';
                    return `${workTypesMap.get(work.workTypeId) || 'Tipo no disponible'} · ${new Date(work.performedAt).toLocaleDateString('es-BO')} · ${ordersMap.get(work.productionOrderId) || 'Orden no disponible'}`;
                  })()}</div>
                  {pendingPayload.observations && <div className="col-span-full"><span className="text-xs text-muted-foreground block">Observaciones:</span> {pendingPayload.observations}</div>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center">Inputs <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">{pendingPayload.inputs.length}</span></h4>
                    <div className="border rounded-md overflow-hidden bg-card">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Lote</TableHead>
                            <TableHead>Artículo</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingPayload.inputs.map((item, idx) => {
                            const batch = batchesMap.get(item.productionBatchId);
                            const articleName = batch ? articulosMap.get(batch.articuloId) : null;
                            return (
                              <TableRow key={idx}>
                                <TableCell>{batch?.code || 'Lote'}</TableCell>
                                <TableCell>{articleName || '-'}</TableCell>
                                <TableCell className="text-right font-medium">{item.quantity} {batch?.unit || ''}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center">Outputs <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">{pendingPayload.outputs.length}</span></h4>
                    <div className="border rounded-md overflow-hidden bg-card">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Artículo</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingPayload.outputs.map((item, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{articulosMap.get(item.articuloId) || 'Artículo'}</TableCell>
                              <TableCell className="text-right font-medium">{item.quantity} {item.unit}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>

                {pendingPayload.losses && pendingPayload.losses.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center">Pérdidas <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">{pendingPayload.losses.length}</span></h4>
                    <div className="border rounded-md overflow-hidden bg-card">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Lote</TableHead>
                            <TableHead>Artículo</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pendingPayload.losses.map((item, idx) => {
                            const batch = item.productionBatchId ? batchesMap.get(item.productionBatchId) : null;
                            const articleName = batch ? articulosMap.get(batch.articuloId) : null;
                            return (
                              <TableRow key={idx}>
                                <TableCell>{batch?.code || (item.productionBatchId ? 'Lote' : 'General')}</TableCell>
                                <TableCell>{articleName || '-'}</TableCell>
                                <TableCell className="text-right font-medium">{item.quantity} {item.unit}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {createMutation.error && (
                  <div className={`p-4 rounded-lg flex items-start gap-3 border ${definitiveError ? 'bg-warning/10 text-warning-foreground border-warning/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                    {definitiveError ? <AlertTriangle className="h-5 w-5 shrink-0 text-warning" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                    <div>
                      <p className="font-semibold text-sm">{definitiveError ? 'Error de Validación / Negocio' : 'Error de Conexión'}</p>
                      <p className="text-sm mt-1">{mapProductionError(createMutation.error).userMessage}</p>
                      <p className="text-xs font-mono mt-1 opacity-70">Código: {mapProductionError(createMutation.error).code}</p>
                      {mapProductionError(createMutation.error).requestId && <p className="text-xs font-mono mt-1 opacity-70">Req: {mapProductionError(createMutation.error).requestId}</p>}
                      {definitiveError && (
                        <p className="text-sm mt-3 font-medium">Debe modificar los datos para reintentar la operación.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-card">
          {step === 'form' ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="button" onClick={handlePreview}>Siguiente <ChevronRight className="h-4 w-4 ml-2" /></Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => { setStep('form'); setPendingPayload(null); setDefinitiveError(false); }} disabled={createMutation.isPending}>
                Volver
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={createMutation.isPending || definitiveError} className="min-w-[120px]">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Operación'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
