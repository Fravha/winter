import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useAssignProductionContainer, useAllProductionBatches, useAllProductionWorks } from '../../api/production.hooks';
import { ProductionContainer } from '../../types/production.types';
import { createOperationKey, canonicalPayloadHash } from '../../utils/production-payload';
import { mapProductionError } from '../../api/production.error';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

const schema = z.object({
  batchId: z.string().min(1, 'Obligatorio'),
  quantity: z.string().min(1, 'Obligatorio').refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Debe ser un número positivo'),
  occurredAt: z.string().min(1, 'Obligatorio'),
  productionWorkId: z.string().optional(),
  observations: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: ProductionContainer;
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ContainerAssignDialog({ open, onOpenChange, container }: Props) {
  const { toast } = useToast();
  const assignReq = useAssignProductionContainer();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [pendingPayload, setPendingPayload] = useState<{ payload: any, operationKey: string, requestHash: string, data: FormData } | null>(null);
  
  const { data: batches, isLoading: loadingBatches } = useAllProductionBatches({ enabled: open });
  const { data: works, isLoading: loadingWorks } = useAllProductionWorks({ enabled: open });
  
  const batchesMap = useMemo(() => new Map(batches?.map(b => [b.id, b.code])), [batches]);
  const worksMap = useMemo(() => new Map(works?.map(w => [w.id, `Trabajo del ${new Date(w.performedAt).toLocaleDateString('es-BO')} (v${w.version})`])), [works]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      batchId: '',
      quantity: '',
      occurredAt: toDatetimeLocal(new Date().toISOString()),
      productionWorkId: '',
      observations: ''
    }
  });

  useEffect(() => {
    if (open) {
      setStep(1);
      setPendingPayload(null);
      form.reset({
        batchId: '',
        quantity: '',
        occurredAt: toDatetimeLocal(new Date().toISOString()),
        productionWorkId: '',
        observations: ''
      });
    }
  }, [open, form]);

  const onFormSubmit = async (data: FormData) => {
    const operationKey = createOperationKey();
    const productionWorkId = data.productionWorkId && data.productionWorkId !== 'none' ? data.productionWorkId : null;
    const normalized = {
      batchId: data.batchId,
      quantity: data.quantity,
      occurredAt: new Date(data.occurredAt).toISOString(),
      productionWorkId,
      observations: data.observations?.trim() || null,
    };
    const requestHash = await canonicalPayloadHash(normalized);
    const payload = {
      ...normalized,
      productionWorkId: normalized.productionWorkId ?? undefined,
      observations: normalized.observations ?? undefined,
    };
    
    setPendingPayload({ payload, operationKey, requestHash, data });
    setStep(2);
  };

  const onConfirm = () => {
    if (!pendingPayload) return;
    
    assignReq.mutate({ 
      id: container.id, 
      input: { 
        ...pendingPayload.payload, 
        operationKey: pendingPayload.operationKey, 
        requestHash: pendingPayload.requestHash 
      } 
    }, {
      onSuccess: () => {
        toast({ title: 'Contenido asignado exitosamente', description: `Lote asignado al recipiente ${container.code}` });
        onOpenChange(false);
      },
      onError: (err) => {
        const e = mapProductionError(err);
        toast({ variant: 'destructive', title: 'Error de Asignación', description: e.userMessage });
      }
    });
  };

  const isPending = assignReq.isPending;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="w-[calc(100%_-_2rem)] sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{step === 1 ? 'Asignar Contenido Inicial' : 'Confirmar Asignación'}</DialogTitle>
          <DialogDescription>
            {step === 1 
              ? `Recipiente destino: ${container.code} (${container.capacity} ${container.capacityUnit})`
              : 'Revise los detalles antes de confirmar la asignación.'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <>
            <Alert className="bg-primary/5 text-primary border-primary/20 mb-2 py-2">
              <AlertDescription className="text-xs">
                Use esta operación únicamente para introducir un lote existente por primera vez al recipiente cuando no proviene de otro recipiente registrado.
              </AlertDescription>
            </Alert>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
                
                <FormField
                  control={form.control}
                  name="batchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lote a asignar</FormLabel>
                      <Select disabled={isPending || loadingBatches} onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="input-batch">
                            <SelectValue placeholder={loadingBatches ? "Cargando lotes..." : "Seleccione un lote"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {batches?.filter(b => !container.currentOccupancy || b.id === container.currentOccupancy.batchId).map(b => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.code} <span className="text-xs text-muted-foreground ml-2">({b.balance.available} {b.unit})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cantidad</FormLabel>
                        <FormControl>
                          <div className="flex items-center">
                            <Input {...field} disabled={isPending} type="number" step="0.001" className="rounded-r-none" data-testid="input-quantity" />
                            <div className="bg-muted border border-l-0 px-3 py-2 text-sm text-muted-foreground rounded-r-md">
                              {container.capacityUnit}
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="occurredAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha/Hora de Movimiento</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isPending} type="datetime-local" data-testid="input-occurredAt" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="productionWorkId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trabajo Relacionado (Opcional)</FormLabel>
                      <Select disabled={isPending || loadingWorks} onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="input-work">
                            <SelectValue placeholder={loadingWorks ? "Cargando trabajos..." : "Ninguno"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Ninguno</SelectItem>
                          {works?.map(w => (
                            <SelectItem key={w.id} value={w.id}>
                              {new Date(w.performedAt).toLocaleDateString('es-BO')} (v{w.version})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Si este movimiento es resultado de un trabajo registrado</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="observations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observaciones (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea {...field} disabled={isPending} className="resize-none" rows={2} placeholder="Explicación narrativa..." data-testid="input-observations" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending} data-testid="button-cancel-form">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isPending} data-testid="button-continue">
                    Continuar
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}

        {step === 2 && pendingPayload && (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-md text-sm grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted-foreground block">Tipo de Movimiento</span>
                <span className="font-medium" data-testid="confirm-type">Asignación Inicial</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Lote a Asignar</span>
                <span className="font-medium" data-testid="confirm-batch">{batchesMap.get(pendingPayload.data.batchId) || pendingPayload.data.batchId}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Destino</span>
                <span className="font-medium" data-testid="confirm-destination">{container.code}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Cantidad</span>
                <span className="font-medium" data-testid="confirm-quantity">{pendingPayload.data.quantity} {container.capacityUnit}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Fecha/Hora</span>
                <span className="font-medium" data-testid="confirm-date">{new Date(pendingPayload.data.occurredAt).toLocaleString('es-BO')}</span>
              </div>
              {pendingPayload.data.productionWorkId && pendingPayload.data.productionWorkId !== 'none' && (
                <div className="col-span-2">
                  <span className="text-xs text-muted-foreground block">Trabajo Vinculado</span>
                  <span className="font-medium" data-testid="confirm-work">{worksMap.get(pendingPayload.data.productionWorkId)}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={isPending} data-testid="button-back">
                Volver
              </Button>
              <Button type="button" onClick={onConfirm} disabled={isPending} data-testid="button-submit">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}