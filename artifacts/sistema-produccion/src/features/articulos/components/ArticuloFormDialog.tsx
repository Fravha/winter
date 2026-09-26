import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api/api-error';
import { AlertCircle, RefreshCw } from 'lucide-react';

import { useArticulo, useCreateArticulo, useUpdateArticulo } from '../api/articulos.hooks';
import { articuloFormSchema, createArticuloSchema, type CreateArticuloFormValues } from '../schemas/articulo.schema';
import {
  CLASIFICACION_OPTIONS,
  getClasificacionLabel,
  isClasificacionOficial,
  UNIDAD_MEDIDA_OPTIONS,
} from '../types/articulo.options';
import { Skeleton } from '@/components/ui/skeleton';
import { getArticuloErrorMessage, withRequestId } from '../articulo-error';

type ArticuloFormDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  articuloId?: string | null;
};

export function ArticuloFormDialog({ isOpen, onClose, articuloId }: ArticuloFormDialogProps) {
  const { toast } = useToast();
  const isEdit = Boolean(articuloId);

  const { data: articulo, isLoading: isFetching, error: detailError, refetch: refetchDetail } = useArticulo(articuloId as string, {
    enabled: isEdit && isOpen,
  });

  const createMutation = useCreateArticulo();
  const updateMutation = useUpdateArticulo();

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const defaultValues: CreateArticuloFormValues = {
    codigo: '',
    codigoExterno: '',
    nombre: '',
    clasificacion: 'MATERIA_PRIMA',
    unidadMedida: 'UNIDAD',
  };

  const form = useForm<CreateArticuloFormValues>({
    resolver: zodResolver(articuloFormSchema),
    defaultValues,
  });

  const closeDialog = () => {
    createMutation.reset();
    updateMutation.reset();
    form.reset(defaultValues);
    onClose();
  };

  const handleClose = () => {
    if (isSubmitting) return;
    closeDialog();
  };

  useEffect(() => {
    if (isOpen) {
      if (isEdit && articulo) {
        form.reset({
          codigo: articulo.codigo,
          codigoExterno: articulo.codigoExterno || '',
          nombre: articulo.nombre,
          clasificacion: articulo.clasificacion,
          unidadMedida: articulo.unidadMedida,
        });
      } else if (!isEdit) {
        form.reset(defaultValues);
      }
    }
  }, [isOpen, isEdit, articulo, form]);

  const onSubmit = (values: CreateArticuloFormValues) => {
    if (isEdit && articuloId) {
      const updateInput = {
        codigoExterno: values.codigoExterno?.trim() || null,
        nombre: values.nombre.trim(),
        unidadMedida: values.unidadMedida,
      };
      updateMutation.mutate(
        { 
          id: articuloId, 
          input: {
            ...updateInput,
            ...(isClasificacionOficial(values.clasificacion) ? { clasificacion: values.clasificacion } : {}),
          }
        },
        {
          onSuccess: () => {
            toast({ title: 'Artículo actualizado exitosamente' });
            closeDialog();
          },
          onError: handleError
        }
      );
    } else {
      const parsed = createArticuloSchema.safeParse(values);
      if (!parsed.success) {
        form.setError('clasificacion', { type: 'manual', message: 'Seleccione una clasificación oficial.' });
        return;
      }
      createMutation.mutate(
        {
          ...parsed.data,
          codigoExterno: parsed.data.codigoExterno || undefined,
        },
        {
          onSuccess: () => {
            toast({ title: 'Artículo creado exitosamente' });
            closeDialog();
          },
          onError: handleError
        }
      );
    }
  };

  const handleError = (error: Error) => {
    const message = getArticuloErrorMessage(error, 'No fue posible guardar el artículo.');
    if (error instanceof ApiError && error.code === 'ARTICULO_CODE_ALREADY_EXISTS') {
      form.setError('codigo', { type: 'manual', message: 'Código duplicado' });
    }
    toast({
      variant: 'destructive',
      title: 'Error al guardar',
      description: withRequestId(message, error),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Artículo' : 'Nuevo Artículo'}</DialogTitle>
          <DialogDescription>
            {isEdit 
              ? 'Modifique los datos del artículo. Los campos operativos no se pueden cambiar si ya existen movimientos.'
              : 'Ingrese los datos básicos para dar de alta un nuevo artículo en el catálogo maestro.'
            }
          </DialogDescription>
        </DialogHeader>

        {isEdit && isFetching ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isEdit && detailError ? (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-4">
            <AlertCircle className="h-10 w-10 text-destructive opacity-80" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Error al cargar el artículo</p>
              <p className="text-sm text-muted-foreground">
                {detailError instanceof ApiError && detailError.code === 'ARTICULO_NOT_FOUND'
                  ? 'El artículo solicitado no existe o ya no está disponible.'
                  : 'No fue posible obtener la información del artículo.'}
              </p>
              {detailError instanceof ApiError && detailError.requestId && (
                <p className="text-xs text-muted-foreground font-mono mt-1">Req ID: {detailError.requestId}</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchDetail()} className="mt-2">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="codigo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código Interno</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          disabled={isEdit || isSubmitting} 
                          placeholder="Ej: MP-001" 
                          data-testid="input-codigo"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="codigoExterno"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código Externo (Opcional)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value)}
                          disabled={isSubmitting} 
                          placeholder="Ej: SAP-8992" 
                          data-testid="input-codigo-externo"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre o Descripción</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        disabled={isSubmitting} 
                        placeholder="Ej: Botella Vidrio 750ml" 
                        data-testid="input-nombre"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="clasificacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clasificación</FormLabel>
                      {isEdit && articulo && !isClasificacionOficial(articulo.clasificacion) && (
                        <p className="text-xs text-muted-foreground" data-testid="legacy-clasificacion-readonly">
                          Actual: {getClasificacionLabel(articulo.clasificacion)} (legacy; se conserva si no elige una clasificación oficial)
                        </p>
                      )}
                      <Select
                        disabled={isSubmitting}
                        onValueChange={field.onChange}
                        value={isClasificacionOficial(field.value) ? field.value : ''}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-form-clasificacion">
                            <SelectValue placeholder={isEdit ? 'Sin cambios; elija para reemplazar' : 'Seleccione...'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CLASIFICACION_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
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
                  name="unidadMedida"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidad de Medida</FormLabel>
                      <Select 
                        disabled={isSubmitting} 
                        onValueChange={field.onChange} 
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-form-unidad">
                            <SelectValue placeholder="Seleccione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {UNIDAD_MEDIDA_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleClose} 
                  disabled={isSubmitting}
                  data-testid="btn-cancel-form"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  data-testid="btn-submit-form"
                >
                  {isEdit 
                    ? (isSubmitting ? 'Guardando...' : 'Guardar') 
                    : (isSubmitting ? 'Creando...' : 'Crear Artículo')
                  }
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
