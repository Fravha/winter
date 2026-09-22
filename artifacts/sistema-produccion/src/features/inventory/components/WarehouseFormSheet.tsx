import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateWarehouse, useUpdateWarehouse } from '../api/inventory.hooks';
import { createWarehouseSchema, updateWarehouseSchema, type CreateWarehouseFormValues, type UpdateWarehouseFormValues } from '../schemas/inventory.schema';
import { mapInventoryError } from '../api/inventory.error';
import { Warehouse } from '../types/inventory.types';
import { Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function CreateWarehouseForm({ open, onOpenChange, onSuccessClose, onPendingChange }: { open: boolean, onOpenChange: (open: boolean) => void, onSuccessClose: () => void, onPendingChange: (pending: boolean) => void }) {
  const { toast } = useToast();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reqId, setReqId] = useState<string | null>(null);
  const [validationDetails, setValidationDetails] = useState<unknown>(null);

  const form = useForm<CreateWarehouseFormValues>({
    resolver: zodResolver(createWarehouseSchema),
    defaultValues: { codigo: '', nombre: '', ubicacion: '', encargadoUserId: '', observaciones: '' },
  });

  useEffect(() => {
    if (open) {
      form.reset({ codigo: '', nombre: '', ubicacion: '', encargadoUserId: '', observaciones: '' });
      setErrorMsg(null);
      setReqId(null);
      setValidationDetails(null);
    }
  }, [open, form]);

  const createMutation = useCreateWarehouse({
    onSuccess: () => {
      toast({ title: 'Almacén creado exitosamente' });
      onSuccessClose();
    },
    onError: (err) => {
      const mapped = mapInventoryError(err);
      setErrorMsg(mapped.userMessage);
      setReqId(mapped.requestId || null);
      setValidationDetails(mapped.details ?? null);
    },
  });

  const isPending = createMutation.isPending;
  useEffect(() => onPendingChange(isPending), [isPending, onPendingChange]);

  const onSubmit = (values: CreateWarehouseFormValues) => {
    setErrorMsg(null);
    setReqId(null);
    setValidationDetails(null);

    const cleanOptional = (val: string | undefined) => {
      const trimmed = val?.trim();
      return trimmed === '' ? undefined : trimmed;
    };

    createMutation.mutate({
      codigo: values.codigo.trim(),
      nombre: values.nombre.trim(),
      ubicacion: cleanOptional(values.ubicacion),
      encargadoUserId: cleanOptional(values.encargadoUserId),
      observaciones: cleanOptional(values.observaciones),
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="codigo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Código *</FormLabel>
              <FormControl><Input placeholder="Ej. ALM-01" {...field} disabled={isPending} data-testid="input-codigo" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre *</FormLabel>
              <FormControl><Input placeholder="Nombre descriptivo" {...field} disabled={isPending} data-testid="input-nombre" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ubicacion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ubicación</FormLabel>
              <FormControl><Input placeholder="Opcional" {...field} value={field.value || ''} disabled={isPending} data-testid="input-ubicacion" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="encargadoUserId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ID Encargado (UUID)</FormLabel>
              <FormControl><Input placeholder="Opcional (UUID)" {...field} value={field.value || ''} disabled={isPending} data-testid="input-encargado" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="observaciones"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observaciones</FormLabel>
              <FormControl><Textarea placeholder="Notas adicionales..." className="resize-none" {...field} value={field.value || ''} disabled={isPending} data-testid="input-observaciones" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {errorMsg && (
          <div className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-md border border-destructive/20">
            <div className="flex items-center mb-1"><AlertCircle className="h-4 w-4 mr-2" />{errorMsg}</div>
            {reqId && <span className="block text-xs opacity-80 mt-1">Req ID: {reqId}</span>}
            {Boolean(validationDetails) && <div className="mt-2 text-xs bg-destructive/20 p-2 rounded font-mono overflow-auto max-h-32">{JSON.stringify(validationDetails, null, 2)}</div>}
          </div>
        )}
        <SheetFooter className="mt-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending} data-testid="button-cancel">Cancelar</Button>
          <Button type="submit" disabled={isPending} data-testid="button-submit" className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />} Crear Almacén
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}

function EditWarehouseForm({ open, onOpenChange, onSuccessClose, onPendingChange, warehouse }: { open: boolean, onOpenChange: (open: boolean) => void, onSuccessClose: () => void, onPendingChange: (pending: boolean) => void, warehouse: Warehouse }) {
  const { toast } = useToast();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reqId, setReqId] = useState<string | null>(null);
  const [validationDetails, setValidationDetails] = useState<unknown>(null);

  const form = useForm<UpdateWarehouseFormValues>({
    resolver: zodResolver(updateWarehouseSchema),
    defaultValues: { nombre: '', ubicacion: '', encargadoUserId: '', observaciones: '' },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        nombre: warehouse.nombre,
        ubicacion: warehouse.ubicacion || '',
        encargadoUserId: warehouse.encargadoUserId || '',
        observaciones: warehouse.observaciones || '',
      });
      setErrorMsg(null);
      setReqId(null);
      setValidationDetails(null);
    }
  }, [open, warehouse, form]);

  const updateMutation = useUpdateWarehouse({
    onSuccess: () => {
      toast({ title: 'Almacén actualizado exitosamente' });
      onSuccessClose();
    },
    onError: (err) => {
      const mapped = mapInventoryError(err);
      setErrorMsg(mapped.userMessage);
      setReqId(mapped.requestId || null);
      setValidationDetails(mapped.details ?? null);
    },
  });

  const isPending = updateMutation.isPending;
  useEffect(() => onPendingChange(isPending), [isPending, onPendingChange]);

  const onSubmit = (values: UpdateWarehouseFormValues) => {
    setErrorMsg(null);
    setReqId(null);
    setValidationDetails(null);

    const cleanOptional = (val: string | undefined) => {
      const trimmed = val?.trim();
      return trimmed === '' ? undefined : trimmed;
    };

    updateMutation.mutate({
      id: warehouse.id,
      input: {
        nombre: values.nombre.trim(),
        ubicacion: cleanOptional(values.ubicacion),
        encargadoUserId: cleanOptional(values.encargadoUserId),
        observaciones: cleanOptional(values.observaciones),
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormItem>
          <FormLabel>Código</FormLabel>
          <FormControl><Input value={warehouse.codigo} disabled className="bg-muted font-mono" /></FormControl>
        </FormItem>
        <FormField
          control={form.control}
          name="nombre"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre *</FormLabel>
              <FormControl><Input placeholder="Nombre descriptivo" {...field} disabled={isPending} data-testid="input-nombre" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ubicacion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ubicación</FormLabel>
              <FormControl><Input placeholder="Dejar en blanco para mantener" {...field} value={field.value || ''} disabled={isPending} data-testid="input-ubicacion" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="encargadoUserId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ID Encargado (UUID)</FormLabel>
              <FormControl><Input placeholder="Dejar en blanco para mantener" {...field} value={field.value || ''} disabled={isPending} data-testid="input-encargado" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="observaciones"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observaciones</FormLabel>
              <FormControl><Textarea placeholder="Dejar en blanco para mantener" className="resize-none" {...field} value={field.value || ''} disabled={isPending} data-testid="input-observaciones" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {errorMsg && (
          <div className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-md border border-destructive/20">
            <div className="flex items-center mb-1"><AlertCircle className="h-4 w-4 mr-2" />{errorMsg}</div>
            {reqId && <span className="block text-xs opacity-80 mt-1">Req ID: {reqId}</span>}
            {Boolean(validationDetails) && <div className="mt-2 text-xs bg-destructive/20 p-2 rounded font-mono overflow-auto max-h-32">{JSON.stringify(validationDetails, null, 2)}</div>}
          </div>
        )}
        <SheetFooter className="mt-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending} data-testid="button-cancel">Cancelar</Button>
          <Button type="submit" disabled={isPending} data-testid="button-submit" className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar Cambios
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}

interface WarehouseFormSheetProps {
  mode: 'CREATE' | 'EDIT';
  warehouse: Warehouse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WarehouseFormSheet({ mode, warehouse, open, onOpenChange }: WarehouseFormSheetProps) {
  const isEdit = mode === 'EDIT';
  const [isPending, setIsPending] = useState(false);
  const handleOpenChange = (nextOpen: boolean) => {
    if (!isPending || nextOpen) onOpenChange(nextOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent 
        className="w-full sm:max-w-md overflow-y-auto" 
        data-testid="sheet-warehouse-form"
        onEscapeKeyDown={(event) => {
          if (isPending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (isPending) event.preventDefault();
        }}
      >
        <SheetHeader className="mb-4">
          <SheetTitle>{isEdit ? 'Editar Almacén' : 'Nuevo Almacén'}</SheetTitle>
          <SheetDescription>
            {isEdit ? 'Modifica los datos del almacén.' : 'Ingresa los datos para registrar un nuevo almacén.'}
          </SheetDescription>
        </SheetHeader>
        {isEdit && warehouse ? (
          <EditWarehouseForm open={open} onOpenChange={handleOpenChange} onSuccessClose={() => onOpenChange(false)} onPendingChange={setIsPending} warehouse={warehouse} />
        ) : (
          <CreateWarehouseForm open={open} onOpenChange={handleOpenChange} onSuccessClose={() => onOpenChange(false)} onPendingChange={setIsPending} />
        )}
      </SheetContent>
    </Sheet>
  );
}