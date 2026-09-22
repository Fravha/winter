import { useState, useEffect, useRef } from 'react';
import { useForm, UseFormReturn, FieldValues, Path, PathValue } from 'react-hook-form';
import { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRegisterInbound, useRegisterOutbound, useTransferStock, useAdjustStock } from '../api/inventory.hooks';
import { movementSchema, transferSchema, adjustmentSchema, type MovementFormValues, type TransferFormValues, type AdjustmentFormValues } from '../schemas/inventory.schema';
import { ArticuloSelect, WarehouseSelect } from './SharedSelects';
import { mapInventoryError } from '../api/inventory.error';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { IdempotentCommand, type Warehouse } from '../types/inventory.types';
import { Articulo } from '../../articulos/types/articulo.types';

export type SnapshotDetails = {
  type: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUST';
  labels: {
    articulo: string;
    warehouse?: string;
    sourceWarehouse?: string;
    destinationWarehouse?: string;
  };
  details: {
    quantity: string;
    unit: string;
    reason?: string;
    direction?: 'INCREASE' | 'DECREASE';
    authorizeNegativeStock?: boolean;
    negativeStockReason?: string;
  };
};

export type ConfirmationSnapshot<TInput> = SnapshotDetails & {
  key: string;
  input: TInput;
};

function validateQty(val: string, ctx: z.RefinementCtx, unit: string) {
  const num = Number(val);
  if (isNaN(num) || num <= 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe ser mayor a 0", path: ["quantity"] });
    return;
  }
  if (unit === 'UNIDAD' && !Number.isInteger(num)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe ser un número entero para UNIDAD", path: ["quantity"] });
  }
  const parts = val.split('.');
  if (parts.length > 1 && parts[1].length > 3) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Máximo 3 decimales permitidos", path: ["quantity"] });
  }
}

const inboundSchemaStrict = movementSchema.superRefine((data, ctx) => validateQty(data.quantity, ctx, data.unit));
const outboundSchemaStrict = movementSchema.superRefine((data, ctx) => validateQty(data.quantity, ctx, data.unit));
const transferSchemaStrict = transferSchema.superRefine((data, ctx) => {
  if (data.sourceWarehouseId === data.destinationWarehouseId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Los almacenes de origen y destino deben ser distintos", path: ["destinationWarehouseId"] });
  }
  validateQty(data.quantity, ctx, data.unit);
});
const adjustmentSchemaStrict = adjustmentSchema.superRefine((data, ctx) => validateQty(data.quantity, ctx, data.unit));

function useMovementLogic<TInput, TResult, TForm extends FieldValues>(
  mutationHook: (options?: Omit<UseMutationOptions<TResult, Error, { input: TInput, idempotencyKey: string }>, 'mutationFn'>) => UseMutationResult<TResult, Error, { input: TInput, idempotencyKey: string }>,
  form: UseFormReturn<TForm>,
  buildInput: (values: TForm) => TInput
) {
  const { can } = useAuth();
  const { toast } = useToast();
  const [idempotencyState, setIdempotencyState] = useState<{ key: string; payload: string | null; isRetry: boolean }>({
    key: crypto.randomUUID(), payload: null, isRetry: false
  });
  const [successResult, setSuccessResult] = useState<{ movementId: string; resultingStock: string; unit: string; destinationResultingStock?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reqId, setReqId] = useState<string | null>(null);
  const [validationDetails, setValidationDetails] = useState<unknown>(null);
  const [showNegativeAuth, setShowNegativeAuth] = useState(false);
  const [loadedArticulos, setLoadedArticulos] = useState<Articulo[]>([]);
  const [loadedWarehouses, setLoadedWarehouses] = useState<Warehouse[]>([]);
  const [pendingConfirmData, setPendingConfirmData] = useState<ConfirmationSnapshot<TInput> | null>(null);

  const isMutatingRef = useRef(false);

  const qty = form.watch('quantity' as Path<TForm>);
  const artId = form.watch('articuloId' as Path<TForm>);
  
  useEffect(() => {
    if (successResult) setSuccessResult(null);
  }, [qty, artId]);

  useEffect(() => {
    if (artId && typeof artId === 'string' && loadedArticulos.length > 0) {
      const art = loadedArticulos.find(a => a.id === artId);
      if (art && form.getValues('unit' as Path<TForm>) !== art.unidadMedida) {
        form.setValue('unit' as Path<TForm>, art.unidadMedida as PathValue<TForm, Path<TForm>>);
      }
    }
  }, [artId, loadedArticulos, form]);

  const handleSuccess = (data: TResult) => {
    isMutatingRef.current = false;
    setPendingConfirmData(null);
    setSuccessResult(data as { movementId: string; resultingStock: string; unit: string; destinationResultingStock?: string });
    setErrorMsg(null);
    setReqId(null);
    setValidationDetails(null);
    setShowNegativeAuth(false);
    setIdempotencyState({ key: crypto.randomUUID(), payload: null, isRetry: false });
    form.setValue('quantity' as Path<TForm>, '' as PathValue<TForm, Path<TForm>>);
    form.setValue('authorizeNegativeStock' as Path<TForm>, false as PathValue<TForm, Path<TForm>>);
    form.setValue('negativeStockReason' as Path<TForm>, '' as PathValue<TForm, Path<TForm>>);
    toast({ title: 'Operación Registrada', description: 'El movimiento de stock ha sido procesado exitosamente.' });
  };

  const handleError = (error: unknown, payloadObj: unknown) => {
    isMutatingRef.current = false;
    setPendingConfirmData(null);
    const mapped = mapInventoryError(error);
    if (mapped.code === 'NEGATIVE_STOCK_AUTHORIZATION_REQUIRED' && can('inventory:negative_stock_authorize')) {
      setShowNegativeAuth(true);
      setErrorMsg('Esta operación dejará el stock en negativo. Se requiere autorización explícita.');
      setIdempotencyState({ key: crypto.randomUUID(), payload: null, isRetry: false }); 
    } else {
      setErrorMsg(mapped.userMessage);
      setReqId(mapped.requestId || null);
      setValidationDetails(mapped.details ?? null);
      if (mapped.status === 0) {
        setIdempotencyState(prev => ({ ...prev, payload: JSON.stringify(payloadObj), isRetry: true }));
      } else {
        setIdempotencyState({ key: crypto.randomUUID(), payload: null, isRetry: false });
      }
    }
  };

  const mutation = mutationHook({ onSuccess: handleSuccess, onError: (e: unknown, v: { input: TInput, idempotencyKey: string }) => handleError(e, v.input) });

  const onSubmit = (values: TForm, snapshotDetails: SnapshotDetails) => {
    setErrorMsg(null);
    setReqId(null);
    setValidationDetails(null);

    const inputData = buildInput(values);
    const payloadString = JSON.stringify(inputData);
    let key = idempotencyState.key;
    
    if (idempotencyState.isRetry && idempotencyState.payload === payloadString) {
      // retain key
    } else {
      key = crypto.randomUUID();
      setIdempotencyState({ key, payload: payloadString, isRetry: false });
    }

    setPendingConfirmData({ input: inputData, key, ...snapshotDetails });
  };

  const confirmOperation = () => {
    if (pendingConfirmData && !isMutatingRef.current) {
      isMutatingRef.current = true;
      mutation.mutate({ input: pendingConfirmData.input, idempotencyKey: pendingConfirmData.key });
    }
  };

  const cancelOperation = () => {
    if (!isMutatingRef.current) {
      setPendingConfirmData(null);
    }
  };

  return { form, mutation, onSubmit, confirmOperation, cancelOperation, pendingConfirmData, successResult, errorMsg, reqId, validationDetails, showNegativeAuth, setShowNegativeAuth, loadedArticulos, setLoadedArticulos, loadedWarehouses, setLoadedWarehouses, idempotencyState };
}

interface CommonMovementFormProps {
  title: string;
  description: string;
}

export function InboundForm({ title, description }: CommonMovementFormProps) {
  const form = useForm<MovementFormValues>({
    resolver: zodResolver(inboundSchemaStrict),
    defaultValues: { articuloId: '', warehouseId: '', quantity: '', unit: 'UNIDAD', source: '', reason: '', inventoryLotId: '', authorizeNegativeStock: false, negativeStockReason: '' }
  });

  const logic = useMovementLogic(
    useRegisterInbound,
    form,
    (v) => ({ ...v, reason: (v.reason as string) || undefined, inventoryLotId: (v.inventoryLotId as string) || undefined, negativeStockReason: (v.negativeStockReason as string) || undefined })
  );

  return <FormLayout {...logic} title={title} description={description} type="INBOUND" />;
}

export function OutboundForm({ title, description }: CommonMovementFormProps) {
  const form = useForm<MovementFormValues>({
    resolver: zodResolver(outboundSchemaStrict),
    defaultValues: { articuloId: '', warehouseId: '', quantity: '', unit: 'UNIDAD', source: '', reason: '', inventoryLotId: '', authorizeNegativeStock: false, negativeStockReason: '' }
  });

  const logic = useMovementLogic(
    useRegisterOutbound,
    form,
    (v) => ({ ...v, reason: (v.reason as string) || undefined, inventoryLotId: (v.inventoryLotId as string) || undefined, negativeStockReason: (v.negativeStockReason as string) || undefined })
  );

  return <FormLayout {...logic} title={title} description={description} type="OUTBOUND" />;
}

export function TransferForm({ title, description }: CommonMovementFormProps) {
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchemaStrict),
    defaultValues: { articuloId: '', sourceWarehouseId: '', destinationWarehouseId: '', quantity: '', unit: 'UNIDAD', source: '', reason: '', inventoryLotId: '', authorizeNegativeStock: false, negativeStockReason: '' }
  });

  const logic = useMovementLogic(
    useTransferStock,
    form,
    (v) => ({ ...v, reason: (v.reason as string) || undefined, inventoryLotId: (v.inventoryLotId as string) || undefined, negativeStockReason: (v.negativeStockReason as string) || undefined })
  );

  return <FormLayout {...logic} title={title} description={description} type="TRANSFER" />;
}

export function AdjustForm({ title, description }: CommonMovementFormProps) {
  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchemaStrict),
    defaultValues: { articuloId: '', warehouseId: '', quantity: '', unit: 'UNIDAD', source: '', reason: '', inventoryLotId: '', direction: 'DECREASE', authorizeNegativeStock: false, negativeStockReason: '' }
  });

  const logic = useMovementLogic(
    useAdjustStock,
    form,
    (v) => ({ ...v, reason: (v.reason as string) || undefined, inventoryLotId: (v.inventoryLotId as string) || undefined, negativeStockReason: (v.negativeStockReason as string) || undefined })
  );

  return <FormLayout {...logic} title={title} description={description} type="ADJUST" />;
}

function FormLayout<TForm extends FieldValues, TInput>({
  form, onSubmit, confirmOperation, cancelOperation, pendingConfirmData, mutation, title, description, successResult, errorMsg, reqId, validationDetails, showNegativeAuth, setShowNegativeAuth, setLoadedArticulos, loadedArticulos, setLoadedWarehouses, loadedWarehouses, type, idempotencyState
}: {
  form: UseFormReturn<TForm>;
  onSubmit: (values: TForm, snapshot: SnapshotDetails) => void;
  confirmOperation: () => void;
  cancelOperation: () => void;
  pendingConfirmData: ConfirmationSnapshot<TInput> | null;
  mutation: { isPending: boolean };
  title: string;
  description: string;
  successResult: { movementId: string; resultingStock: string; unit: string; destinationResultingStock?: string } | null;
  errorMsg: string | null;
  reqId: string | null;
  validationDetails: unknown;
  showNegativeAuth: boolean;
  setShowNegativeAuth: (v: boolean) => void;
  setLoadedArticulos: (v: Articulo[]) => void;
  loadedArticulos: Articulo[];
  setLoadedWarehouses: (v: Warehouse[]) => void;
  loadedWarehouses: Warehouse[];
  type: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUST';
  idempotencyState: { isRetry: boolean };
}) {
  const isPending = mutation.isPending;

  const handleFormSubmit = (values: TForm) => {
    const valuesRecord = values as Record<string, unknown>;

    const artId = typeof valuesRecord.articuloId === 'string' ? valuesRecord.articuloId : '';
    const art = loadedArticulos.find(a => a.id === artId);
    const artLabel = art ? `${art.codigo} - ${art.nombre}` : 'Artículo desconocido';

    let whLabel, sourceWhLabel, destWhLabel;
    if (type === 'TRANSFER') {
      const sourceId = typeof valuesRecord.sourceWarehouseId === 'string' ? valuesRecord.sourceWarehouseId : '';
      const destId = typeof valuesRecord.destinationWarehouseId === 'string' ? valuesRecord.destinationWarehouseId : '';
      const sourceWh = loadedWarehouses.find(w => w.id === sourceId);
      const destWh = loadedWarehouses.find(w => w.id === destId);
      sourceWhLabel = sourceWh ? `${sourceWh.codigo} - ${sourceWh.nombre}` : 'Origen desconocido';
      destWhLabel = destWh ? `${destWh.codigo} - ${destWh.nombre}` : 'Destino desconocido';
    } else {
      const whId = typeof valuesRecord.warehouseId === 'string' ? valuesRecord.warehouseId : '';
      const wh = loadedWarehouses.find(w => w.id === whId);
      whLabel = wh ? `${wh.codigo} - ${wh.nombre}` : 'Almacén desconocido';
    }

    const snapshotDetails: SnapshotDetails = {
      type,
      labels: {
        articulo: artLabel,
        warehouse: whLabel,
        sourceWarehouse: sourceWhLabel,
        destinationWarehouse: destWhLabel,
      },
      details: {
        quantity: String(valuesRecord.quantity || ''),
        unit: String(valuesRecord.unit || ''),
        reason: typeof valuesRecord.reason === 'string' && valuesRecord.reason ? valuesRecord.reason : undefined,
        direction: type === 'ADJUST' ? (valuesRecord.direction as 'INCREASE' | 'DECREASE') : undefined,
        authorizeNegativeStock: Boolean(valuesRecord.authorizeNegativeStock),
        negativeStockReason: typeof valuesRecord.negativeStockReason === 'string' ? valuesRecord.negativeStockReason : undefined,
      }
    };

    onSubmit(values, snapshotDetails);
  };

  const renderConfirmationContent = () => {
    if (!pendingConfirmData) return null;
    const { type, labels, details } = pendingConfirmData;

    if (type === 'TRANSFER') {
      return (
        <div className="space-y-4 text-sm mt-4">
          <p>
            Se transferirán <span className="font-semibold">{details.quantity} {details.unit}</span> de <span className="font-semibold">{labels.articulo}</span>
            <br />
            desde <span className="font-semibold">{labels.sourceWarehouse}</span>
            <br />
            hacia <span className="font-semibold">{labels.destinationWarehouse}</span>.
          </p>
          {details.reason && <p>Motivo: {details.reason}</p>}
          {details.authorizeNegativeStock && (
            <p className="text-warning font-medium">Incluye autorización de stock negativo: {details.negativeStockReason}</p>
          )}
        </div>
      );
    } else if (type === 'ADJUST') {
      const isIncrease = details.direction === 'INCREASE';
      return (
        <div className="space-y-4 text-sm mt-4">
          <p>
            Se registrará un ajuste para <span className="font-semibold">{isIncrease ? 'aumentar' : 'disminuir'}</span> <span className="font-semibold">{details.quantity} {details.unit}</span> de <span className="font-semibold">{labels.articulo}</span>
            <br />
            en <span className="font-semibold">{labels.warehouse}</span>.
          </p>
          {details.reason && <p>Motivo: {details.reason}</p>}
          {details.authorizeNegativeStock && (
            <p className="text-warning font-medium">Incluye autorización de stock negativo: {details.negativeStockReason}</p>
          )}
        </div>
      );
    } else {
      const isOutbound = type === 'OUTBOUND';
      return (
        <div className="space-y-4 text-sm mt-4">
          <p>
            Se {isOutbound ? 'descontarán' : 'registrará una entrada de'} <span className="font-semibold">{details.quantity} {details.unit}</span> de <span className="font-semibold">{labels.articulo}</span>
            <br />
            {isOutbound ? 'de' : 'en'} <span className="font-semibold">{labels.warehouse}</span>.
          </p>
          {details.reason && <p>Motivo: {details.reason}</p>}
          {details.authorizeNegativeStock && (
            <p className="text-warning font-medium">Incluye autorización de stock negativo: {details.negativeStockReason}</p>
          )}
        </div>
      );
    }
  };

  const getPrimaryButtonLabel = () => {
    switch (type) {
      case 'INBOUND': return 'Registrar entrada';
      case 'OUTBOUND': return 'Registrar salida';
      case 'TRANSFER': return 'Transferir';
      case 'ADJUST': return 'Registrar ajuste';
    }
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="bg-muted/30 border-b pb-4 mb-4">
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      
      <CardContent>
        {successResult && (
          <Alert variant="default" className="mb-6 bg-success/10 text-success border-success/30">
            <CheckCircle2 className="h-5 w-5" />
            <AlertTitle>Operación Registrada</AlertTitle>
            <AlertDescription className="mt-2 text-sm font-medium">
              Stock Resultante: <span className="font-mono text-base ml-1">{successResult.resultingStock} {successResult.unit}</span>
              {successResult.destinationResultingStock && (
                <span className="block mt-1">
                  Destino Resultante: <span className="font-mono text-base ml-1">{successResult.destinationResultingStock} {successResult.unit}</span>
                </span>
              )}
              <span className="block mt-2 text-xs opacity-70">ID de Movimiento: {successResult.movementId}</span>
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name={"articuloId" as Path<TForm>}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Artículo *</FormLabel>
                    <FormControl>
                      <ArticuloSelect value={field.value as string} onChange={field.onChange} disabled={isPending || showNegativeAuth} onArticuloLoaded={setLoadedArticulos} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {type !== 'TRANSFER' ? (
                <FormField
                  control={form.control}
                  name={"warehouseId" as Path<TForm>}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Almacén *</FormLabel>
                      <FormControl>
                        <WarehouseSelect value={field.value as string} onChange={field.onChange} disabled={isPending || showNegativeAuth} onWarehousesLoaded={setLoadedWarehouses} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <>
                  <FormField
                    control={form.control}
                    name={"sourceWarehouseId" as Path<TForm>}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Almacén Origen *</FormLabel>
                        <FormControl>
                          <WarehouseSelect value={field.value as string} onChange={field.onChange} disabled={isPending || showNegativeAuth} placeholder="Almacén de salida" onWarehousesLoaded={setLoadedWarehouses} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={"destinationWarehouseId" as Path<TForm>}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Almacén Destino *</FormLabel>
                        <FormControl>
                          <WarehouseSelect value={field.value as string} onChange={field.onChange} disabled={isPending || showNegativeAuth} placeholder="Almacén de llegada" onWarehousesLoaded={setLoadedWarehouses} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4">
                <FormField
                  control={form.control}
                  name={"quantity" as Path<TForm>}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. 150.5" {...field} value={field.value as string} disabled={isPending || showNegativeAuth} data-testid="input-form-quantity" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="md:col-span-3">
                <FormField
                  control={form.control}
                  name={"unit" as Path<TForm>}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidad</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value as string} disabled className="bg-muted font-medium" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              
              {type === 'ADJUST' ? (
                <div className="md:col-span-5">
                  <FormField
                    control={form.control}
                    name={"direction" as Path<TForm>}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dirección del Ajuste *</FormLabel>
                        <Select value={field.value as string} onValueChange={field.onChange} disabled={isPending || showNegativeAuth}>
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="INCREASE">Incrementar (Faltaba)</SelectItem>
                            <SelectItem value="DECREASE">Disminuir (Sobraba)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : (
                <div className="md:col-span-5">
                  <FormField
                    control={form.control}
                    name={"inventoryLotId" as Path<TForm>}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lote (Opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="UUID del lote" {...field} value={field.value as string || ''} disabled={isPending || showNegativeAuth} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {type === 'ADJUST' && (
                <FormField
                  control={form.control}
                  name={"inventoryLotId" as Path<TForm>}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lote (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="UUID del lote" {...field} value={field.value as string || ''} disabled={isPending || showNegativeAuth} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name={"source" as Path<TForm>}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origen / Documento *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Guía de Remisión 1234, Conteo Físico 01" {...field} value={field.value as string} disabled={isPending || showNegativeAuth} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={"reason" as Path<TForm>}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motivo / Observaciones (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Detalles adicionales..." className="resize-none" {...field} value={field.value as string || ''} disabled={isPending || showNegativeAuth} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {errorMsg && !showNegativeAuth && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm flex flex-col gap-1">
                <div className="flex items-center font-medium"><AlertCircle className="h-4 w-4 mr-2" /> {errorMsg}</div>
                {idempotencyState.isRetry && (
                  <p className="ml-6 text-xs font-semibold mt-1">Reintente la operación haciendo clic en confirmar nuevamente.</p>
                )}
                {reqId && <span className="text-xs font-mono opacity-80 mt-1 ml-6">Req ID: {reqId}</span>}
                {Boolean(validationDetails) && (
                  <div className="mt-2 ml-6 text-xs bg-destructive/20 p-2 rounded max-h-32 overflow-y-auto font-mono">
                    {Array.isArray(validationDetails)
                      ? validationDetails.map((d, i) => <div key={i}>• {typeof d === 'string' ? d : JSON.stringify(d)}</div>)
                      : typeof validationDetails === 'object'
                      ? <pre className="whitespace-pre-wrap">{JSON.stringify(validationDetails, null, 2)}</pre>
                      : String(validationDetails)
                    }
                  </div>
                )}
              </div>
            )}

            {showNegativeAuth && (
              <div className="p-6 bg-warning/10 border-2 border-warning/30 rounded-lg space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 mr-3 text-warning mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-warning-foreground text-base mb-1">Autorización de Stock Negativo Requerida</h4>
                    <p className="text-sm text-warning-foreground/90 leading-relaxed">
                      Esta operación reducirá el stock por debajo de cero. Como tienes los permisos necesarios, puedes forzar la operación indicando un motivo válido de autorización.
                    </p>
                  </div>
                </div>
                
                <div className="pl-8">
                  <FormField
                    control={form.control}
                    name={"negativeStockReason" as Path<TForm>}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-warning-foreground">Motivo de Autorización *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Debe explicar por qué se autoriza el stock negativo..." 
                            className="border-warning/40 focus-visible:ring-warning"
                            {...field} 
                            value={field.value as string || ''}
                            disabled={isPending} 
                            onChange={(e) => {
                              field.onChange(e);
                              form.setValue('authorizeNegativeStock' as Path<TForm>, true as PathValue<TForm, Path<TForm>>);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-3 mt-4">
                    <Button type="button" variant="outline" className="border-warning/30 hover:bg-warning/20 text-warning-foreground" onClick={() => {
                      setShowNegativeAuth(false);
                      form.setValue('authorizeNegativeStock' as Path<TForm>, false as PathValue<TForm, Path<TForm>>);
                      form.setValue('negativeStockReason' as Path<TForm>, '' as PathValue<TForm, Path<TForm>>);
                    }}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isPending || !form.getValues('negativeStockReason' as Path<TForm>)} className="bg-warning text-warning-foreground hover:bg-warning/90 gap-2">
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                      Autorizar y Confirmar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!showNegativeAuth && (
              <div className="flex justify-end pt-4 border-t border-border">
                <Button type="submit" disabled={isPending} size="lg" className="min-w-[200px]" data-testid="button-submit-movement">
                  Continuar
                </Button>
              </div>
            )}
          </form>
        </Form>
      </CardContent>

      <AlertDialog open={!!pendingConfirmData} onOpenChange={(open) => { if (!open && !isPending) cancelOperation(); }}>
        <AlertDialogContent
          onEscapeKeyDown={(e) => { if (isPending) e.preventDefault(); }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar operación</AlertDialogTitle>
            <AlertDialogDescription asChild>
              {renderConfirmationContent()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending} onClick={(e) => { e.preventDefault(); cancelOperation(); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={(e) => { e.preventDefault(); confirmOperation(); }}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {getPrimaryButtonLabel()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}