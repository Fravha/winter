import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Loader2, Info } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { useCreateProductionWorkInput } from '../../api/production.hooks';
import { ArticuloSelect, WarehouseSelect } from '../../../inventory/components/SharedSelects';
import { Articulo } from '../../../articulos/types/articulo.types';
import { Warehouse } from '../../../inventory/types/inventory.types';
import { useInventoryLot } from '../../../inventory/api/inventory.hooks';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { mapProductionError } from '../../api/production.error';
import { createOperationKey, canonicalPayloadHash } from '../../utils/production-payload';

function LotConfirmDisplay({ id }: { id: string }) {
  const { data } = useInventoryLot(id);
  if (!data) return <span className="font-mono text-xs">{id}</span>;
  return <span className="font-medium">{data.lotCode}</span>;
}

const schema = z.object({
  articuloId: z.string().min(1, 'El artículo es requerido'),
  warehouseId: z.string().min(1, 'El almacén es requerido'),
  inventoryLotId: z.string().uuid('Debe ser un UUID válido').or(z.literal('')).optional(),
  quantity: z.string().min(1, 'La cantidad es requerida').regex(/^\d+(\.\d{1,3})?$/, 'Debe ser un número positivo con hasta 3 decimales'),
  unit: z.string().min(1, 'La unidad es requerida'),
  observations: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
  authorizeNegativeStock: z.boolean().default(false),
  negativeStockReason: z.string().max(2000, 'Máximo 2000 caracteres').optional(),
}).superRefine((data, ctx) => {
  if (data.authorizeNegativeStock && !data.negativeStockReason?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe proveer una razón al autorizar stock negativo",
      path: ["negativeStockReason"]
    });
  }
});

type FormValues = z.infer<typeof schema>;

type NormalizedPayload = {
  articuloId: string;
  warehouseId: string;
  inventoryLotId: string | null;
  quantity: string;
  unit: string;
  observations: string | null;
  authorizeNegativeStock: boolean;
  negativeStockReason: string | null;
};

interface Props {
  workId: string;
  workLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkInputFormDialog({ workId, workLabel, open, onOpenChange }: Props) {
  const { can } = useAuth();
  const canAuthorizeNegative = can('inventory:negative_stock_authorize');
  const createInput = useCreateProductionWorkInput();

  const [loadedArticulos, setLoadedArticulos] = useState<Articulo[]>([]);
  const [loadedWarehouses, setLoadedWarehouses] = useState<Warehouse[]>([]);
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [pendingData, setPendingData] = useState<NormalizedPayload | null>(null);

  const idempotencyRef = useRef({ opKey: '', reqHash: '' });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      articuloId: '',
      warehouseId: '',
      inventoryLotId: '',
      quantity: '',
      unit: 'UNIDAD',
      observations: '',
      authorizeNegativeStock: false,
      negativeStockReason: ''
    }
  });

  useEffect(() => {
    if (open) {
      form.reset();
      setStep('form');
      setPendingData(null);
      createInput.reset();
      idempotencyRef.current = { opKey: '', reqHash: '' };
    }
  }, [open, form, createInput.reset]);

  const onFormSubmit = async (data: FormValues) => {
    const normalized: NormalizedPayload = {
      articuloId: data.articuloId,
      warehouseId: data.warehouseId,
      inventoryLotId: data.inventoryLotId || null,
      quantity: data.quantity,
      unit: data.unit,
      observations: data.observations?.trim() || null,
      authorizeNegativeStock: data.authorizeNegativeStock ?? false,
      negativeStockReason: data.negativeStockReason?.trim() || null
    };

    setPendingData(normalized);
    const reqHash = await canonicalPayloadHash(normalized);

    if (!idempotencyRef.current.opKey || idempotencyRef.current.reqHash !== reqHash) {
      idempotencyRef.current = { opKey: createOperationKey(), reqHash };
    }

    setStep('confirm');
  };

  const handleConfirm = () => {
    if (!pendingData) return;

    createInput.mutate({
      workId,
      input: {
        articuloId: pendingData.articuloId,
        warehouseId: pendingData.warehouseId,
        inventoryLotId: pendingData.inventoryLotId ?? undefined,
        quantity: pendingData.quantity,
        unit: pendingData.unit,
        observations: pendingData.observations ?? undefined,
        authorizeNegativeStock: pendingData.authorizeNegativeStock,
        negativeStockReason: pendingData.negativeStockReason ?? undefined,
        operationKey: idempotencyRef.current.opKey,
        requestHash: idempotencyRef.current.reqHash
      }
    }, {
      onSuccess: () => {
        onOpenChange(false);
      }
    });
  };

  const handleCancelConfirm = () => {
    setStep('form');
  };

  const mappedError = createInput.error ? mapProductionError(createInput.error) : null;
  const isPending = createInput.isPending;

  const getArticuloName = (id: string) => loadedArticulos.find(a => a.id === id)?.nombre || id;
  const getWarehouseName = (id: string) => loadedWarehouses.find(w => w.id === id)?.nombre || id;

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar Insumo Consumido</DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="articuloId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Artículo</FormLabel>
                      <FormControl>
                        <ArticuloSelect
                          value={field.value}
                          onChange={(val) => {
                            field.onChange(val);
                            const articulo = loadedArticulos.find(a => a.id === val);
                            if (articulo && articulo.unidadMedida) {
                              form.setValue('unit', articulo.unidadMedida);
                            }
                          }}
                          onArticuloLoaded={setLoadedArticulos}
                          disabled={isPending}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="warehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Almacén de Origen</FormLabel>
                      <FormControl>
                        <WarehouseSelect value={field.value} onChange={field.onChange} onWarehousesLoaded={setLoadedWarehouses} disabled={isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. 15.5" {...field} disabled={isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidad</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={isPending}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione unidad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="KG">Kilogramos (KG)</SelectItem>
                          <SelectItem value="G">Gramos (G)</SelectItem>
                          <SelectItem value="L">Litros (L)</SelectItem>
                          <SelectItem value="M">Metros (M)</SelectItem>
                          <SelectItem value="UNIDAD">Unidad</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="inventoryLotId"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Lote (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="UUID del lote" {...field} disabled={isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="observations"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Observaciones (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Detalles adicionales..." {...field} disabled={isPending} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {canAuthorizeNegative && (
                <div className="bg-destructive/5 border border-destructive/20 p-4 rounded-md space-y-4">
                  <FormField
                    control={form.control}
                    name="authorizeNegativeStock"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isPending}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-destructive font-medium">
                            Autorizar Stock Negativo
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Permitir que el inventario quede en negativo si no hay stock suficiente.
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  {form.watch('authorizeNegativeStock') && (
                    <FormField
                      control={form.control}
                      name="negativeStockReason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-destructive">Razón de Autorización</FormLabel>
                          <FormControl>
                            <Input placeholder="Justificación requerida" {...field} disabled={isPending} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending}>
                  Continuar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {step === 'confirm' && pendingData && (
          <div className="space-y-4 pt-4">
            <Alert className="border-warning/50 text-warning dark:border-warning/50 bg-warning/10">
              <Info className="h-4 w-4 text-warning" />
              <AlertTitle>Confirmación de Consumo</AlertTitle>
              <AlertDescription>
                Esta acción generará un movimiento de salida en inventario, reduciendo el stock disponible de forma inmediata.
              </AlertDescription>
            </Alert>

            <div className="bg-muted/50 p-4 rounded-md space-y-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Trabajo:</span>
                <span className="font-medium text-right max-w-[60%]">{workLabel}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Artículo:</span>
                <span className="font-medium text-right max-w-[60%] truncate">{getArticuloName(pendingData.articuloId)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Almacén:</span>
                <span className="font-medium text-right max-w-[60%] truncate">{getWarehouseName(pendingData.warehouseId)}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Cantidad:</span>
                <span className="font-medium">{pendingData.quantity} {pendingData.unit}</span>
              </div>
              {pendingData.inventoryLotId && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Lote:</span>
                  <LotConfirmDisplay id={pendingData.inventoryLotId} />
                </div>
              )}
              {pendingData.authorizeNegativeStock && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-destructive">Autoriza Negativo:</span>
                  <span className="font-medium text-destructive">Sí</span>
                </div>
              )}
            </div>

            {mappedError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error al registrar</AlertTitle>
                <AlertDescription>
                  {mappedError.userMessage}
                  {mappedError.requestId && <div className="text-xs font-mono mt-1 opacity-80">Req: {mappedError.requestId}</div>}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancelConfirm} disabled={isPending}>
                Atrás
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar y Descontar Stock
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}