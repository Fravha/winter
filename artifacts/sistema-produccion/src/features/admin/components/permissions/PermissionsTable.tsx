import { MoreHorizontal, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PermissionAdmin } from '@/features/admin/types/admin.types';

interface PermissionsTableProps {
  permissions: PermissionAdmin[];
  isLoading: boolean;
  error: unknown;
  canManage: boolean;
  onEdit: (perm: PermissionAdmin) => void;
  onDelete: (perm: PermissionAdmin) => void;
}

export function PermissionsTable({
  permissions,
  isLoading,
  error,
  canManage,
  onEdit,
  onDelete,
}: PermissionsTableProps) {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground animate-pulse">
        Cargando permisos...
      </div>
    );
  }

  if (error && permissions.length === 0) {
    return null;
  }

  if (permissions.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card/50">
        No se encontraron permisos.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground border-b">
            <tr>
              <th className="px-4 py-3 font-medium">Permiso</th>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {permissions.map((perm) => (
              <tr key={perm.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">
                  {perm.name}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="font-mono text-xs">{perm.code}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {perm.description || '-'}
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menú</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px]">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      {canManage && (
                        <>
                          <DropdownMenuItem onClick={() => onEdit(perm)}>
                            <Edit2 className="mr-2 h-4 w-4" /> Editar Datos
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onDelete(perm)}>
                            <Trash2 className="mr-2 h-4 w-4 text-destructive" /> <span className="text-destructive">Eliminar</span>
                          </DropdownMenuItem>
                        </>
                      )}

                      {!canManage && (
                         <DropdownMenuItem disabled>
                           Sin permisos de edición
                         </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
