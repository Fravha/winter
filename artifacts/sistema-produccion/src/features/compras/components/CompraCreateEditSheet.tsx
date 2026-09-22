import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateCompra, useUpdateCompra } from '../api/compras.hooks';
import { createCompraSchema, type CreateCompraFormValues } from '../schemas/compra.schema';
import { mapCompraError } from '../api/compras.error';
import {
  COMPRA_UNITS,
  type Compra,
  type CompraItemInput,
  type CreateCompraInput,
  type UpdateCompraInput,
} from '../types/compra.types';
import { useArticulos } from '../../articulos/api/articulos.hooks';
import { Loader2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { comprasKeys } from '../api/compras.keys';

interface CompraCreateEditSheetProps {
  mode: 'CREATE' | 'EDIT';
  compra: Compra | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompraCreateEditSheet({ mode, compra, open, onOpenChange }: CompraCreateEditSheetProps) {
  const isEdit = mode === 'EDIT';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reqId, setReqId] = useState<string | null>(null);
  const [validationDetails, setValidationDetails] = useState<unknown>(null);

  const { data: articulosData, isLoading: isLoadingArticulos, error: articulosError, refetch: refetchArticulos } = useArticulos(
    { activo: true, page: 1, pageSize: 100 },
    { enabled: open }
  );
  const articulos = articulosData?.items || [];
  const mappedArticulosError = articulosError ? mapCompraError(articulosError) : null;

  const handleError = (err: unknown) => {
    const mapped = mapCompraError(err);
    setErrorMsg(mapped.userMessage);
    setReqId(mapped.requestId || null);
    setValidationDetails(mapped.details ?? null);

    if (['COMPRA_NOT_EDITABLE', 'COMPRA_NOT_RECEIVABLE', 'COMPRA_NOT_CANCELLABLE', 'COMPRA_TRANSITION_FAILED'].includes(mapped.code)) {
      queryClient.invalidateQueries({ queryKey: comprasKeys.lists() });
      if (compra) {
        queryClient.invalidateQueries({ queryKey: comprasKeys.detail(compra.id) });
      }
    }
  };

  const createMutation = useCreateCompra({
    onSuccess: () => {
      toast({ title: 'Compra registrada exitosamente' });
      onOpenChange(false);
    },
    onError: handleError,
  });

  const updateMutation = useUpdateCompra({
    onSuccess: () => {
      toast({ title: 'Compra actualizada exitosamente' });
      onOpenChange(false);
    },
    onError: handleError,
  });

  const form = useForm<CreateCompraFormValues>({
    resolver: zodResolver(createCompraSchema),
    defaultValues: {
      supplierName: '',
      supplierTaxId: '',
      documentNumber: '',
      documentDate: '',
      currency: '',
      observations: '',
      items: [{ articuloId: '', brand: '', requestedQuantity: '', unit: 'UNIDAD', unitPrice: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      setReqId(null);
      setValidationDetails(null);

      if (isEdit && compra) {
        form.reset({
          supplierName: compra.supplierName,
          supplierTaxId: compra.supplierTaxId || '',
          documentNumber: compra.documentNumber || '',
          documentDate: compra.documentDate ? compra.documentDate.split('T')[0] + 'T00:00:00.000Z' : '',
          currency: compra.currency || '',
          observations: compra.observations || '',
          items: compra.items.map(item => ({
            articuloId: item.articuloId,
            brand: item.brand || '',
            requestedQuantity: item.requestedQuantity,
            unit: item.unit,
            unitPrice: item.unitPrice || '',
          })),
        });
      } else {
        form.reset({
          supplierName: '',
          supplierTaxId: '',
          documentNumber: '',
          documentDate: '',
          currency: '',
          observations: '',
          items: [{ articuloId: '', brand: '', requestedQuantity: '', unit: 'UNIDAD', unitPrice: '' }],
        });
      }
    }
  }, [open, isEdit, compra, form]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleOpenChange = (newOpen: boolean) => {
    if (isPending) return;
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  const onSubmit = (values: CreateCompraFormValues) => {
    setErrorMsg(null);
    setReqId(null);
    setValidationDetails(null);

    const formattedItems: CompraItemInput[] = values.items.map((i) => {
      const item: CompraItemInput = {
        articuloId: i.articuloId,
        requestedQuantity: i.requestedQuantity,
        unit: i.unit,
      };
      return {
        ...item,
        ...(i.brand?.trim() ? { brand: i.brand.trim() } : {}),
        ...(i.unitPrice?.trim() ? { unitPrice: i.unitPrice.trim() } : {}),
      };
    });

    if (isEdit && compra) {
      const input: UpdateCompraInput = {
        supplierName: values.supplierName.trim(),
        supplierTaxId: values.supplierTaxId?.trim() || null,
        documentNumber: values.documentNumber?.trim() || null,
        documentDate: values.documentDate ? new Date(values.documentDate).toISOString() : null,
        currency: values.currency?.trim() || null,
        observations: values.observations?.trim() || null,
        items: formattedItems,
      };
      updateMutation.mutate({ id: compra.id, input });
    } else {
      const input: CreateCompraInput = {
        supplierName: values.supplierName.trim(),
        items: formattedItems,
        ...(values.supplierTaxId?.trim() ? { supplierTaxId: values.supplierTaxId.trim() } : {}),
        ...(values.documentNumber?.trim() ? { documentNumber: values.documentNumber.trim() } : {}),
        ...(values.documentDate ? { documentDate: new Date(values.documentDate).toISOString() } : {}),
        ...(values.currency?.trim() ? { currency: values.currency.trim() } : {}),
        ...(values.observations?.trim() ? { observations: values.observations.trim() } : {}),
      };
      createMutation.mutate(input);
    }
  };

  const existingCount = isEdit && compra ? compra.items.length : 0;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        className="w-full sm:max-w-xl md:max-w-3xl overflow-y-auto"
        data-testid="sheet-compra-form"
        onInteractOutside={(e) => { if (isPending) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (isPending) e.preventDefault(); }}
      >
        <SheetHeader className="mb-4">
          <SheetTitle>{isEdit ? 'Editar Compra' : 'Registrar Nueva Compra'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Modifica los detalles de la compra registrada.' : 'Ingresa los datos para una nueva compra.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="supplierName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proveedor *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre del proveedor" {...field} data-testid="input-supplier-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supplierTaxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NIT / CI</FormLabel>
                    <FormControl>
                      <Input placeholder="Documento tributario" {...field} value={field.value || ''} data-testid="input-supplier-tax" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="documentNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nro. Documento</FormLabel>
                    <FormControl>
                      <Input placeholder="Factura, recibo..." {...field} value={field.value || ''} data-testid="input-doc-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="documentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Documento</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ? field.value.split('T')[0] : ''}
                        onChange={(e) => {
                          const dateVal = e.target.value;
                          field.onChange(dateVal ? `${dateVal}T00:00:00.000Z` : '');
                        }}
                        data-testid="input-doc-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. BOB" {...field} value={field.value || ''} data-testid="input-currency" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Notas adicionales..." className="resize-none" {...field} value={field.value || ''} data-testid="input-observations" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold tracking-tight">Artículos</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ articuloId: '', brand: '', requestedQuantity: '', unit: 'UNIDAD', unitPrice: '' })}
                  data-testid="button-add-item"
                >
                  <Plus className="h-4 w-4 mr-1" /> Agregar
                </Button>
              </div>

              {articulosError && (
                <div className="mb-4 text-sm text-destructive bg-destructive/10 p-3 rounded-md flex flex-col gap-2 border border-destructive/20 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">
                    <span className="flex items-center"><AlertCircle className="h-4 w-4 mr-2" /> No fue posible cargar los artículos activos.</span>
                    {mappedArticulosError?.requestId && (
                      <span className="mt-1 block font-mono text-xs">Req ID: {mappedArticulosError.requestId}</span>
                    )}
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => refetchArticulos()} className="border-destructive/30 hover:bg-destructive/20 text-destructive">Reintentar</Button>
                </div>
              )}

              <div className="space-y-4">
                {fields.map((field, index) => {
                  const isExistingItem = isEdit && index < existingCount;

                  return (
                    <div key={field.id} className="p-4 bg-muted/30 rounded-lg border relative grid gap-4 grid-cols-1 md:grid-cols-12 items-start" data-testid={`item-row-${index}`}>
                      <div className="md:col-span-12 flex justify-between items-center mb-[-12px]">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Línea {index + 1}</span>
                        {!isExistingItem && fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => remove(index)}
                            data-testid={`button-remove-item-${index}`}
                            aria-label={`Eliminar línea ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        {isExistingItem && (
                          <span className="text-[10px] text-muted-foreground italic px-2 py-0.5 bg-muted rounded-sm border">Registrado</span>
                        )}
                      </div>

                      <div className="md:col-span-5">
                        <FormField
                          control={form.control}
                          name={`items.${index}.articuloId`}
                          render={({ field: itemField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Artículo *</FormLabel>
                              <Select
                                onValueChange={(val) => {
                                  itemField.onChange(val);
                                  const selectedArt = articulos.find(a => a.id === val);
                                  if (selectedArt) {
                                    form.setValue(`items.${index}.unit`, selectedArt.unidadMedida);
                                  }
                                }}
                                value={itemField.value}
                                disabled={isLoadingArticulos || isExistingItem}
                              >
                                <FormControl>
                                  <SelectTrigger data-testid={`select-articulo-${index}`}>
                                    <SelectValue placeholder={isLoadingArticulos ? "Cargando..." : "Seleccionar"} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {articulos.map(a => (
                                    <SelectItem key={a.id} value={a.id}>{a.codigo} - {a.nombre}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="md:col-span-3">
                        <FormField
                          control={form.control}
                          name={`items.${index}.brand`}
                          render={({ field: itemField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Marca</FormLabel>
                              <FormControl>
                                <Input placeholder="Opcional" maxLength={150} {...itemField} value={itemField.value || ''} data-testid={`input-brand-${index}`} />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.requestedQuantity`}
                          render={({ field: itemField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Cantidad *</FormLabel>
                              <FormControl>
                                <Input placeholder="Ej: 100" {...itemField} data-testid={`input-qty-${index}`} />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <FormField
                          control={form.control}
                          name={`items.${index}.unit`}
                          render={({ field: itemField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Unidad</FormLabel>
                              <Select onValueChange={itemField.onChange} value={itemField.value} disabled>
                                <FormControl>
                                  <SelectTrigger className="bg-muted text-muted-foreground opacity-100" data-testid={`select-unit-${index}`}>
                                    <SelectValue placeholder="Unidad" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {COMPRA_UNITS.map(u => (
                                    <SelectItem key={u} value={u}>{u}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="md:col-span-4">
                        <FormField
                          control={form.control}
                          name={`items.${index}.unitPrice`}
                          render={({ field: itemField }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Precio Unit. (Opcional)</FormLabel>
                              <FormControl>
                                <Input placeholder="Ej: 15.50" {...itemField} value={itemField.value || ''} data-testid={`input-price-${index}`} />
                              </FormControl>
                              <FormMessage className="text-xs" />
                            </FormItem>
                          )}
                        />
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            {errorMsg && (
              <div className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-md border border-destructive/20">
                <div className="flex items-center mb-1">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {errorMsg}
                </div>
                {reqId && <span className="block text-xs opacity-80 mt-1">Req ID: {reqId}</span>}
                {validationDetails ? (
                  <div className="mt-2 text-xs bg-destructive/20 p-2 rounded max-h-32 overflow-y-auto font-mono">
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

            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending} data-testid="button-form-cancel">
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-form-submit" className="gap-2">
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? 'Guardar Cambios' : 'Registrar Compra'}
              </Button>
            </SheetFooter>

          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
