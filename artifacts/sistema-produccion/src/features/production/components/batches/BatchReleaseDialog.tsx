import { useAuth } from '@/auth/AuthContext';
import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInventoryReleaseWarehouses, useReleaseBatchToInventory } from '../../api/production.hooks';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { mapProductionError } from '../../api/production.error';


const releaseSchema = z.object({
  quantity: z.string().trim().regex(/^(?!0+(?:\.0+)?$)(?:0|[1-9]\d{0,12})(?:\.\d{1,3})?$/, "Cantidad inválida (máx 13 dígitos enteros, 3 decimales, > 0)"),
  warehouseId: z.string().uuid("Seleccione un almacén"),
  lotCode: z.string().trim().min(1, "Requerido").max(100),
  fechaIngreso: z.string().trim().min(1, "Requerida"),
  observations: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof releaseSchema>;

export function BatchReleaseDialog({
  batchId,
  articuloName,
  articuloId,
  unit,
  open,
  onOpenChange
}: {
  batchId: string;
  articuloName: string;
  articuloId: string;
  unit: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  // Generate operationKey exactly once per logical payload, regenerated only if successful or modal re-opened
  const [operationKey, setOperationKey] = useState(crypto.randomUUID());
  const [lastPayloadStr, setLastPayloadStr] = useState<string | null>(null);

  const { can } = useAuth();
  const canRelease = can('production:inventory_release');
  const { data: warehousesResult, isLoading: loadingWarehouses, error: warehousesError } = useInventoryReleaseWarehouses({ enabled: open && canRelease });
  const releaseMutation = useReleaseBatchToInventory();

  const form = useForm<FormValues>({
    resolver: zodResolver(releaseSchema),
    defaultValues: { quantity: '', warehouseId: '', lotCode: '', fechaIngreso: new Date().toISOString().split('T')[0], observations: '' }
  });

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('form');
      setOperationKey(crypto.randomUUID());
      form.reset();
      releaseMutation.reset();
    }
  }, [open]);

  const warehouses = warehousesResult?.data || [];

  const handleFormSubmit = (data: FormValues) => {
    setStep('confirm');
  };

  const handleConfirmSubmit = () => {
    const data = form.getValues();
    const businessPayload = {
      quantity: data.quantity,
      warehouseId: data.warehouseId,
      lotCode: data.lotCode,
      fechaIngreso: data.fechaIngreso,
      observations: data.observations
    };
    const currentPayloadStr = JSON.stringify(businessPayload);
    let activeKey = operationKey;
    if (lastPayloadStr && lastPayloadStr !== currentPayloadStr) {
      activeKey = crypto.randomUUID();
      setOperationKey(activeKey);
    }
    setLastPayloadStr(currentPayloadStr);

    releaseMutation.mutate({
      batchId,
      input: {
        quantity: data.quantity,
        warehouseId: data.warehouseId,
        lotCode: data.lotCode,
        fechaIngreso: new Date(data.fechaIngreso).toISOString(),
        observations: data.observations || undefined,
        classification: "PRODUCTO_ENVASADO",
        operationKey: activeKey
      },
      context: { articuloId }
    }, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  const error = releaseMutation.error ? mapProductionError(releaseMutation.error) : warehousesError ? mapProductionError(warehousesError as Error) : null;
  const values = form.getValues();
  const selectedWarehouse = warehouses.find(w => w.id === values.warehouseId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Enviar Lote a Inventario</DialogTitle>
          <DialogDescription>
            {step === 'form' ? 'Configure los detalles del envío' : 'Confirme los detalles antes de continuar'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error.message}
              {error.requestId && <div className="text-xs mt-1 opacity-80">ID: {error.requestId}</div>}
            </AlertDescription>
          </Alert>
        )}

        {step === 'form' && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad ({unit})</FormLabel>
                      <FormControl><Input {...field} placeholder="0.00" type="text" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="warehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Almacén de destino</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={loadingWarehouses}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={loadingWarehouses ? "Cargando..." : "Seleccione"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {warehouses.map(w => (
                            <SelectItem key={w.id} value={w.id}>{w.codigo} · {w.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lotCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código de Lote (Inventario)</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fechaIngreso"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Ingreso</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Clasificación</label>
                <Input value="Producto envasado" readOnly disabled className="bg-muted" />
                <p className="text-[0.8rem] text-muted-foreground">Esta clasificación es fija y no puede ser modificada.</p>
              </div>

              <FormField
                control={form.control}
                name="observations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observaciones (Opcional)</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" disabled={loadingWarehouses}>Continuar</Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <Alert className="bg-blue-50/50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
              <AlertDescription className="text-blue-800 dark:text-blue-300">
                La existencia se transferirá de Producción a Inventario de forma permanente.
              </AlertDescription>
            </Alert>

            <dl className="grid grid-cols-2 gap-y-2 text-sm border p-4 rounded-md bg-muted/50">
              <dt className="text-muted-foreground font-medium">Lote de Producción:</dt>
              <dd className="font-mono">{batchId.split('-')[0]}</dd>

              <dt className="text-muted-foreground font-medium">Artículo:</dt>
              <dd>{articuloName}</dd>

              <dt className="text-muted-foreground font-medium">Cantidad a enviar:</dt>
              <dd className="font-semibold">{values.quantity} {unit}</dd>

              <dt className="text-muted-foreground font-medium">Almacén destino:</dt>
              <dd>{selectedWarehouse?.nombre} ({selectedWarehouse?.codigo})</dd>

              <dt className="text-muted-foreground font-medium">Lote Inventario:</dt>
              <dd className="font-mono">{values.lotCode}</dd>

              <dt className="text-muted-foreground font-medium">Clasificación:</dt>
              <dd>PRODUCTO_ENVASADO</dd>
            </dl>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('form')} disabled={releaseMutation.isPending}>Atrás</Button>
              <Button type="button" onClick={handleConfirmSubmit} disabled={releaseMutation.isPending}>
                {releaseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Envío
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
