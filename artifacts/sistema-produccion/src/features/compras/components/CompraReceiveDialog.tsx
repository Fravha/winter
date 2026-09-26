import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReceiveCompra } from '../api/compras.hooks';
import { useActiveWarehouses } from '@/features/inventory/api/inventory.hooks';
import { mapCompraError } from '../api/compras.error';
import type { Compra, ReceiveCompraInput } from '../types/compra.types';
import { receiveCompraSchema } from '../schemas/compra.schema';
import { Loader2, AlertCircle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { comprasKeys } from '../api/compras.keys';

interface CompraReceiveDialogProps {
  compra: Compra | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompraReceiveDialog({ compra, open, onOpenChange }: CompraReceiveDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reqId, setReqId] = useState<string | null>(null);
  const [validationDetails, setValidationDetails] = useState<unknown>(null);

  const { data: warehousesData, isLoading: isLoadingWarehouses, error: warehousesError, refetch: refetchWarehouses } = useActiveWarehouses({ enabled: open });
  const warehouses = warehousesData ?? [];

  const receiveMutation = useReceiveCompra({
    onSuccess: () => {
      toast({ title: 'Compra recibida exitosamente' });
      onOpenChange(false);
    },
    onError: (err) => {
      const mapped = mapCompraError(err);
      setErrorMsg(mapped.userMessage);
      setReqId(mapped.requestId || null);
      setValidationDetails(mapped.details ?? null);

      if (['COMPRA_NOT_EDITABLE', 'COMPRA_NOT_RECEIVABLE', 'COMPRA_NOT_CANCELLABLE', 'COMPRA_TRANSITION_FAILED'].includes(mapped.code)) {
        queryClient.invalidateQueries({ queryKey: comprasKeys.lists() });
        if (compra) queryClient.invalidateQueries({ queryKey: comprasKeys.detail(compra.id) });
      }
    },
  });

  const form = useForm<ReceiveCompraInput>({
    resolver: zodResolver(receiveCompraSchema),
    defaultValues: {
      warehouseId: '',
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (receiveMutation.isPending) return;
    if (!newOpen) {
      form.reset();
      setErrorMsg(null);
      setReqId(null);
      setValidationDetails(null);
    }
    onOpenChange(newOpen);
  };

  const onSubmit = (values: ReceiveCompraInput) => {
    if (!compra) return;
    setErrorMsg(null);
    setReqId(null);
    setValidationDetails(null);
    receiveMutation.mutate({ id: compra.id, input: { warehouseId: values.warehouseId } });
  };

  const hasWarehouseData = warehousesData !== undefined;
  const isWarehousesEmpty = !isLoadingWarehouses && hasWarehouseData && warehouses.length === 0;
  const isWarehouseInitialError = Boolean(warehousesError && !hasWarehouseData);
  const mappedWarehousesError = warehousesError ? mapCompraError(warehousesError) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="dialog-receive-compra"
        onInteractOutside={(e) => { if (receiveMutation.isPending) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (receiveMutation.isPending) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Recibir Compra</DialogTitle>
          <DialogDescription>
            Selecciona el almacén de destino para recibir los artículos de la compra de {compra?.supplierName}.
            Se recibirá el total de lo solicitado.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-info/10 text-info text-sm p-3 rounded-md border border-info/20 flex items-start gap-2 mb-2">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>Esta acción registrará el ingreso automático de todos los artículos en el inventario del almacén seleccionado.</p>
        </div>

        {warehousesError && (
          <div className="mb-4 text-sm text-destructive bg-destructive/10 p-3 rounded-md flex flex-col gap-2 border border-destructive/20 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium">
              <span className="flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                {hasWarehouseData
                  ? 'No se pudieron actualizar los almacenes. Se mantienen las opciones disponibles.'
                  : 'No fue posible cargar los almacenes activos.'}
              </span>
              {mappedWarehousesError?.requestId && (
                <span className="mt-1 block font-mono text-xs">Req ID: {mappedWarehousesError.requestId}</span>
              )}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => refetchWarehouses()} className="border-destructive/30 hover:bg-destructive/20 text-destructive">Reintentar</Button>
          </div>
        )}

        {isWarehousesEmpty && (
          <div className="mb-4 text-sm text-warning-foreground bg-warning/10 p-3 rounded-md border border-warning/20 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <p>No hay almacenes activos disponibles. Debes activar un almacén para poder recibir esta compra.</p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="warehouseId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Almacén de Destino</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingWarehouses || isWarehouseInitialError || isWarehousesEmpty}>
                    <FormControl>
                      <SelectTrigger data-testid="select-warehouse">
                        <SelectValue placeholder={isLoadingWarehouses ? "Cargando almacenes..." : "Selecciona un almacén"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={wh.id}>
                          {wh.codigo} - {wh.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {errorMsg && (
              <div className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-md border border-destructive/20 flex items-start flex-col">
                <div className="flex items-center mb-1">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {errorMsg}
                </div>
                {reqId && <span className="block text-xs opacity-80 mt-1">Req ID: {reqId}</span>}
                {validationDetails ? (
                  <div className="mt-2 w-full text-xs bg-destructive/20 p-2 rounded max-h-32 overflow-y-auto font-mono">
                    {Array.isArray(validationDetails)
                      ? validationDetails.map((d, i) => <div key={i}>• {typeof d === 'string' ? d : JSON.stringify(d)}</div>)
                      : typeof validationDetails === 'object'
                      ? <pre className="whitespace-pre-wrap">{JSON.stringify(validationDetails, null, 2)}</pre>
                      : String(validationDetails)
                    }
                  </div>
                ) : null}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={receiveMutation.isPending}
                data-testid="button-receive-dialog-close"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={receiveMutation.isPending || isLoadingWarehouses || isWarehouseInitialError || isWarehousesEmpty}
                data-testid="button-receive-dialog-confirm"
                className="gap-2"
              >
                {receiveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar Recepción
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
