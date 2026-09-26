import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useUser } from '@/features/admin/api/admin.hooks';
import { useAuth } from '@/auth/AuthContext';
import { AdminErrorAlert } from '../shared/admin-error-mapper';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export function UserDetailDialog({ userId, open, onOpenChange }: { userId: string | null, open: boolean, onOpenChange: (o: boolean) => void }) {
  const { can } = useAuth();
  const canRead = can('users:read');

  const { data: user, isLoading, error } = useUser(userId || '', {
    enabled: open && !!userId && canRead,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalle del Usuario</DialogTitle>
          <DialogDescription>
            Información general del usuario seleccionado.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {!canRead && (
            <div className="p-4 text-center text-muted-foreground border rounded-md">
              No tiene permisos para ver el detalle de usuarios.
            </div>
          )}

          {canRead && isLoading && (
            <div className="flex flex-col items-center justify-center p-6 space-y-3">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Cargando información...</p>
            </div>
          )}

          {canRead && error && !isLoading && (
            <AdminErrorAlert error={error} />
          )}

          {canRead && user && !isLoading && !error && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 py-2 border-b">
                <span className="text-sm font-medium text-muted-foreground">Nombre:</span>
                <span className="col-span-2 text-sm text-foreground font-medium">{user.displayName || 'Sin nombre'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b">
                <span className="text-sm font-medium text-muted-foreground">Email:</span>
                <span className="col-span-2 text-sm text-foreground">{user.email}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b">
                <span className="text-sm font-medium text-muted-foreground">Estado:</span>
                <span className="col-span-2 text-sm">
                  {user.status === 'ACTIVE' && <Badge variant="default" className="bg-success/15 text-success hover:bg-success/25 border-success/20">Activo</Badge>}
                  {user.status === 'PENDING' && <Badge variant="outline" className="bg-warning/15 text-warning-foreground hover:bg-warning/25 border-warning/30">Pendiente</Badge>}
                  {user.status === 'SUSPENDED' && <Badge variant="destructive" className="bg-destructive/15 text-destructive hover:bg-destructive/25 border-destructive/20">Suspendido</Badge>}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b">
                <span className="text-sm font-medium text-muted-foreground">Rol:</span>
                <span className="col-span-2 text-sm">
                  {user.role ? (
                    <Badge variant="outline" className="font-normal">{user.role.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground italic">Sin rol</span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 py-2 border-b">
                <span className="text-sm font-medium text-muted-foreground">Último Acceso:</span>
                <span className="col-span-2 text-sm text-muted-foreground">
                  {user.lastLoginAt ? format(new Date(user.lastLoginAt), 'dd/MM/yyyy HH:mm') : 'Nunca'}
                </span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
