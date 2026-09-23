import { MoreHorizontal, Edit, CheckCircle, XCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import type { Articulo } from '../types/articulo.types';
import { useActivateArticulo, useDeactivateArticulo } from '../api/articulos.hooks';
import { useToast } from '@/hooks/use-toast';
import { getArticuloErrorMessage, withRequestId } from '../articulo-error';

export function ArticuloActions({ articulo, onEdit, onView }: { articulo: Articulo; onEdit: () => void; onView: () => void }) {
  const { can } = useAuth();
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const { toast } = useToast();

  const activate = useActivateArticulo();
  const deactivate = useDeactivateArticulo();

  const canEdit = can('articulos:update');
  const canActivate = can('articulos:activate') && !articulo.activo;
  const canDeactivate = can('articulos:deactivate') && articulo.activo;

  const handleActivate = () => {
    activate.mutate(articulo.id, {
      onSuccess: () => {
        toast({ title: 'Artículo activado exitosamente', variant: 'default' });
        setShowActivateConfirm(false);
      },
      onError: (error) => {
        const message = getArticuloErrorMessage(error, 'No fue posible activar el artículo.');
        toast({
          variant: 'destructive',
          title: 'Error al activar',
          description: withRequestId(message, error),
        });
        setShowActivateConfirm(false);
      }
    });
  };

  const handleDeactivate = () => {
    deactivate.mutate(articulo.id, {
      onSuccess: () => {
        toast({ title: 'Artículo desactivado exitosamente', variant: 'default' });
        setShowDeactivateConfirm(false);
      },
      onError: (error) => {
        const message = getArticuloErrorMessage(error, 'No fue posible desactivar el artículo.');
        toast({
          variant: 'destructive',
          title: 'Error al desactivar',
          description: withRequestId(message, error),
        });
        setShowDeactivateConfirm(false);
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" data-testid={`btn-actions-${articulo.id}`} aria-label="Opciones de artículo">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onView} data-testid={`menu-view-${articulo.id}`}>
            <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
            Ver detalles
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem onClick={onEdit} data-testid={`menu-edit-${articulo.id}`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          )}
          {canActivate && (
            <DropdownMenuItem 
              onClick={() => setShowActivateConfirm(true)}
              data-testid={`menu-activate-${articulo.id}`}
            >
              <CheckCircle className="mr-2 h-4 w-4 text-success" />
              Activar
            </DropdownMenuItem>
          )}
          {canDeactivate && (
            <DropdownMenuItem 
              onClick={() => setShowDeactivateConfirm(true)}
              data-testid={`menu-deactivate-${articulo.id}`}
            >
              <XCircle className="mr-2 h-4 w-4 text-destructive" />
              Desactivar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showActivateConfirm} onOpenChange={setShowActivateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Activar artículo?</AlertDialogTitle>
            <AlertDialogDescription>
              El artículo <strong>{articulo.codigo} - {articulo.nombre}</strong> volverá a estar disponible para su uso en operaciones de compras, inventario y producción.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-activate">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleActivate();
              }}
              disabled={activate.isPending}
              data-testid="btn-confirm-activate"
            >
              {activate.isPending ? 'Activando...' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeactivateConfirm} onOpenChange={setShowDeactivateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar artículo?</AlertDialogTitle>
            <AlertDialogDescription>
              El artículo <strong>{articulo.codigo} - {articulo.nombre}</strong> ya no estará disponible para nuevas operaciones. El historial existente no se verá afectado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-deactivate">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleDeactivate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deactivate.isPending}
              data-testid="btn-confirm-deactivate"
            >
              {deactivate.isPending ? 'Desactivando...' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
