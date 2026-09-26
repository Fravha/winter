import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserFormSheet } from './users/UserFormSheet';
import { RoleFormSheet } from './roles/RoleFormSheet';
import { PermissionFormSheet } from './permissions/PermissionFormSheet';
import { PermissionDeleteDialog } from './permissions/PermissionDeleteDialog';
import { RolePermissionsSheet } from './roles/RolePermissionsSheet';

const mutations = {
  createUser: { mutate: vi.fn(), isPending: false, error: null },
  updateUser: { mutate: vi.fn(), isPending: false, error: null },
  createRole: { mutate: vi.fn(), isPending: false, error: null },
  updateRole: { mutate: vi.fn(), isPending: false, error: null },
  createPermission: { mutate: vi.fn(), isPending: false, error: null },
  updatePermission: { mutate: vi.fn(), isPending: false, error: null },
  deletePermission: { mutate: vi.fn(), isPending: false, error: null },
  replacePermissions: { mutate: vi.fn(), isPending: false, error: null },
};

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ can: () => true }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/features/admin/api/admin.hooks', () => ({
  useCreateUser: () => mutations.createUser,
  useUpdateUser: () => mutations.updateUser,
  useRoles: () => ({ data: [{ id: 'r1', name: 'Operador' }], isLoading: false }),
  useCreateRole: () => mutations.createRole,
  useUpdateRole: () => mutations.updateRole,
  useCreatePermission: () => mutations.createPermission,
  useUpdatePermission: () => mutations.updatePermission,
  useDeletePermission: () => mutations.deletePermission,
  useReplaceRolePermissions: () => mutations.replacePermissions,
  usePermissions: () => ({
    data: [{ id: 'p1', code: 'users:read', name: 'Leer usuarios' }, { id: 'p2', code: 'users:manage', name: 'Gestionar usuarios' }],
    isLoading: false,
    error: null,
  }),
}));

beforeEach(() => {
  Object.values(mutations).forEach((mutation) => mutation.mutate.mockReset());
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    setPointerCapture: { configurable: true, value: () => {} },
    releasePointerCapture: { configurable: true, value: () => {} },
    scrollIntoView: { configurable: true, value: () => {} },
  });
});

describe('administration CRUD interactions', () => {
  it('submits a new user and edits only supported user fields', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(<UserFormSheet user={null} open onOpenChange={close} />);
    await user.type(screen.getByPlaceholderText('usuario@empresa.com'), 'ana@example.com');
    await user.type(screen.getByPlaceholderText('Juan Pérez'), 'Ana Pérez');
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Operador' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(mutations.createUser.mutate).toHaveBeenCalledWith(
      { email: 'ana@example.com', displayName: 'Ana Pérez', roleId: 'r1' },
      expect.any(Object),
    );

    cleanup();
    render(<UserFormSheet user={{ id: 'u1', email: 'old@example.com', displayName: 'Old', status: 'ACTIVE', lastLoginAt: null, role: null, createdAt: '', updatedAt: '', firebaseUid: 'secret' }} open onOpenChange={close} />);
    const email = screen.getByDisplayValue('old@example.com');
    await user.clear(email);
    await user.type(email, 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(mutations.updateUser.mutate).toHaveBeenCalledWith(
      { id: 'u1', input: { email: 'new@example.com', displayName: 'Old' } },
      expect.any(Object),
    );
  });

  it('creates a role and updates a role without sending its immutable code', async () => {
    const user = userEvent.setup();
    render(<RoleFormSheet role={null} open onOpenChange={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('ej. ADMIN'), 'operator');
    await user.type(screen.getByPlaceholderText('Ej. Administrador'), 'Operador');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(mutations.createRole.mutate).toHaveBeenCalledWith(
      { code: 'operator', name: 'Operador', description: undefined },
      expect.any(Object),
    );

    cleanup();
    render(<RoleFormSheet role={{ id: 'r1', code: 'fixed_code', name: 'Old', description: null, permissions: [], createdAt: '', updatedAt: '' }} open onOpenChange={vi.fn()} />);
    const roleName = screen.getByDisplayValue('Old');
    await user.clear(roleName);
    await user.type(roleName, 'New');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(mutations.updateRole.mutate).toHaveBeenCalledWith(
      { id: 'r1', input: { name: 'New', description: null } },
      expect.any(Object),
    );
  });

  it('creates and edits a permission, and confirms permission deletion', async () => {
    const user = userEvent.setup();
    render(<PermissionFormSheet permission={null} open onOpenChange={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('ej. users:read'), 'users:read');
    await user.type(screen.getByPlaceholderText('Ej. Leer Usuarios'), 'Leer usuarios');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(mutations.createPermission.mutate).toHaveBeenCalledWith(
      { code: 'users:read', name: 'Leer usuarios', description: undefined },
      expect.any(Object),
    );

    cleanup();
    render(<PermissionDeleteDialog permission={{ id: 'p1', code: 'users:read', name: 'Leer usuarios', description: null, createdAt: '', updatedAt: '' }} open onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Sí, Eliminar Permiso' }));
    expect(mutations.deletePermission.mutate).toHaveBeenCalledWith('p1', expect.any(Object));
  });

  it('submits the complete selected permission set, not only a delta', async () => {
    const user = userEvent.setup();
    render(<RolePermissionsSheet role={{ id: 'r1', code: 'operator', name: 'Operador', description: null, permissions: [{ id: 'p1', code: 'users:read', name: 'Leer usuarios' }], createdAt: '', updatedAt: '' }} open onOpenChange={vi.fn()} />);
    await user.click(screen.getByText('Gestionar usuarios'));
    await user.click(screen.getByRole('button', { name: 'Reemplazar Permisos' }));
    expect(mutations.replacePermissions.mutate).toHaveBeenCalledWith(
      { id: 'r1', permissionIds: ['p1', 'p2'] },
      expect.any(Object),
    );
  });
});