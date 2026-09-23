import { useState } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Shield, Edit2, CheckCircle, Ban, Key, Eye } from 'lucide-react';
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
import { UserAdmin } from '@/features/admin/types/admin.types';

interface UsersTableProps {
  users: UserAdmin[];
  isLoading: boolean;
  error: unknown;
  canManageUsers: boolean;
  canManageRoles: boolean;
  onView: (user: UserAdmin) => void;
  onEdit: (user: UserAdmin) => void;
  onChangeRole: (user: UserAdmin) => void;
  onActivate: (user: UserAdmin) => void;
  onSuspend: (user: UserAdmin) => void;
  onSetupPassword: (user: UserAdmin) => void;
}

export function UsersTable({
  users,
  isLoading,
  error,
  canManageUsers,
  canManageRoles,
  onView,
  onEdit,
  onChangeRole,
  onActivate,
  onSuspend,
  onSetupPassword,
}: UsersTableProps) {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground animate-pulse">
        Cargando usuarios...
      </div>
    );
  }

  if (error && users.length === 0) {
    return null;
  }

  if (users.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card/50">
        No se encontraron usuarios.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground border-b">
            <tr>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Último Acceso</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{user.displayName || 'Sin nombre'}</div>
                  <div className="text-muted-foreground text-xs">{user.email}</div>
                </td>
                <td className="px-4 py-3">
                  {user.status === 'ACTIVE' && <Badge variant="default" className="bg-success/15 text-success hover:bg-success/25 border-success/20">Activo</Badge>}
                  {user.status === 'PENDING' && <Badge variant="outline" className="bg-warning/15 text-warning-foreground hover:bg-warning/25 border-warning/30">Pendiente</Badge>}
                  {user.status === 'SUSPENDED' && <Badge variant="destructive" className="bg-destructive/15 text-destructive hover:bg-destructive/25 border-destructive/20">Suspendido</Badge>}
                </td>
                <td className="px-4 py-3">
                  {user.role ? (
                    <Badge variant="outline" className="font-normal">{user.role.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs italic">Sin rol</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {user.lastLoginAt ? format(new Date(user.lastLoginAt), 'dd/MM/yyyy HH:mm') : '-'}
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

                      <DropdownMenuItem onClick={() => onView(user)}>
                        <Eye className="mr-2 h-4 w-4" /> Ver Detalle
                      </DropdownMenuItem>

                      {canManageUsers && (
                        <DropdownMenuItem onClick={() => onEdit(user)}>
                          <Edit2 className="mr-2 h-4 w-4" /> Editar Datos
                        </DropdownMenuItem>
                      )}

                      {canManageRoles && (
                        <DropdownMenuItem onClick={() => onChangeRole(user)}>
                          <Shield className="mr-2 h-4 w-4" /> Cambiar Rol
                        </DropdownMenuItem>
                      )}

                      {canManageUsers && (
                        <DropdownMenuItem onClick={() => onSetupPassword(user)}>
                          <Key className="mr-2 h-4 w-4" /> Configurar Contraseña
                        </DropdownMenuItem>
                      )}

                      {canManageUsers && user.status !== 'ACTIVE' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onActivate(user)}>
                            <CheckCircle className="mr-2 h-4 w-4 text-success" /> <span className="text-success">Activar</span>
                          </DropdownMenuItem>
                        </>
                      )}

                      {canManageUsers && user.status !== 'SUSPENDED' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onSuspend(user)}>
                            <Ban className="mr-2 h-4 w-4 text-destructive" /> <span className="text-destructive">Suspender</span>
                          </DropdownMenuItem>
                        </>
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
