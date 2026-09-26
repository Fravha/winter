import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { StartupLoader } from '@/components/shared/StartupLoader';
import { useAuth } from '@/auth/AuthContext';
import { useRoles } from '@/features/admin/api/admin.hooks';
import { RolesTable } from '@/features/admin/components/roles/RolesTable';
import { RoleFormSheet } from '@/features/admin/components/roles/RoleFormSheet';
import { RolePermissionsSheet } from '@/features/admin/components/roles/RolePermissionsSheet';
import { RoleDeleteDialog } from '@/features/admin/components/roles/RoleDeleteDialog';
import { RoleAdmin } from '@/features/admin/types/admin.types';
import { AdminErrorAlert } from '@/features/admin/components/shared/admin-error-mapper';

export default function RolesPage() {
  const { can } = useAuth();
  const canManage = can('rbac:manage');

  const { data, isLoading, error } = useRoles();
  const roles = data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleAdmin | null>(null);

  const handleCreate = () => {
    setSelectedRole(null);
    setFormOpen(true);
  };

  const handleEdit = (role: RoleAdmin) => {
    setSelectedRole(role);
    setFormOpen(true);
  };

  const handlePermissions = (role: RoleAdmin) => {
    setSelectedRole(role);
    setPermissionsOpen(true);
  };

  const handleDelete = (role: RoleAdmin) => {
    setSelectedRole(role);
    setDeleteOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto py-6">
      <PageHeader
        eyebrow="Administración"
        title="Roles"
        description="Definición de roles y configuración de sus permisos."
        actions={
          canManage && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Rol
            </Button>
          )
        }
      />

      {error && <AdminErrorAlert error={error} />}

      {isLoading ? <StartupLoader compact label="Cargando roles" /> : <RolesTable
        roles={roles}
        isLoading={isLoading}
        error={error}
        canManage={canManage}
        onEdit={handleEdit}
        onManagePermissions={handlePermissions}
        onDelete={handleDelete}
      />}

      <RoleFormSheet
        role={selectedRole}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <RolePermissionsSheet
        role={selectedRole}
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
      />

      <RoleDeleteDialog
        role={selectedRole}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}
