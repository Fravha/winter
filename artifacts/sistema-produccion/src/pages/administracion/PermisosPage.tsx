import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAuth } from '@/auth/AuthContext';
import { usePermissions } from '@/features/admin/api/admin.hooks';
import { PermissionsTable } from '@/features/admin/components/permissions/PermissionsTable';
import { PermissionFormSheet } from '@/features/admin/components/permissions/PermissionFormSheet';
import { PermissionDeleteDialog } from '@/features/admin/components/permissions/PermissionDeleteDialog';
import { PermissionAdmin } from '@/features/admin/types/admin.types';
import { AdminErrorAlert } from '@/features/admin/components/shared/admin-error-mapper';

export default function PermisosPage() {
  const { can } = useAuth();
  const canManage = can('rbac:manage');

  const { data, isLoading, error } = usePermissions();
  const permissions = data ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedPerm, setSelectedPerm] = useState<PermissionAdmin | null>(null);

  const handleCreate = () => {
    setSelectedPerm(null);
    setFormOpen(true);
  };

  const handleEdit = (perm: PermissionAdmin) => {
    setSelectedPerm(perm);
    setFormOpen(true);
  };

  const handleDelete = (perm: PermissionAdmin) => {
    setSelectedPerm(perm);
    setDeleteOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto py-6">
      <PageHeader
        eyebrow="Administración"
        title="Permisos"
        description="Catálogo de permisos del sistema disponibles para asignar."
        actions={
          canManage && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Permiso
            </Button>
          )
        }
      />

      {error && <AdminErrorAlert error={error} />}

      <PermissionsTable
        permissions={permissions}
        isLoading={isLoading}
        error={error}
        canManage={canManage}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <PermissionFormSheet
        permission={selectedPerm}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <PermissionDeleteDialog
        permission={selectedPerm}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}
