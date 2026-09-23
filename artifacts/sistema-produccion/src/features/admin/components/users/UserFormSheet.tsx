import { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserAdmin } from '@/features/admin/types/admin.types';
import { useCreateUser, useUpdateUser, useRoles } from '@/features/admin/api/admin.hooks';
import { AdminErrorAlert } from '../shared/admin-error-mapper';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const userSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  displayName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional().or(z.literal('')),
  roleId: z.string().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

interface UserFormSheetProps {
  user: UserAdmin | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function RoleSelect({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const { data, isLoading, error } = useRoles();
  const roles = data ?? [];

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-2 border rounded-md px-3 bg-muted/20">Cargando roles...</div>;
  }
  if (error) return <AdminErrorAlert error={error} />;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Seleccione un rol" />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r: any) => (
          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function UserFormSheet({ user, open, onOpenChange }: UserFormSheetProps) {
  const isEditing = !!user;
  const { can } = useAuth();
  const canReadRoles = can('rbac:read');
  const { toast } = useToast();

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: '',
      displayName: '',
      roleId: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (user) {
        form.reset({
          email: user.email,
          displayName: user.displayName || '',
          roleId: user.role?.id || '',
        });
      } else {
        form.reset({ email: '', displayName: '', roleId: '' });
      }
    }
  }, [open, user, form]);

  const onSubmit = (values: UserFormValues) => {
    if (isEditing && user) {
      updateUser.mutate(
        { id: user.id, input: { email: values.email, displayName: values.displayName || null } },
        {
          onSuccess: () => {
            toast({ title: 'Usuario actualizado', description: 'Los datos del usuario se guardaron correctamente.' });
            onOpenChange(false);
          },
        }
      );
    } else {
      if (!canReadRoles || !values.roleId) {
        form.setError('roleId', { message: 'Seleccione un rol antes de crear el usuario.' });
        return;
      }
      createUser.mutate(
        { email: values.email, displayName: values.displayName || undefined, roleId: values.roleId },
        {
          onSuccess: () => {
            toast({ title: 'Usuario creado', description: 'El nuevo usuario se creó correctamente.' });
            onOpenChange(false);
          },
        }
      );
    }
  };

  const isPending = createUser.isPending || updateUser.isPending;
  const error = createUser.error || updateUser.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifique los datos básicos del usuario.' : 'Cree un nuevo usuario y asigne su rol inicial.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <AdminErrorAlert error={error} />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo Electrónico</FormLabel>
                  <FormControl>
                    <Input placeholder="usuario@empresa.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre a mostrar (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Juan Pérez" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEditing && (
              <FormField
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol Inicial</FormLabel>
                    <FormControl>
                      {canReadRoles ? (
                        <RoleSelect value={field.value} onChange={field.onChange} />
                      ) : (
                        <div className="p-3 text-sm bg-muted text-muted-foreground rounded-md border border-border">
                          No tiene permisos para consultar roles. La creación requiere un rol.
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || (!isEditing && !canReadRoles)}>
                {isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
