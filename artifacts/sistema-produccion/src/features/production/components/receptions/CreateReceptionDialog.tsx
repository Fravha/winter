import { useState, useMemo } from 'react';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { grapeReceptionCreateSchema, GrapeReceptionCreateFormValues } from '../../schemas/production.schema';
import { useCreateGrapeReception, useCustomFieldDefinitions, useGrapeVarieties, useProducers, useProductionOrders } from '../../api/production.hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Trash2, AlertCircle, Info, ChevronRight, AlertTriangle } from 'lucide-react';
import { mapProductionError } from '../../api/production.error';
import { createOperationKey, canonicalPayloadHash } from '../../utils/production-payload';
import { toLocalDateTimeInput } from '../../utils/production-date';
import { ProductionOrderSelect } from '../shared/ProductionOrderSelect';
import { ArticuloSelect } from '@/features/inventory/components/SharedSelects';
import { useArticulos } from '@/features/articulos/api/articulos.hooks';
import { RECEPTION_UNITS, type CustomFieldDefinition } from '../../types/production.types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (receptionId: string) => void;
}

const itemSchema = z.object({
  grapeVarietyId: z.string().uuid('Variedad inválida'),
  articuloId: z.string().uuid('Artículo inválido'),
  quantity: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,3})?$/, 'Cantidad decimal inválida').refine(v => Number(v) > 0, 'Debe ser positiva'),
  unit: z.enum(RECEPTION_UNITS)
});

const formSchema = z.object({
  productionOrderId: z.string().uuid('Requerido'),
  producerId: z.string().optional().or(z.literal('')),
  receivedAt: z.string().min(1, 'Requerido'),
  status: z.enum(['ACCEPTED', 'ACCEPTED_WITH_OBSERVATIONS']),
  observations: z.string().max(2000, 'Máximo 2000 caracteres').optional().or(z.literal('')),
  items: z.array(itemSchema).min(1, 'Debe haber al menos un ítem'),
  customFields: z.array(z.object({
    definitionId: z.string().uuid(),
    value: z.union([z.string(), z.number(), z.boolean()])
  })).optional(),
}).superRefine((v, ctx) => {
  if (v.status === 'ACCEPTED_WITH_OBSERVATIONS' && (!v.observations || !v.observations.trim())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['observations'], message: 'Las observaciones son obligatorias' });
  }
});

function parseCustomFieldValue(definition: CustomFieldDefinition, rawValue: unknown) {
  const empty = rawValue === undefined || rawValue === null || rawValue === '';
  if (empty) return { empty: true } as const;

  switch (definition.dataType) {
    case 'INTEGER': {
      const text = String(rawValue).trim();
      if (!/^-?\d+$/.test(text)) return { error: 'Debe ser un número entero.' } as const;
      const value = Number(text);
      if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
        return { error: 'Debe ser un entero entre -2147483648 y 2147483647.' } as const;
      }
      return { value } as const;
    }
    case 'DECIMAL': {
      const value = String(rawValue).trim();
      if (!/^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(value)) {
        return { error: 'Debe ser un decimal con hasta 6 decimales.' } as const;
      }
      return { value } as const;
    }
    case 'BOOLEAN':
      return typeof rawValue === 'boolean'
        ? { value: rawValue } as const
        : { error: 'Debe ser un valor verdadero o falso.' } as const;
    case 'DATE': {
      const localDate = String(rawValue).trim();
      const parsed = /^\d{4}-\d{2}-\d{2}$/.test(localDate)
        ? new Date(`${localDate}T00:00:00`)
        : new Date(localDate);
      if (Number.isNaN(parsed.getTime())) return { error: 'Debe ser una fecha válida.' } as const;
      return { value: parsed.toISOString() } as const;
    }
    case 'SELECT': {
      const value = String(rawValue);
      if (!definition.options?.includes(value)) return { error: 'Selecciona una opción válida.' } as const;
      return { value } as const;
    }
    case 'TEXT':
      return { value: String(rawValue) } as const;
  }
}

export function CreateReceptionDialog({ open, onOpenChange, onSuccess }: Props) {
  const [step, setStep] = useState<'form' | 'summary'>('form');
  const [pendingPayload, setPendingPayload] = useState<GrapeReceptionCreateFormValues | null>(null);
  const [definitiveError, setDefinitiveError] = useState(false);

  const { data: customFields } = useCustomFieldDefinitions();
  const receptionFields = useMemo(() => {
    return (customFields?.data || []).filter(f => f.entityType === 'GRAPE_RECEPTION' && f.active).sort((a, b) => a.displayOrder - b.displayOrder);
  }, [customFields]);

  const { data: varieties } = useGrapeVarieties({ active: true, pageSize: 100 });
  const { data: producers } = useProducers({ active: true, pageSize: 100 });
  const { data: orders } = useProductionOrders({ page: 1, pageSize: 100 });
  const { data: articulos } = useArticulos({ page: 1, pageSize: 100, activo: true });
  const ordersMap = useMemo(() => new Map(orders?.data.map(order => [order.id, order.code])), [orders]);
  const producersMap = useMemo(() => new Map(producers?.data.map(producer => [producer.id, `${producer.code} · ${producer.name}`])), [producers]);
  const varietiesMap = useMemo(() => new Map(varieties?.data.map(variety => [variety.id, `${variety.code} · ${variety.name}`])), [varieties]);
  const articulosMap = useMemo(() => new Map(articulos?.items.map(articulo => [articulo.id, `${articulo.codigo} · ${articulo.nombre}`])), [articulos]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productionOrderId: '',
      producerId: '',
      receivedAt: toLocalDateTimeInput(),
      status: 'ACCEPTED',
      observations: '',
      items: [{ grapeVarietyId: '', articuloId: '', quantity: '', unit: 'KG' }],
      customFields: [],
    }
  });

  const { fields: items, append: appendItem, remove: removeItem } = useFieldArray({ control: form.control, name: 'items' });

  const handlePreview = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    
    const values = form.getValues();
    let isoDate;
    try {
      isoDate = new Date(values.receivedAt).toISOString();
    } catch {
      form.setError('receivedAt', { message: 'Fecha inválida' });
      return;
    }

    const businessPayload: any = {
      productionOrderId: values.productionOrderId,
      receivedAt: isoDate,
      status: values.status,
      items: values.items.map(item => ({ ...item })),
    };
    
    if (values.producerId && values.producerId !== 'none') {
      businessPayload.producerId = values.producerId;
    }
    if (values.observations && values.observations.trim()) {
      businessPayload.observations = values.observations.trim();
    }

    const customFieldValues: Array<{ definitionId: string; value: string | number | boolean }> = [];
    for (const def of receptionFields) {
      const rawValue = values.customFields?.find(c => c.definitionId === def.id)?.value;
      const parsed = parseCustomFieldValue(def, rawValue);
      if ('empty' in parsed) {
        if (!def.required) continue;
        toast({ title: "Campo requerido", description: `El campo ${def.label} es obligatorio`, variant: "destructive" });
        return;
      }
      if ('error' in parsed) {
        toast({ title: `Valor inválido: ${def.label}`, description: parsed.error, variant: "destructive" });
        return;
      }
      customFieldValues.push({ definitionId: def.id, value: parsed.value });
    }

    if (customFieldValues.length > 0) {
      businessPayload.customFields = customFieldValues;
    }

    // Generate keys
    const operationKey = createOperationKey();
    const requestHash = await canonicalPayloadHash(businessPayload);

    // Attach them so it passes the contractual schema
    businessPayload.operationKey = operationKey;
    businessPayload.requestHash = requestHash;

    // Parse strictly against contractual business schema
    const safePayload = grapeReceptionCreateSchema.parse(businessPayload);
    
    setPendingPayload(safePayload);
    setStep('summary');
    setDefinitiveError(false);
  };

  const createMutation = useCreateGrapeReception({
    onSuccess: (data) => {
      toast({
        title: "Recepción Registrada",
        description: `Se han generado ${data.batchIds.length} lote(s) de producción inicial(es).`,
      });
      onSuccess?.(data.reception.id);
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

  const status = form.watch('status');
  
  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (createMutation.isPending) return;
      onOpenChange(val);
      if (!val) { setTimeout(() => { setStep('form'); form.reset(); setPendingPayload(null); setDefinitiveError(false); }, 200); }
    }}>
      <DialogContent className="w-[calc(100%_-_2rem)] max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>{step === 'form' ? 'Nueva Recepción de Uva' : 'Confirmar Recepción'}</DialogTitle>
          <DialogDescription>
            {step === 'form' 
              ? 'Complete los datos de la recepción física.'
              : 'Revise los datos. Se generarán lotes de producción iniciales al confirmar.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-muted/10">
          {step === 'form' ? (
            <Form {...form}>
              <form className="p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Datos Principales</h3>
                    
                    <FormField control={form.control} name="productionOrderId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orden de Producción *</FormLabel>
                        <FormControl>
                          <ProductionOrderSelect value={field.value} onValueChange={field.onChange} disabled={createMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="producerId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Productor (Opcional)</FormLabel>
                        <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? '' : v)} disabled={createMutation.isPending}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Seleccione Productor" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Sin Productor (Propio)</SelectItem>
                            {producers?.data.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="receivedAt" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha y Hora *</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} disabled={createMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado *</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange} disabled={createMutation.isPending}>
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ACCEPTED">Aceptada</SelectItem>
                            <SelectItem value="ACCEPTED_WITH_OBSERVATIONS">Aceptada con Observaciones</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {status === 'ACCEPTED_WITH_OBSERVATIONS' && (
                      <FormField control={form.control} name="observations" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observaciones *</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Detalle el motivo de la observación..." disabled={createMutation.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                  </div>

                  {receptionFields.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Campos Personalizados</h3>
                      {receptionFields.map(def => (
                        <FormField key={def.id} control={form.control} name={`customFields`} render={({ field }) => {
                          const currentVal = field.value?.find((c: any) => c.definitionId === def.id)?.value ?? '';
                          const handleChange = (v: any) => {
                            const newFields = (field.value || []).filter((c: any) => c.definitionId !== def.id);
                            if (v !== '' && v !== undefined) newFields.push({ definitionId: def.id, value: v });
                            field.onChange(newFields);
                          };

                          return (
                            <FormItem className={def.dataType === 'BOOLEAN' ? "flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4" : ""}>
                              <div className="space-y-1 leading-none">
                                <FormLabel>{def.label} {def.required && '*'}</FormLabel>
                              </div>
                              <FormControl>
                                {def.dataType === 'TEXT' ? (
                                  <Input value={currentVal as string} onChange={e => handleChange(e.target.value)} disabled={createMutation.isPending} />
                                ) : def.dataType === 'INTEGER' ? (
                                  <Input type="number" step="1" value={currentVal as string} onChange={e => handleChange(e.target.value)} disabled={createMutation.isPending} />
                                ) : def.dataType === 'DECIMAL' ? (
                                  <Input type="number" step="0.01" value={currentVal as string} onChange={e => handleChange(e.target.value)} disabled={createMutation.isPending} />
                                ) : def.dataType === 'DATE' ? (
                                  <Input type="date" value={currentVal as string} onChange={e => handleChange(e.target.value)} disabled={createMutation.isPending} />
                                ) : def.dataType === 'BOOLEAN' ? (
                                  <Checkbox checked={!!currentVal} onCheckedChange={handleChange} disabled={createMutation.isPending} />
                                ) : def.dataType === 'SELECT' ? (
                                  <Select value={(currentVal as string) || "none"} onValueChange={v => handleChange(v === "none" ? '' : v)} disabled={createMutation.isPending}>
                                    <SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Seleccione...</SelectItem>
                                      {def.options?.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                ) : null}
                              </FormControl>
                            </FormItem>
                          );
                        }} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-sm font-medium text-muted-foreground">Ítems Recibidos (Uva)</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => appendItem({ grapeVarietyId: '', articuloId: '', quantity: '', unit: 'KG' })} disabled={createMutation.isPending}>
                      <Plus className="h-4 w-4 mr-2" /> Agregar Ítem
                    </Button>
                  </div>
                  
                  <div className="bg-card border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Variedad *</TableHead>
                          <TableHead>Artículo (Stock) *</TableHead>
                          <TableHead>Cantidad *</TableHead>
                          <TableHead>Unidad</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <FormField control={form.control} name={`items.${index}.grapeVarietyId`} render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <Select value={field.value} onValueChange={field.onChange} disabled={createMutation.isPending}>
                                    <FormControl><SelectTrigger className="w-full min-w-[150px]"><SelectValue placeholder="Variedad" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {varieties?.data.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </TableCell>
                            <TableCell>
                              <FormField control={form.control} name={`items.${index}.articuloId`} render={({ field }) => (
                                <FormItem className="min-w-[200px] space-y-0">
                                  <ArticuloSelect value={field.value} onChange={field.onChange} disabled={createMutation.isPending} />
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </TableCell>
                            <TableCell>
                              <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <FormControl>
                                    <Input placeholder="0.00" {...field} className="w-24 text-right" disabled={createMutation.isPending} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </TableCell>
                            <TableCell>
                              <FormField control={form.control} name={`items.${index}.unit`} render={({ field }) => (
                                <FormItem className="space-y-0">
                                  <Select value={field.value} onValueChange={field.onChange} disabled={createMutation.isPending}>
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
                              <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)} disabled={items.length === 1 || createMutation.isPending} className="text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {form.formState.errors.items && (
                    <p className="text-sm font-medium text-destructive">{form.formState.errors.items.root?.message || 'Error en ítems'}</p>
                  )}
                </div>
              </form>
            </Form>
          ) : pendingPayload && (
            <ScrollArea className="h-full p-6">
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-primary/10 border-primary/20 border p-4 rounded-lg flex gap-3 text-primary">
                  <Info className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold mb-1">Impacto de la Operación</p>
                    <p>Al confirmar esta recepción, el sistema generará automáticamente <strong>{pendingPayload.items.length} lote(s) de producción inicial(es)</strong> con los saldos especificados. Esta acción es auditable y generará trazabilidad.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border p-4 rounded-lg bg-card">
                  <div><span className="text-xs text-muted-foreground block">Fecha:</span> {new Date(pendingPayload.receivedAt).toLocaleString('es-BO')}</div>
                  <div><span className="text-xs text-muted-foreground block">Estado:</span> {pendingPayload.status === 'ACCEPTED' ? 'Aceptada' : 'Observada'}</div>
                   <div><span className="text-xs text-muted-foreground block">Orden:</span> {ordersMap.get(pendingPayload.productionOrderId) || 'No disponible'}</div>
                   <div><span className="text-xs text-muted-foreground block">Productor:</span> {pendingPayload.producerId ? producersMap.get(pendingPayload.producerId) || 'No disponible' : 'Sin productor seleccionado'}</div>
                  <div className="col-span-2"><span className="text-xs text-muted-foreground block">Observaciones:</span> {pendingPayload.observations || '-'}</div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Ítems a Ingresar</h4>
                  <div className="border rounded-md overflow-x-auto bg-card">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Variedad</TableHead>
                          <TableHead>Artículo</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingPayload.items.map((item, idx) => (
                          <TableRow key={idx}>
                             <TableCell>{varietiesMap.get(item.grapeVarietyId) || 'No disponible'}</TableCell>
                             <TableCell>{articulosMap.get(item.articuloId) || 'No disponible'}</TableCell>
                            <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {pendingPayload.customFields && pendingPayload.customFields.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Atributos</h4>
                    <div className="grid grid-cols-2 gap-2 border p-3 rounded-lg bg-card">
                      {pendingPayload.customFields.map((cf: any, idx) => {
                        const def = receptionFields.find(d => d.id === cf.definitionId);
                        let val = cf.value;
                        if (def?.dataType === 'BOOLEAN') val = val ? 'Sí' : 'No';
                        return (
                          <div key={idx}>
                            <span className="text-xs text-muted-foreground block">{def?.label}</span>
                            <span className="text-sm">{String(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {createMutation.error && (
                  <div className={`p-4 rounded-lg flex items-start gap-3 border ${definitiveError ? 'bg-warning/10 text-warning-foreground border-warning/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                    {definitiveError ? <AlertTriangle className="h-5 w-5 shrink-0 text-warning" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                    <div>
                      <p className="font-semibold text-sm">{definitiveError ? 'Error de Validación / Negocio' : 'Error de Conexión'}</p>
                      <p className="text-sm mt-1">{mapProductionError(createMutation.error).userMessage}</p>
                      <p className="text-xs font-mono mt-1 opacity-70">Req: {mapProductionError(createMutation.error).requestId}</p>
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
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar y Guardar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
