import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowRight } from 'lucide-react';
import { useTransferProductionContainerTotal, useProductionContainers, useAllProductionWorks } from '../../api/production.hooks';
import { ProductionContainer } from '../../types/production.types';
import { createOperationKey, canonicalPayloadHash } from '../../utils/production-payload';
import { mapProductionError } from '../../api/production.error';
import { useToast } from '@/hooks/use-toast';

const schema = z.object({
  destinationContainerId: z.string().min(1, 'Obligatorio'),
  occurredAt: z.string().min(1, 'Obligatorio'),
  productionWorkId: z.string().optional(),
  observations: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ProductionContainer;
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ContainerTransferTotalDialog({ open, onOpenChange, source }: Props) {
  const { toast } = useToast();
  const transferReq = useTransferProductionContainerTotal();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [pendingPayload, setPendingPayload] = useState<{ payload: any, operationKey: string, requestHash: string, data: FormData } | null>(null);
  
  const { data: containersRes, isLoading: loadingContainers } = useProductionContainers({ enabled: open });
  const { data: works, isLoading: loadingWorks } = useAllProductionWorks({ enabled: open });
  
  const containersMap = useMemo(() => new Map(containersRes?.data.map(c => [c.id, c.code])), [containersRes]);
  const worksMap = useMemo(() => new Map(works?.map(w => [w.id, `Trabajo del ${new Date(w.performedAt).toLocaleDateString('es-BO')} (v${w.version})`])), [works]);

  const availableDestinations = useMemo(() => {
    return containersRes?.data.filter(c => c.id !== source.id && c.status === 'DISPONIBLE') || [];
  }, [containersRes, source.id]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      destinationContainerId: '',
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
        destinationContainerId: '',
        occurredAt: toDatetimeLocal(new Date().toISOString()),
        productionWorkId: '',
        observations: ''
      });
    }
  }, [open, form]);

  if (!source.currentOccupancy) return null; // Defensive guard

  const onFormSubmit = async (data: FormData) => {
    const operationKey = createOperationKey();
    const productionWorkId = data.productionWorkId && data.productionWorkId !== 'none' ? data.productionWorkId : null;
    const normalized = {
      destinationContainerId: data.destinationContainerId,
      batchId: source.currentOccupancy!.batchId,
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
    transferReq.mutate({ 
      sourceId: source.id, 
      input: { 
        ...pendingPayload.payload, 
        operationKey: pendingPayload.operationKey, 
        requestHash: pendingPayload.requestHash 
      } 
    }, {
      onSuccess: () => {
        toast({ title: 'Traslado completo', description: 'Contenido trasladado exitosamente' });
        onOpenChange(false);
      },
      onError: (err) => {
        const e = mapProductionError(err);
        toast({ variant: 'destructive', title: 'Error de Traslado', description: e.userMessage });
      }
    });
  };

  const isPending = transferReq.isPending;
  const batchLabel = source.currentOccupancy.batchCode;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{step === 1 ? 'Trasladar Todo' : 'Confirmar Traslado Total'}</DialogTitle>
          <DialogDescription>
            {step === 1 ? 'Mover todo el contenido a otro recipiente vacío.' : 'Revise los detalles antes de confirmar el traslado.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <>
            <div className="flex items-center gap-4 bg-muted/50 p-4 rounded-md border text-sm my-2">
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Origen</div>
                <div className="font-bold">{source.code}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 text-right">
                <div className="text-xs text-muted-foreground">Lote Actual</div>
                <div className="font-bold text-primary">{batchLabel}</div>
                <div className="text-xs">{source.currentOccupancy.quantity} {source.currentOccupancy.unit}</div>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4">
                
                <FormField
                  control={form.control}
                  name="destinationContainerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipiente Destino</FormLabel>
                      <Select disabled={isPending || loadingContainers} onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="input-destination">
                            <SelectValue placeholder={loadingContainers ? "Cargando recipientes..." : "Seleccione destino (DISPONIBLE)"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableDestinations.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.code} <span className="text-xs text-muted-foreground ml-2">({c.capacity} {c.capacityUnit})</span>
                            </SelectItem>
                          ))}
                          {availableDestinations.length === 0 && (
                            <div className="p-2 text-sm text-muted-foreground text-center">No hay recipientes disponibles</div>
                          )}
                        </SelectContent>
                      </Select>
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
                <span className="font-medium" data-testid="confirm-type">Traslado Total</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Lote a Trasladar</span>
                <span className="font-medium" data-testid="confirm-batch">{batchLabel}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Origen</span>
                <span className="font-medium" data-testid="confirm-source">{source.code}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Destino</span>
                <span className="font-medium" data-testid="confirm-destination">{containersMap.get(pendingPayload.data.destinationContainerId) || pendingPayload.data.destinationContainerId}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Cantidad Total</span>
                <span className="font-medium" data-testid="confirm-quantity">{source.currentOccupancy!.quantity} {source.currentOccupancy!.unit}</span>
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