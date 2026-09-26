import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { StartupLoader } from '@/components/shared/StartupLoader';
import { useAuth } from '@/auth/AuthContext';
import { useUsers } from '@/features/admin/api/admin.hooks';
import { UsersTable } from '@/features/admin/components/users/UsersTable';
import { UserFormSheet } from '@/features/admin/components/users/UserFormSheet';
import { UserRoleSheet } from '@/features/admin/components/users/UserRoleSheet';
import { UserActionDialogs } from '@/features/admin/components/users/UserActionDialogs';
import { UserDetailDialog } from '@/features/admin/components/users/UserDetailDialog';
import { UserAdmin } from '@/features/admin/types/admin.types';
import { AdminErrorAlert } from '@/features/admin/components/shared/admin-error-mapper';

export default function UsuariosPage() {
  const { can } = useAuth();

  const canManageUsers = can('users:manage');
  const canManageRoles = can('rbac:manage');

  const { data, isLoading, error } = useUsers();
  const users = data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [roleSheetOpen, setRoleSheetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAdmin | null>(null);
  const [action, setAction] = useState<'NONE'|'ACTIVATE'|'SUSPEND'|'SETUP_PASSWORD'>('NONE');

  const handleCreate = () => {
    setSelectedUser(null);
    setFormOpen(true);
  };

  const handleView = (user: UserAdmin) => {
    setSelectedUser(user);
    setViewOpen(true);
  };

  const handleEdit = (user: UserAdmin) => {
    setSelectedUser(user);
    setFormOpen(true);
  };

  const handleChangeRole = (user: UserAdmin) => {
    setSelectedUser(user);
    setRoleSheetOpen(true);
  };

  const openAction = (user: UserAdmin, act: 'ACTIVATE'|'SUSPEND'|'SETUP_PASSWORD') => {
    setSelectedUser(user);
    setAction(act);
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto py-6">
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        description="Gestionar el acceso de las personas al sistema."
        actions={
          canManageUsers && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Usuario
            </Button>
          )
        }
      />

      {error && <AdminErrorAlert error={error} />}

      {isLoading ? <StartupLoader compact label="Cargando usuarios" /> : <UsersTable
        users={users}
        isLoading={isLoading}
        error={error}
        canManageUsers={canManageUsers}
        canManageRoles={canManageRoles}
        onView={handleView}
        onEdit={handleEdit}
        onChangeRole={handleChangeRole}
        onActivate={(u) => openAction(u, 'ACTIVATE')}
        onSuspend={(u) => openAction(u, 'SUSPEND')}
        onSetupPassword={(u) => openAction(u, 'SETUP_PASSWORD')}
      />}

      <UserDetailDialog
        userId={selectedUser?.id || null}
        open={viewOpen}
        onOpenChange={setViewOpen}
      />

      <UserFormSheet
        user={selectedUser}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <UserRoleSheet
        user={selectedUser}
        open={roleSheetOpen}
        onOpenChange={setRoleSheetOpen}
      />

      <UserActionDialogs
        user={selectedUser}
        action={action}
        onClose={() => setAction('NONE')}
      />
    </div>
  );
}
