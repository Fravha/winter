import { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RoleAdmin } from '@/features/admin/types/admin.types';
import { useCreateRole, useUpdateRole } from '@/features/admin/api/admin.hooks';
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
  code: z.string().min(2, 'El código debe tener al menos 2 caracteres'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface RoleFormSheetProps {
  role: RoleAdmin | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoleFormSheet({ role, open, onOpenChange }: RoleFormSheetProps) {
  const isEditing = !!role;
  const { toast } = useToast();

  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

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
      if (role) {
        form.reset({
          name: role.name,
          code: role.code, // read-only during edit, but set it for display
          description: role.description || '',
        });
      } else {
        form.reset({ name: '', code: '', description: '' });
      }
    }
  }, [open, role, form]);

  const onSubmit = (values: FormValues) => {
    if (isEditing && role) {
      updateRole.mutate(
        { id: role.id, input: { name: values.name, description: values.description || null } },
        {
          onSuccess: () => {
            toast({ title: 'Rol actualizado', description: 'Los datos del rol se guardaron correctamente.' });
            onOpenChange(false);
          },
        }
      );
    } else {
      createRole.mutate(
        { code: values.code, name: values.name, description: values.description || undefined },
        {
          onSuccess: () => {
            toast({ title: 'Rol creado', description: 'El nuevo rol se creó correctamente.' });
            onOpenChange(false);
          },
        }
      );
    }
  };

  const isPending = createRole.isPending || updateRole.isPending;
  const error = createRole.error || updateRole.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Rol' : 'Nuevo Rol'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifique los datos básicos del rol. El código no puede ser editado.' : 'Cree un nuevo rol agrupador de permisos.'}
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
                  <FormLabel>Nombre del Rol</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. Administrador" {...field} />
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
                    <Input
                      placeholder="ej. ADMIN"
                      {...field}
                      disabled={isEditing}
                      className={isEditing ? 'bg-muted/50 cursor-not-allowed' : ''}
                    />
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
                    <Textarea placeholder="Breve descripción del rol..." {...field} />
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
