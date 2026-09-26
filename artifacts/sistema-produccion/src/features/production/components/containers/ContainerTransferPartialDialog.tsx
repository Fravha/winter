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
import { Loader2, AlertCircle } from 'lucide-react';
import { useTransferProductionContainerPartial, useProductionContainers, useAllProductionWorks } from '../../api/production.hooks';
import { ProductionContainer } from '../../types/production.types';
import { createOperationKey, canonicalPayloadHash } from '../../utils/production-payload';
import { mapProductionError } from '../../api/production.error';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

const schema = z.object({
  destinationContainerId: z.string().min(1, 'Obligatorio'),
  quantity: z.string().min(1, 'Obligatorio').refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Debe ser un número positivo'),
  childCode: z.string().min(1, 'Obligatorio'),
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

export function ContainerTransferPartialDialog({ open, onOpenChange, source }: Props) {
  const { toast } = useToast();
  const transferReq = useTransferProductionContainerPartial();
  
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
      quantity: '',
      childCode: '',
      occurredAt: toDatetimeLocal(new Date().toISOString()),
      productionWorkId: '',
      observations: ''
    }
  });

  useEffect(() => {
    if (open && source.currentOccupancy) {
      setStep(1);
      setPendingPayload(null);
      const parentCode = source.currentOccupancy.batchCode;
      form.reset({
        destinationContainerId: '',
        quantity: '',
        childCode: `${parentCode}-P1`, // Suggest a child code
        occurredAt: toDatetimeLocal(new Date().toISOString()),
        productionWorkId: '',
        observations: ''
      });
    }
  }, [open, source, form]);

  if (!source.currentOccupancy) return null; // Defensive guard
  const sourceCode = source.currentOccupancy.batchCode;

  const onFormSubmit = async (data: FormData) => {
    if (Number(data.quantity) >= Number(source.currentOccupancy!.quantity)) {
      toast({ variant: 'destructive', title: 'Cantidad inválida', description: 'La cantidad debe ser menor a la ocupación total (traslado parcial).' });
      return;
    }

    const operationKey = createOperationKey();
    const productionWorkId = data.productionWorkId && data.productionWorkId !== 'none' ? data.productionWorkId : null;
    const normalized = {
      destinationContainerId: data.destinationContainerId,
      batchId: source.currentOccupancy!.batchId,
      quantity: data.quantity,
      childCode: data.childCode.trim(),
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
        toast({ title: 'Traslado parcial', description: 'Lote separado y trasladado exitosamente' });
        onOpenChange(false);
      },
      onError: (err) => {
        const e = mapProductionError(err);
        toast({ variant: 'destructive', title: 'Error de Traslado', description: e.userMessage });
      }
    });
  };

  const isPending = transferReq.isPending;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="w-[calc(100%_-_2rem)] sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step === 1 ? 'Trasladar Parcialmente' : 'Confirmar Traslado Parcial'}</DialogTitle>
          <DialogDescription>
            {step === 1 ? 'Separar una porción del lote actual hacia otro recipiente.' : 'Revise los detalles antes de confirmar el traslado parcial.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <>
            <Alert className="bg-info/10 text-info border-info/20 mb-2 py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs ml-2">
                La transferencia parcial creará un <strong>nuevo ProductionBatch trazable</strong> para la porción trasladada, manteniendo la genealogía (lineage) con el lote original.
              </AlertDescription>
            </Alert>

            <div className="flex justify-between bg-muted/30 p-3 rounded-md border text-sm my-2">
              <div>
                <div className="text-xs text-muted-foreground">Recipiente Origen</div>
                <div className="font-bold">{source.code}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Lote Actual Disponible</div>
                <div className="font-bold text-primary">{sourceCode}</div>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cantidad a Trasladar</FormLabel>
                        <FormControl>
                          <div className="flex items-center">
                            <Input {...field} disabled={isPending} type="number" step="0.001" className="rounded-r-none" data-testid="input-quantity" />
                            <div className="bg-muted border border-l-0 px-3 py-2 text-sm text-muted-foreground rounded-r-md">
                              {source.currentOccupancy!.unit}
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="childCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Código Nuevo Lote</FormLabel>
                        <FormControl>
                          <Input {...field} disabled={isPending} data-testid="input-childCode" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
            <div className="bg-muted p-4 rounded-md text-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-muted-foreground block">Tipo de Movimiento</span>
                <span className="font-medium" data-testid="confirm-type">Traslado Parcial</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Lote Origen</span>
                <span className="font-medium">{sourceCode}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">Lote Resultante (Destino)</span>
                <span className="font-medium" data-testid="confirm-batch">{pendingPayload.data.childCode}</span>
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
                <span className="text-xs text-muted-foreground block">Cantidad Parcial</span>
                <span className="font-medium" data-testid="confirm-quantity">{pendingPayload.data.quantity} {source.currentOccupancy!.unit}</span>
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