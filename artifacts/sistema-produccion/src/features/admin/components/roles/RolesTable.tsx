import { MoreHorizontal, Edit2, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
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
import { RoleAdmin } from '@/features/admin/types/admin.types';

interface RolesTableProps {
  roles: RoleAdmin[];
  isLoading: boolean;
  error: unknown;
  canManage: boolean;
  onEdit: (role: RoleAdmin) => void;
  onManagePermissions: (role: RoleAdmin) => void;
  onDelete: (role: RoleAdmin) => void;
}

export function RolesTable({
  roles,
  isLoading,
  error,
  canManage,
  onEdit,
  onManagePermissions,
  onDelete,
}: RolesTableProps) {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground animate-pulse">
        Cargando roles...
      </div>
    );
  }

  if (error && roles.length === 0) {
    return null;
  }

  if (roles.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card/50">
        No se encontraron roles.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground border-b">
            <tr>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium">Permisos</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {roles.map((role) => (
              <tr key={role.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">
                  {role.name}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="font-mono text-xs">{role.code}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {role.description || '-'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {role.permissions ? `${role.permissions.length} asignados` : '0 asignados'}
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menú</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[200px]">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      {canManage && (
                        <>
                          <DropdownMenuItem onClick={() => onEdit(role)}>
                            <Edit2 className="mr-2 h-4 w-4" /> Editar Datos
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => onManagePermissions(role)}>
                            <ShieldCheck className="mr-2 h-4 w-4" /> Gestionar Permisos
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onDelete(role)}>
                            <Trash2 className="mr-2 h-4 w-4 text-destructive" /> <span className="text-destructive">Eliminar Rol</span>
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
