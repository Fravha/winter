import { RoleAdmin } from '@/features/admin/types/admin.types';
import { useDeleteRole } from '@/features/admin/api/admin.hooks';
import { AdminErrorAlert } from '../shared/admin-error-mapper';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

export function RoleDeleteDialog({ role, open, onClose }: { role: RoleAdmin | null, open: boolean, onClose: () => void }) {
  const { toast } = useToast();
  const deleteRole = useDeleteRole();

  if (!role) return null;

  const isPending = deleteRole.isPending;
  const error = deleteRole.error;

  const handleConfirm = () => {
    deleteRole.mutate(role.id, {
      onSuccess: () => {
        toast({ title: 'Rol eliminado', description: 'El rol ha sido eliminado (soft delete) exitosamente.' });
        onClose();
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && !isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar el rol "{role.name}"?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              Esta acción no puede deshacerse de forma manual desde la interfaz.
              Los usuarios que posean este rol perderán sus capacidades si el rol es eliminado.
            </p>
            {error && <AdminErrorAlert error={error} />}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? 'Eliminando...' : 'Sí, Eliminar Rol'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
