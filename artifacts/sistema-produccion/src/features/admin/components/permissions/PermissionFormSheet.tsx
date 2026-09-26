import { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PermissionAdmin } from '@/features/admin/types/admin.types';
import { useCreatePermission, useUpdatePermission } from '@/features/admin/api/admin.hooks';
import { AdminErrorAlert } from '../shared/admin-error-mapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';

const schema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  code: z.string().min(2, 'El código debe tener al menos 2 caracteres').regex(/^[a-z0-9:]+$/, 'El código solo debe contener letras minúsculas, números y dos puntos (ej. modulo:accion)'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface PermissionFormSheetProps {
  permission: PermissionAdmin | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PermissionFormSheet({ permission, open, onOpenChange }: PermissionFormSheetProps) {
  const isEditing = !!permission;
  const { toast } = useToast();

  const createPerm = useCreatePermission();
  const updatePerm = useUpdatePermission();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (permission) {
        form.reset({
          name: permission.name,
          code: permission.code,
          description: permission.description || '',
        });
      } else {
        form.reset({ name: '', code: '', description: '' });
      }
    }
  }, [open, permission, form]);

  const onSubmit = (values: FormValues) => {
    if (isEditing && permission) {
      updatePerm.mutate(
        { id: permission.id, input: { name: values.name, code: values.code, description: values.description || null } },
        {
          onSuccess: () => {
            toast({ title: 'Permiso actualizado', description: 'Los datos del permiso se guardaron correctamente.' });
            onOpenChange(false);
          },
        }
      );
    } else {
      createPerm.mutate(
        { code: values.code, name: values.name, description: values.description || undefined },
        {
          onSuccess: () => {
            toast({ title: 'Permiso creado', description: 'El nuevo permiso se creó correctamente.' });
            onOpenChange(false);
          },
        }
      );
    }
  };

  const isPending = createPerm.isPending || updatePerm.isPending;
  const error = createPerm.error || updatePerm.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Permiso' : 'Nuevo Permiso'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifique los datos del permiso.' : 'Registre un nuevo permiso en el sistema.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <AdminErrorAlert error={error} />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Permiso</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Leer Usuarios" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código</FormLabel>
                  <FormControl>
                    <Input placeholder="ej. users:read" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Para qué sirve este permiso..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
