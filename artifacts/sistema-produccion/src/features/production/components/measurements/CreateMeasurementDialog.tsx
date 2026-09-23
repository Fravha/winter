import { useState, useMemo } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { productionMeasurementCreateSchema } from '../../schemas/production.schema';
import { useCreateProductionMeasurement, useMeasurementTypes, useProductionBatches, useProductionContainers, useProductionWorks, useParticipants } from '../../api/production.hooks';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertCircle, Info, ChevronRight, AlertTriangle } from 'lucide-react';
import { mapProductionError } from '../../api/production.error';
import { toLocalDateTimeInput } from '../../utils/production-date';
import { MeasurementTypeSelect, BatchSelect, ContainerSelect, WorkSelect, ParticipantSelect } from '../shared/ProductionSharedSelects';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import type { ProductionMeasurementCreateInput } from '../../types/production.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (measurementId: string) => void;
}

const measureFormSchema = z.object({
  measurementTypeId: z.string().uuid('Requerido'),
  productionBatchId: z.string().optional().or(z.literal('')),
  productionContainerId: z.string().optional().or(z.literal('')),
  productionWorkId: z.string().optional().or(z.literal('')),
  participantId: z.string().optional().or(z.literal('')),
  value: z.string().regex(/^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/, 'Número inválido'),
  unit: z.string().trim().min(1, 'Requerido').max(100),
  measuredAt: z.string().min(1, 'Requerido'),
  observations: z.string().max(2000, 'Máximo 2000').optional().or(z.literal('')),
}).refine(v => v.productionBatchId || v.productionContainerId || v.productionWorkId, {
  message: 'Debe seleccionar al menos un contexto (Lote, Contenedor o Trabajo)',
  path: ['productionBatchId']
});

export function CreateMeasurementDialog({ open, onOpenChange, onSuccess }: Props) {
  const [step, setStep] = useState<'form' | 'summary'>('form');
  const [pendingPayload, setPendingPayload] = useState<ProductionMeasurementCreateInput | null>(null);
  const [definitiveError, setDefinitiveError] = useState(false);

  const { data: measurementTypes } = useMeasurementTypes({ pageSize: 100 });
  const { data: batches } = useProductionBatches({ pageSize: 100 });
  const { data: containers } = useProductionContainers();
  const { data: works } = useProductionWorks({ pageSize: 100 });
  const { data: participantsList } = useParticipants({ pageSize: 100 });

  const typesMap = useMemo(() => new Map(measurementTypes?.data.map(t => [t.id, t.name])), [measurementTypes]);
  const batchesMap = useMemo(() => new Map(batches?.data.map(b => [b.id, b.code])), [batches]);
  const containersMap = useMemo(() => new Map(containers?.data.map(c => [c.id, c.code])), [containers]);
  const worksMap = useMemo(() => new Map(works?.data.map(w => [w.id, new Date(w.performedAt).toLocaleDateString('es-BO')])), [works]);
  const participantsMap = useMemo(() => new Map(participantsList?.data.map(p => [p.id, p.name])), [participantsList]);

  const form = useForm<z.infer<typeof measureFormSchema>>({
    resolver: zodResolver(measureFormSchema),
    defaultValues: {
      measurementTypeId: '',
      productionBatchId: '',
      productionContainerId: '',
      productionWorkId: '',
      participantId: '',
      value: '',
      unit: '',
      measuredAt: toLocalDateTimeInput(),
      observations: '',
    }
  });

  const handlePreview = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    
    const values = form.getValues();
    let isoDate;
    try {
      isoDate = new Date(values.measuredAt).toISOString();
    } catch {
      form.setError('measuredAt', { message: 'Fecha inválida' });
      return;
    }

    const businessPayload: any = {
      measurementTypeId: values.measurementTypeId,
      value: values.value,
      unit: values.unit.trim(),
      measuredAt: isoDate,
    };
    
    if (values.productionBatchId) businessPayload.productionBatchId = values.productionBatchId;
    if (values.productionContainerId) businessPayload.productionContainerId = values.productionContainerId;
    if (values.productionWorkId) businessPayload.productionWorkId = values.productionWorkId;
    if (values.participantId) businessPayload.participantId = values.participantId;
    if (values.observations && values.observations.trim()) businessPayload.observations = values.observations.trim();

    const safePayload = productionMeasurementCreateSchema.parse(businessPayload);
    
    setPendingPayload(safePayload as ProductionMeasurementCreateInput);
    setStep('summary');
    setDefinitiveError(false);
  };

  const createMutation = useCreateProductionMeasurement({
    onSuccess: (data) => {
      toast({
        title: "Medición Registrada",
        description: "El registro de medición se guardó correctamente.",
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle>{step === 'form' ? 'Registrar Nueva Medición' : 'Confirmar Medición'}</DialogTitle>
          <DialogDescription>
            {step === 'form' 
              ? 'Ingrese los datos y asocie la medición al contexto correspondiente.'
              : 'Revise los datos de la medición antes de confirmar.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-muted/10">
          {step === 'form' ? (
            <Form {...form}>
              <form className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Datos de Medición</h3>
                    
                    <FormField control={form.control} name="measurementTypeId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Medición *</FormLabel>
                        <FormControl>
                          <MeasurementTypeSelect value={field.value} onValueChange={field.onChange} disabled={createMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="value" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor *</FormLabel>
                          <FormControl>
                            <Input placeholder="0.00" {...field} disabled={createMutation.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="unit" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unidad *</FormLabel>
                          <FormControl>
                            <Input placeholder="kg, °C, pH..." {...field} disabled={createMutation.isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={form.control} name="measuredAt" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha y Hora *</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} disabled={createMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="participantId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Realizado por (Opcional)</FormLabel>
                        <FormControl>
                          <ParticipantSelect value={field.value} onValueChange={field.onChange} disabled={createMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="observations" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observaciones</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Detalles adicionales..." disabled={createMutation.isPending} rows={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Contexto (Mín. 1 requerido)</h3>
                    
                    <FormField control={form.control} name="productionBatchId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lote de Producción</FormLabel>
                        <FormControl>
                          <BatchSelect value={field.value} onValueChange={field.onChange} disabled={createMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="productionContainerId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contenedor</FormLabel>
                        <FormControl>
                          <ContainerSelect value={field.value} onValueChange={field.onChange} disabled={createMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="productionWorkId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Trabajo de Producción</FormLabel>
                        <FormControl>
                          <WorkSelect value={field.value} onValueChange={field.onChange} disabled={createMutation.isPending} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>
              </form>
            </Form>
          ) : pendingPayload && (
            <ScrollArea className="h-full p-6">
              <div className="max-w-xl mx-auto space-y-6">
                <div className="bg-primary/10 border-primary/20 border p-4 rounded-lg flex gap-3 text-primary">
                  <Info className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold mb-1">Confirmación de Medición</p>
                    <p>Revise que el valor y las unidades sean correctos antes de confirmar el registro en el sistema.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border p-4 rounded-lg bg-card">
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground block">Medición Registrada:</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-bold font-mono text-primary">{pendingPayload.value}</span>
                      <span className="text-lg text-muted-foreground">{pendingPayload.unit}</span>
                    </div>
                  </div>
                  <div><span className="text-xs text-muted-foreground block">Fecha:</span> {new Date(pendingPayload.measuredAt).toLocaleString('es-BO')}</div>
                  <div><span className="text-xs text-muted-foreground block">Tipo:</span> {typesMap.get(pendingPayload.measurementTypeId) || 'No disponible'}</div>
                  <div><span className="text-xs text-muted-foreground block">Responsable:</span> {pendingPayload.participantId ? participantsMap.get(pendingPayload.participantId) || 'No disponible' : 'Ninguno'}</div>
                  <div className="col-span-2"><span className="text-xs text-muted-foreground block">Observaciones:</span> {pendingPayload.observations || '-'}</div>
                </div>

                <div className="border rounded-md overflow-hidden bg-card">
                  <div className="bg-muted px-3 py-2 border-b text-xs font-medium">Contexto Asociado</div>
                  <ul className="divide-y text-sm">
                    {pendingPayload.productionBatchId && (
                      <li className="p-3 flex items-center justify-between">
                        <span className="text-muted-foreground">Lote</span>
                        <span className="font-medium">{batchesMap.get(pendingPayload.productionBatchId) || 'No disponible'}</span>
                      </li>
                    )}
                    {pendingPayload.productionContainerId && (
                      <li className="p-3 flex items-center justify-between">
                        <span className="text-muted-foreground">Contenedor</span>
                        <span className="font-medium">{containersMap.get(pendingPayload.productionContainerId) || 'No disponible'}</span>
                      </li>
                    )}
                    {pendingPayload.productionWorkId && (
                      <li className="p-3 flex items-center justify-between">
                        <span className="text-muted-foreground">Trabajo</span>
                        <span className="font-medium">{worksMap.get(pendingPayload.productionWorkId) || 'No disponible'}</span>
                      </li>
                    )}
                  </ul>
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
