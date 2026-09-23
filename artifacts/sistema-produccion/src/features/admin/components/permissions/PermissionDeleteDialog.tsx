import { PermissionAdmin } from '@/features/admin/types/admin.types';
import { useDeletePermission } from '@/features/admin/api/admin.hooks';
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

export function PermissionDeleteDialog({ permission, open, onClose }: { permission: PermissionAdmin | null, open: boolean, onClose: () => void }) {
  const { toast } = useToast();
  const deletePerm = useDeletePermission();

  if (!permission) return null;

  const isPending = deletePerm.isPending;
  const error = deletePerm.error;

  const handleConfirm = () => {
    deletePerm.mutate(permission.id, {
      onSuccess: () => {
        toast({ title: 'Permiso eliminado', description: 'El permiso ha sido eliminado exitosamente.' });
        onClose();
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && !isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar el permiso "{permission.name}"?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              Esta acción eliminará el permiso del sistema. No se puede eliminar si está asignado a uno o más roles en este momento.
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
            {isPending ? 'Eliminando...' : 'Sí, Eliminar Permiso'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
