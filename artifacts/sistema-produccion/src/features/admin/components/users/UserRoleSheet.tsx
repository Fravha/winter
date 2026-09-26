import { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserAdmin } from '@/features/admin/types/admin.types';
import { useReplaceUserRole, useRoles } from '@/features/admin/api/admin.hooks';
import { useAuth } from '@/auth/AuthContext';
import { AdminErrorAlert } from '../shared/admin-error-mapper';
import { Button } from '@/components/ui/button';
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

const schema = z.object({
  roleId: z.string().min(1, 'Debe seleccionar un rol'),
});

type FormValues = z.infer<typeof schema>;

export function UserRoleSheet({ user, open, onOpenChange }: { user: UserAdmin | null, open: boolean, onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const { can } = useAuth();
  const canReadRoles = can('rbac:read');
  const replaceRole = useReplaceUserRole();

  // Conditionally fetch roles only if permitted
  const { data, isLoading } = useRoles({ enabled: canReadRoles && open });
  const roles = data ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      roleId: '',
    },
  });

  useEffect(() => {
    if (open && user) {
      form.reset({
        roleId: user.role?.id || '',
      });
    }
  }, [open, user, form]);

  const onSubmit = (values: FormValues) => {
    if (!user) return;
    replaceRole.mutate(
      { id: user.id, roleId: values.roleId },
      {
        onSuccess: () => {
          toast({ title: 'Rol asignado', description: 'El rol del usuario ha sido actualizado exitosamente.' });
          onOpenChange(false);
        },
      }
    );
  };

  const isPending = replaceRole.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar Rol de Usuario</DialogTitle>
          <DialogDescription>
            {user && `Seleccione el nuevo rol para ${user.email}.`}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <AdminErrorAlert error={replaceRole.error} />

            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rol Asignado</FormLabel>
                  <FormControl>
                    {!canReadRoles ? (
                      <div className="p-3 text-sm bg-muted text-muted-foreground rounded-md border border-border">
                        No tiene permisos para ver la lista de roles.
                      </div>
                    ) : (
                      <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoading ? 'Cargando...' : 'Seleccione un rol'} />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((r: any) => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !canReadRoles}>
                {isPending ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
