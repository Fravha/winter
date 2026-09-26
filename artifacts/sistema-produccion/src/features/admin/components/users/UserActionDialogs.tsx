import { UserAdmin } from '@/features/admin/types/admin.types';
import { useActivateUser, useSuspendUser, useSendPasswordSetup } from '@/features/admin/api/admin.hooks';
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

interface UserActionDialogsProps {
  user: UserAdmin | null;
  action: 'ACTIVATE' | 'SUSPEND' | 'SETUP_PASSWORD' | 'NONE';
  onClose: () => void;
}

export function UserActionDialogs({ user, action, onClose }: UserActionDialogsProps) {
  const { toast } = useToast();
  const activate = useActivateUser();
  const suspend = useSuspendUser();
  const sendPassword = useSendPasswordSetup();

  if (!user || action === 'NONE') return null;

  const isPending = activate.isPending || suspend.isPending || sendPassword.isPending;
  const error = activate.error || suspend.error || sendPassword.error;

  const handleConfirm = () => {
    const opts = {
      onSuccess: () => {
        toast({ title: 'Acción exitosa', description: 'La operación se completó correctamente.' });
        onClose();
      }
    };

    if (action === 'ACTIVATE') activate.mutate(user.id, opts);
    if (action === 'SUSPEND') suspend.mutate(user.id, opts);
    if (action === 'SETUP_PASSWORD') sendPassword.mutate(user.id, opts);
  };

  const getTitle = () => {
    if (action === 'ACTIVATE') return '¿Activar usuario?';
    if (action === 'SUSPEND') return '¿Suspender usuario?';
    if (action === 'SETUP_PASSWORD') return '¿Enviar configuración de contraseña?';
    return '';
  };

  const getDescription = () => {
    if (action === 'ACTIVATE') return `El usuario ${user.email} recuperará el acceso al sistema.`;
    if (action === 'SUSPEND') return `El usuario ${user.email} perderá inmediatamente el acceso al sistema. No podrá iniciar sesión hasta ser reactivado.`;
    if (action === 'SETUP_PASSWORD') return `Se enviará un correo a ${user.email} con las instrucciones para configurar su contraseña.`;
    return '';
  };

  const getConfirmText = () => {
    if (action === 'ACTIVATE') return 'Activar';
    if (action === 'SUSPEND') return 'Suspender';
    if (action === 'SETUP_PASSWORD') return 'Enviar Correo';
    return 'Confirmar';
  };

  return (
    <AlertDialog open={true} onOpenChange={(o) => !o && !isPending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{getTitle()}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>{getDescription()}</p>
            {error && <AdminErrorAlert error={error} />}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            disabled={isPending}
            className={action === 'SUSPEND' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {isPending ? 'Procesando...' : getConfirmText()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
