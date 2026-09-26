import { useState, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productionWorkCreateSchema } from '../../schemas/production.schema';
import { useCreateProductionWork, useProductionOrders, useTransformationOrders, useWorkTypes, useProductionBatches, useProductionContainers, useParticipants } from '../../api/production.hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2, AlertCircle, Info, ChevronRight, AlertTriangle } from 'lucide-react';
import { mapProductionError } from '../../api/production.error';
import { toLocalDateTimeInput } from '../../utils/production-date';
import { ProductionOrderSelect } from '../shared/ProductionOrderSelect';
import { TransformationOrderSelect, WorkTypeSelect, BatchSelect, ContainerSelect, ParticipantSelect } from '../shared/ProductionSharedSelects';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import type { ProductionWorkCreateInput } from '../../types/production.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (workId: string) => void;
}

const formSchema = z.object({
  productionOrderId: z.string().uuid('Requerido'),
  transformationOrderId: z.string().optional().or(z.literal('')),
  workTypeId: z.string().uuid('Requerido'),
  performedAt: z.string().min(1, 'Requerido'),
  observations: z.string().max(2000, 'Máximo 2000 caracteres').optional().or(z.literal('')),
  batchRefs: z.array(z.object({ id: z.string().uuid('Requerido') })),
  containerRefs: z.array(z.object({ id: z.string().uuid('Requerido') })),
  participants: z.array(z.object({ participantId: z.string().uuid('Requerido'), role: z.string().max(100).optional().or(z.literal('')) })),
});

export function CreateWorkDialog({ open, onOpenChange, onSuccess }: Props) {
  const [step, setStep] = useState<'form' | 'summary'>('form');
  const [pendingPayload, setPendingPayload] = useState<ProductionWorkCreateInput | null>(null);
  const [definitiveError, setDefinitiveError] = useState(false);

  const { data: workTypes } = useWorkTypes({ pageSize: 100 });
  const { data: orders } = useProductionOrders({ pageSize: 100 });
  const { data: transformOrders } = useTransformationOrders({ pageSize: 100 });
  const { data: batches } = useProductionBatches({ pageSize: 100 });
  const { data: containers } = useProductionContainers();
  const { data: participantsList } = useParticipants({ pageSize: 100 });

  const typesMap = useMemo(() => new Map(workTypes?.data.map(t => [t.id, t.name])), [workTypes]);
  const ordersMap = useMemo(() => new Map(orders?.data.map(o => [o.id, o.code])), [orders]);
  const transformMap = useMemo(() => new Map(transformOrders?.data.map(o => [o.id, o.code])), [transformOrders]);
  const batchesMap = useMemo(() => new Map(batches?.data.map(b => [b.id, b.code])), [batches]);
  const containersMap = useMemo(() => new Map(containers?.data.map(c => [c.id, c.code])), [containers]);
  const participantsMap = useMemo(() => new Map(participantsList?.data.map(p => [p.id, p.name])), [participantsList]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productionOrderId: '',
      transformationOrderId: '',
      workTypeId: '',
      performedAt: toLocalDateTimeInput(),
      observations: '',
      batchRefs: [],
      containerRefs: [],
      participants: [],
    }
  });

  const { fields: batchFields, append: appendBatch, remove: removeBatch } = useFieldArray({ control: form.control, name: 'batchRefs' });
  const { fields: containerFields, append: appendContainer, remove: removeContainer } = useFieldArray({ control: form.control, name: 'containerRefs' });
  const { fields: participantFields, append: appendParticipant, remove: removeParticipant } = useFieldArray({ control: form.control, name: 'participants' });

  const productionOrderIdWatch = form.watch('productionOrderId');

  useEffect(() => {
    form.setValue('transformationOrderId', '');
    form.setValue('batchRefs', []);
  }, [productionOrderIdWatch, form]);

  const handlePreview = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    
    const values = form.getValues();
    
    const batchIds = values.batchRefs.map(r => r.id);
    if (new Set(batchIds).size !== batchIds.length) {
      toast({ title: "Validación", description: "Hay lotes duplicados", variant: "destructive" });
      return;
    }
    const containerIds = values.containerRefs.map(r => r.id);
    if (new Set(containerIds).size !== containerIds.length) {
      toast({ title: "Validación", description: "Hay contenedores duplicados", variant: "destructive" });
      return;
    }
    const participantIds = values.participants.map(p => p.participantId);
    if (new Set(participantIds).size !== participantIds.length) {
      toast({ title: "Validación", description: "Hay participantes duplicados", variant: "destructive" });
      return;
    }

    let isoDate;
    try {
      isoDate = new Date(values.performedAt).toISOString();
    } catch {
      form.setError('performedAt', { message: 'Fecha inválida' });
      return;
    }

    const businessPayload: any = {
      productionOrderId: values.productionOrderId,
      workTypeId: values.workTypeId,
      performedAt: isoDate,
      batchIds,
      containerIds,
      participants: values.participants.map(p => ({ participantId: p.participantId, role: p.role?.trim() || undefined }))
    };
    
    if (values.transformationOrderId && values.transformationOrderId !== 'none') {
      businessPayload.transformationOrderId = values.transformationOrderId;
    }
    if (values.observations && values.observations.trim()) {
      businessPayload.observations = values.observations.trim();
    }

    // validate against strict schema
    const safePayload = productionWorkCreateSchema.parse(businessPayload);
    
    setPendingPayload(safePayload as ProductionWorkCreateInput);
    setStep('summary');
    setDefinitiveError(false);
  };

  const createMutation = useCreateProductionWork({
    onSuccess: (data) => {
      toast({
        title: "Trabajo Registrado",
        description: "El registro de trabajo se guardó correctamente.",
      });
      onSuccess?.(data.id);
      onOpenChange(false);
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
      <DialogContent className="w-[calc(100%_-_2rem)] max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>{step === 'form' ? 'Registrar Nuevo Trabajo' : 'Confirmar Trabajo'}</DialogTitle>
          <DialogDescription>
            {step === 'form' 
              ? 'Complete los datos del trabajo ejecutado.'
              : 'Revise los datos. Esta acción quedará registrada en el historial.'}
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
                        <FormLabel>Orden de Producción Principal *</FormLabel>
                        <FormControl>
                          <ProductionOrderSelect value={field.value} onValueChange={field.onChange} disabled={createMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="transformationOrderId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Orden de Transformación (Opcional)</FormLabel>
                        <FormControl>
                          <TransformationOrderSelect value={field.value} onValueChange={field.onChange} disabled={createMutation.isPending || !productionOrderIdWatch} productionOrderId={productionOrderIdWatch} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="workTypeId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Trabajo *</FormLabel>
                        <FormControl>
                          <WorkTypeSelect value={field.value} onValueChange={field.onChange} disabled={createMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="performedAt" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha y Hora Ejecución *</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} disabled={createMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="observations" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observaciones</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Detalle adicional..." disabled={createMutation.isPending} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Lotes Involucrados</h3>
                        <Button type="button" variant="outline" size="sm" onClick={() => appendBatch({ id: '' })} disabled={createMutation.isPending || !productionOrderIdWatch} title={!productionOrderIdWatch ? "Seleccione una orden primero" : ""}>
                          <Plus className="h-4 w-4 mr-2" /> Agregar
                        </Button>
                      </div>
                      {batchFields.map((item, index) => (
                        <div key={item.id} className="flex items-start gap-2">
                          <div className="flex-1">
                            <FormField control={form.control} name={`batchRefs.${index}.id`} render={({ field }) => (
                              <BatchSelect value={field.value} onValueChange={field.onChange} disabled={createMutation.isPending} productionOrderId={productionOrderIdWatch} />
                            )} />
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeBatch(index)} disabled={createMutation.isPending} className="text-destructive hover:bg-destructive/10 shrink-0">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {batchFields.length === 0 && <p className="text-xs text-muted-foreground italic">Ningún lote asociado.</p>}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Contenedores Involucrados</h3>
                        <Button type="button" variant="outline" size="sm" onClick={() => appendContainer({ id: '' })} disabled={createMutation.isPending}>
                          <Plus className="h-4 w-4 mr-2" /> Agregar
                        </Button>
                      </div>
                      {containerFields.map((item, index) => (
                        <div key={item.id} className="flex items-start gap-2">
                          <div className="flex-1">
                            <FormField control={form.control} name={`containerRefs.${index}.id`} render={({ field }) => (
                              <ContainerSelect value={field.value} onValueChange={field.onChange} disabled={createMutation.isPending} />
                            )} />
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeContainer(index)} disabled={createMutation.isPending} className="text-destructive hover:bg-destructive/10 shrink-0">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {containerFields.length === 0 && <p className="text-xs text-muted-foreground italic">Ningún contenedor asociado.</p>}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="text-sm font-medium text-muted-foreground">Participantes</h3>
                        <Button type="button" variant="outline" size="sm" onClick={() => appendParticipant({ participantId: '', role: '' })} disabled={createMutation.isPending}>
                          <Plus className="h-4 w-4 mr-2" /> Agregar
                        </Button>
                      </div>
                      {participantFields.map((item, index) => (
                        <div key={item.id} className="flex items-start gap-2">
                          <div className="flex-1 space-y-2">
                            <FormField control={form.control} name={`participants.${index}.participantId`} render={({ field }) => (
                              <ParticipantSelect value={field.value} onValueChange={field.onChange} disabled={createMutation.isPending} />
                            )} />
                            <FormField control={form.control} name={`participants.${index}.role`} render={({ field }) => (
                              <Input {...field} placeholder="Rol / Tarea (Opcional)" disabled={createMutation.isPending} className="h-8 text-xs" />
                            )} />
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeParticipant(index)} disabled={createMutation.isPending} className="text-destructive hover:bg-destructive/10 shrink-0 mt-1">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {participantFields.length === 0 && <p className="text-xs text-muted-foreground italic">Ningún participante asociado.</p>}
                    </div>

                  </div>
                </div>
              </form>
            </Form>
          ) : pendingPayload && (
            <ScrollArea className="h-full p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="bg-primary/10 border-primary/20 border p-4 rounded-lg flex gap-3 text-primary">
                  <Info className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold mb-1">Confirmación de Trabajo</p>
                    <p>Revise detalladamente la información. Este registro asociará de forma inmutable la trazabilidad con los lotes y contenedores seleccionados.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border p-4 rounded-lg bg-card">
                  <div><span className="text-xs text-muted-foreground block">Fecha Ejecución:</span> {new Date(pendingPayload.performedAt).toLocaleString('es-BO')}</div>
                  <div><span className="text-xs text-muted-foreground block">Tipo:</span> {typesMap.get(pendingPayload.workTypeId) || 'No disponible'}</div>
                  <div><span className="text-xs text-muted-foreground block">Orden Principal:</span> {ordersMap.get(pendingPayload.productionOrderId) || 'No disponible'}</div>
                  <div><span className="text-xs text-muted-foreground block">Orden Transf.:</span> {pendingPayload.transformationOrderId ? transformMap.get(pendingPayload.transformationOrderId) || 'No disponible' : 'Ninguna'}</div>
                  <div className="col-span-2"><span className="text-xs text-muted-foreground block">Observaciones:</span> {pendingPayload.observations || '-'}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded-md overflow-x-auto bg-card">
                    <div className="bg-muted px-3 py-2 border-b text-xs font-medium">Lotes ({pendingPayload.batchIds?.length || 0})</div>
                    <ul className="divide-y text-sm">
                      {(pendingPayload.batchIds || []).map(id => (
                        <li key={id} className="p-2">{batchesMap.get(id) || 'No disponible'}</li>
                      ))}
                      {!(pendingPayload.batchIds?.length) && <li className="p-2 text-muted-foreground italic text-xs">Ninguno</li>}
                    </ul>
                  </div>
                  <div className="border rounded-md overflow-x-auto bg-card">
                    <div className="bg-muted px-3 py-2 border-b text-xs font-medium">Contenedores ({pendingPayload.containerIds?.length || 0})</div>
                    <ul className="divide-y text-sm">
                      {(pendingPayload.containerIds || []).map(id => (
                        <li key={id} className="p-2">{containersMap.get(id) || 'No disponible'}</li>
                      ))}
                      {!(pendingPayload.containerIds?.length) && <li className="p-2 text-muted-foreground italic text-xs">Ninguno</li>}
                    </ul>
                  </div>
                  <div className="border rounded-md overflow-x-auto bg-card">
                    <div className="bg-muted px-3 py-2 border-b text-xs font-medium">Participantes ({pendingPayload.participants?.length || 0})</div>
                    <ul className="divide-y text-sm">
                      {(pendingPayload.participants || []).map((p, i) => (
                        <li key={i} className="p-2">
                          <div className="font-medium">{participantsMap.get(p.participantId) || 'No disponible'}</div>
                          {p.role && <div className="text-xs text-muted-foreground">{p.role}</div>}
                        </li>
                      ))}
                      {!(pendingPayload.participants?.length) && <li className="p-2 text-muted-foreground italic text-xs">Ninguno</li>}
                    </ul>
                  </div>
                </div>

                {createMutation.error && (
                  <div className={`p-4 rounded-lg flex items-start gap-3 border ${definitiveError ? 'bg-warning/10 text-warning-foreground border-warning/20' : 'bg-destructive/10 text-destructive border-destructive/20'}`}>
                    {definitiveError ? <AlertTriangle className="h-5 w-5 shrink-0 text-warning" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                    <div>
                      <p className="font-semibold text-sm">{definitiveError ? 'Error de Validación / Negocio' : 'Error de Conexión'}</p>
                      <p className="text-sm mt-1">{mapProductionError(createMutation.error).userMessage}</p>
                      <p className="text-xs font-mono mt-1 opacity-70">Req: {mapProductionError(createMutation.error).requestId}</p>
                      {definitiveError ? (
                        <p className="text-sm mt-3 font-medium">Debe modificar los datos para reintentar la operación.</p>
                      ) : (
                        <p className="text-sm mt-3 font-medium">El resultado de la operación es desconocido. Por favor cierre, verifique y actualice antes de crear de nuevo.</p>
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
              <Button type="button" variant="outline" onClick={() => { setStep('form'); setPendingPayload(null); setDefinitiveError(false); }} disabled={createMutation.isPending || (!!createMutation.error && !definitiveError)}>
                Volver
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={createMutation.isPending || definitiveError || (!!createMutation.error && !definitiveError)} className="min-w-[120px]">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar y Guardar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
