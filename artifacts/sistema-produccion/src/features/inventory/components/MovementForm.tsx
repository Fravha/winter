import { useState, useEffect } from 'react';
import { useForm, UseFormReturn, FieldValues, Path } from 'react-hook-form';
import { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { PathValue } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/auth/AuthContext';
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
import { IdempotentCommand } from '../types/inventory.types';
import { Articulo } from '../../articulos/types/articulo.types';

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
  const [idempotencyState, setIdempotencyState] = useState<{ key: string; payload: string | null; isRetry: boolean }>({
    key: crypto.randomUUID(), payload: null, isRetry: false
  });
  const [successResult, setSuccessResult] = useState<{ movementId: string; resultingStock: string; unit: string; destinationResultingStock?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reqId, setReqId] = useState<string | null>(null);
  const [validationDetails, setValidationDetails] = useState<unknown>(null);
  const [showNegativeAuth, setShowNegativeAuth] = useState(false);
  const [loadedArticulos, setLoadedArticulos] = useState<Articulo[]>([]);

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
    setSuccessResult(data as { movementId: string; resultingStock: string; unit: string; destinationResultingStock?: string });
    setErrorMsg(null);
    setReqId(null);
    setValidationDetails(null);
    setShowNegativeAuth(false);
    setIdempotencyState({ key: crypto.randomUUID(), payload: null, isRetry: false });
    form.setValue('quantity' as Path<TForm>, '' as PathValue<TForm, Path<TForm>>);
    form.setValue('authorizeNegativeStock' as Path<TForm>, false as PathValue<TForm, Path<TForm>>);
    form.setValue('negativeStockReason' as Path<TForm>, '' as PathValue<TForm, Path<TForm>>);
  };

  const handleError = (error: unknown, payloadObj: unknown) => {
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

  const onSubmit = (values: TForm) => {
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

    mutation.mutate({ input: inputData, idempotencyKey: key });
  };

  return { form, mutation, onSubmit, successResult, errorMsg, reqId, validationDetails, showNegativeAuth, setShowNegativeAuth, loadedArticulos, setLoadedArticulos, idempotencyState };
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

  const { mutation, onSubmit, successResult, errorMsg, reqId, validationDetails, showNegativeAuth, setShowNegativeAuth, loadedArticulos, setLoadedArticulos, idempotencyState } = useMovementLogic(
    useRegisterInbound,
    form,
    (v) => ({ ...v, reason: (v.reason as string) || undefined, inventoryLotId: (v.inventoryLotId as string) || undefined, negativeStockReason: (v.negativeStockReason as string) || undefined })
  );

  return <FormLayout form={form} onSubmit={onSubmit} mutation={mutation} title={title} description={description} successResult={successResult} errorMsg={errorMsg} reqId={reqId} validationDetails={validationDetails} showNegativeAuth={showNegativeAuth} setShowNegativeAuth={setShowNegativeAuth} setLoadedArticulos={setLoadedArticulos} type="INBOUND" idempotencyState={idempotencyState} />;
}

export function OutboundForm({ title, description }: CommonMovementFormProps) {
  const form = useForm<MovementFormValues>({
    resolver: zodResolver(outboundSchemaStrict),
    defaultValues: { articuloId: '', warehouseId: '', quantity: '', unit: 'UNIDAD', source: '', reason: '', inventoryLotId: '', authorizeNegativeStock: false, negativeStockReason: '' }
  });

  const { mutation, onSubmit, successResult, errorMsg, reqId, validationDetails, showNegativeAuth, setShowNegativeAuth, loadedArticulos, setLoadedArticulos, idempotencyState } = useMovementLogic(
    useRegisterOutbound,
    form,
    (v) => ({ ...v, reason: (v.reason as string) || undefined, inventoryLotId: (v.inventoryLotId as string) || undefined, negativeStockReason: (v.negativeStockReason as string) || undefined })
  );

  return <FormLayout form={form} onSubmit={onSubmit} mutation={mutation} title={title} description={description} successResult={successResult} errorMsg={errorMsg} reqId={reqId} validationDetails={validationDetails} showNegativeAuth={showNegativeAuth} setShowNegativeAuth={setShowNegativeAuth} setLoadedArticulos={setLoadedArticulos} type="OUTBOUND" idempotencyState={idempotencyState} />;
}

export function TransferForm({ title, description }: CommonMovementFormProps) {
  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchemaStrict),
    defaultValues: { articuloId: '', sourceWarehouseId: '', destinationWarehouseId: '', quantity: '', unit: 'UNIDAD', source: '', reason: '', inventoryLotId: '', authorizeNegativeStock: false, negativeStockReason: '' }
  });

  const { mutation, onSubmit, successResult, errorMsg, reqId, validationDetails, showNegativeAuth, setShowNegativeAuth, loadedArticulos, setLoadedArticulos, idempotencyState } = useMovementLogic(
    useTransferStock,
    form,
    (v) => ({ ...v, reason: (v.reason as string) || undefined, inventoryLotId: (v.inventoryLotId as string) || undefined, negativeStockReason: (v.negativeStockReason as string) || undefined })
  );

  return <FormLayout form={form} onSubmit={onSubmit} mutation={mutation} title={title} description={description} successResult={successResult} errorMsg={errorMsg} reqId={reqId} validationDetails={validationDetails} showNegativeAuth={showNegativeAuth} setShowNegativeAuth={setShowNegativeAuth} setLoadedArticulos={setLoadedArticulos} type="TRANSFER" idempotencyState={idempotencyState} />;
}

export function AdjustForm({ title, description }: CommonMovementFormProps) {
  const form = useForm<AdjustmentFormValues>({
    resolver: zodResolver(adjustmentSchemaStrict),
    defaultValues: { articuloId: '', warehouseId: '', quantity: '', unit: 'UNIDAD', source: '', reason: '', inventoryLotId: '', direction: 'DECREASE', authorizeNegativeStock: false, negativeStockReason: '' }
  });

  const { mutation, onSubmit, successResult, errorMsg, reqId, validationDetails, showNegativeAuth, setShowNegativeAuth, loadedArticulos, setLoadedArticulos, idempotencyState } = useMovementLogic(
    useAdjustStock,
    form,
    (v) => ({ ...v, reason: (v.reason as string) || undefined, inventoryLotId: (v.inventoryLotId as string) || undefined, negativeStockReason: (v.negativeStockReason as string) || undefined })
  );

  return <FormLayout form={form} onSubmit={onSubmit} mutation={mutation} title={title} description={description} successResult={successResult} errorMsg={errorMsg} reqId={reqId} validationDetails={validationDetails} showNegativeAuth={showNegativeAuth} setShowNegativeAuth={setShowNegativeAuth} setLoadedArticulos={setLoadedArticulos} type="ADJUST" idempotencyState={idempotencyState} />;
}

function FormLayout<TForm extends FieldValues>({
  form, onSubmit, mutation, title, description, successResult, errorMsg, reqId, validationDetails, showNegativeAuth, setShowNegativeAuth, setLoadedArticulos, type, idempotencyState
}: {
  form: UseFormReturn<TForm>;
  onSubmit: (values: TForm) => void;
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
  type: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUST';
  idempotencyState: { isRetry: boolean };
}) {
  const isPending = mutation.isPending;

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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                        <WarehouseSelect value={field.value as string} onChange={field.onChange} disabled={isPending || showNegativeAuth} />
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
                          <WarehouseSelect value={field.value as string} onChange={field.onChange} disabled={isPending || showNegativeAuth} placeholder="Almacén de salida" />
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
                          <WarehouseSelect value={field.value as string} onChange={field.onChange} disabled={isPending || showNegativeAuth} placeholder="Almacén de llegada" />
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
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar Operación
                </Button>
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}