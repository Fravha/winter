import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useReverseBatchRelease } from '../../api/production.hooks';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { mapProductionError } from '../../api/production.error';
import type { ProductionReleaseDto } from '../../types/production.types';


const reverseSchema = z.object({
  reason: z.string().trim().min(1, "Debe especificar un motivo para la reversión").max(2000),
});

type FormValues = z.infer<typeof reverseSchema>;

export function ReverseReleaseDialog({
  batchId,
  articuloId,
  release,
  open,
  onOpenChange
}: {
  batchId: string;
  articuloId: string;
  release: ProductionReleaseDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [operationKey, setOperationKey] = useState(crypto.randomUUID());
  const [lastPayloadStr, setLastPayloadStr] = useState<string | null>(null);
  const reverseMutation = useReverseBatchRelease();

  const form = useForm<FormValues>({
    resolver: zodResolver(reverseSchema),
    defaultValues: { reason: '' }
  });

  useEffect(() => {
    if (open) {
      setOperationKey(crypto.randomUUID());
      form.reset();
      reverseMutation.reset();
    }
  }, [open]);

  const handleFormSubmit = (data: FormValues) => {
    const currentPayloadStr = data.reason;
    let activeKey = operationKey;
    if (lastPayloadStr && lastPayloadStr !== currentPayloadStr) {
      activeKey = crypto.randomUUID();
      setOperationKey(activeKey);
    }
    setLastPayloadStr(currentPayloadStr);

    reverseMutation.mutate({
      batchId,
      releaseId: release.releaseId,
      input: { reason: data.reason, operationKey: activeKey },
      context: { warehouseId: release.warehouse.id, articuloId, inventoryLotId: release.inventoryLot.id }
    }, {
      onSuccess: () => onOpenChange(false)
    });
  };

  const error = reverseMutation.error ? mapProductionError(reverseMutation.error) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Revertir Envío a Inventario</DialogTitle>
          <DialogDescription>
            Devolverá la existencia desde Inventario a Producción.
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

        <Alert className="bg-amber-50/50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            <strong>Advertencia:</strong> Esta acción registrará un movimiento compensatorio restando stock de Inventario y sumando de vuelta al lote de Producción. La cantidad no se puede editar.
          </AlertDescription>
        </Alert>

        <dl className="grid grid-cols-2 gap-y-2 text-sm border p-4 rounded-md bg-muted/50">
          <dt className="text-muted-foreground font-medium">Cantidad a revertir:</dt>
          <dd className="font-semibold text-destructive">{release.quantity} {release.unit}</dd>

          <dt className="text-muted-foreground font-medium">Almacén origen:</dt>
          <dd>{release.warehouse.name} ({release.warehouse.code})</dd>

          <dt className="text-muted-foreground font-medium">Lote Inventario:</dt>
          <dd className="font-mono">{release.inventoryLot.lotCode}</dd>
        </dl>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo de Reversión</FormLabel>
                  <FormControl><Input {...field} autoFocus placeholder="Ej: Error en cantidad enviada" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={reverseMutation.isPending}>Cancelar</Button>
              <Button type="submit" variant="destructive" disabled={reverseMutation.isPending}>
                {reverseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Reversión
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
