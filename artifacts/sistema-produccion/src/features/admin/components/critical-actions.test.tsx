import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/api-error';
import { UserActionDialogs } from './users/UserActionDialogs';
import { UserRoleSheet } from './users/UserRoleSheet';
import { RoleDeleteDialog } from './roles/RoleDeleteDialog';
import { PermissionDeleteDialog } from './permissions/PermissionDeleteDialog';
import { PermissionFormSheet } from './permissions/PermissionFormSheet';

const actions = {
  activate: { mutate: vi.fn(), isPending: false, error: null as unknown },
  suspend: { mutate: vi.fn(), isPending: false, error: null as unknown },
  password: { mutate: vi.fn(), isPending: false, error: null as unknown },
  replaceRole: { mutate: vi.fn(), isPending: false, error: null as unknown },
  deleteRole: { mutate: vi.fn(), isPending: false, error: null as unknown },
  deletePermission: { mutate: vi.fn(), isPending: false, error: null as unknown },
  updatePermission: { mutate: vi.fn(), isPending: false, error: null as unknown },
};

vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ can: () => true }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/features/admin/api/admin.hooks', () => ({
  useActivateUser: () => actions.activate,
  useSuspendUser: () => actions.suspend,
  useSendPasswordSetup: () => actions.password,
  useReplaceUserRole: () => actions.replaceRole,
  useRoles: () => ({ data: [{ id: 'r2', name: 'Supervisor' }], isLoading: false }),
  useDeleteRole: () => actions.deleteRole,
  useDeletePermission: () => actions.deletePermission,
  useUpdatePermission: () => actions.updatePermission,
  useCreatePermission: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

const user = {
  id: 'u1',
  firebaseUid: 'hidden',
  email: 'ana@example.com',
  displayName: 'Ana',
  status: 'ACTIVE' as const,
  lastLoginAt: null,
  role: { id: 'r1', code: 'operator', name: 'Operador' },
  createdAt: '',
  updatedAt: '',
};

beforeEach(() => {
  cleanup();
  Object.values(actions).forEach((action) => {
    action.mutate.mockReset();
    action.error = null;
  });
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    setPointerCapture: { configurable: true, value: () => {} },
    releasePointerCapture: { configurable: true, value: () => {} },
    scrollIntoView: { configurable: true, value: () => {} },
  });
});

describe('critical administration actions', () => {
  it.each([
    ['ACTIVATE', 'Activar', actions.activate],
    ['SUSPEND', 'Suspender', actions.suspend],
    ['SETUP_PASSWORD', 'Enviar Correo', actions.password],
  ] as const)('confirms %s and calls its endpoint action', async (_action, button, mutation) => {
    const onClose = vi.fn();
    const actor = userEvent.setup();
    render(<UserActionDialogs user={user} action={_action} onClose={onClose} />);
    await actor.click(screen.getByRole('button', { name: button }));
    expect(mutation.mutate).toHaveBeenCalledWith('u1', expect.any(Object));
  });

  it('shows LAST_ADMIN_PROTECTED from a failed suspend action', () => {
    actions.suspend.error = new ApiError({ status: 409, code: 'LAST_ADMIN_PROTECTED', message: 'backend' });
    render(<UserActionDialogs user={user} action="SUSPEND" onClose={vi.fn()} />);
    expect(screen.getByText(/último administrador/i)).toBeTruthy();
  });

  it('replaces the user role with the selected role', async () => {
    const actor = userEvent.setup();
    render(<UserRoleSheet user={user} open onOpenChange={vi.fn()} />);
    await actor.click(screen.getByRole('combobox'));
    await actor.click(screen.getByRole('option', { name: 'Supervisor' }));
    await actor.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    expect(actions.replaceRole.mutate).toHaveBeenCalledWith({ id: 'u1', roleId: 'r2' }, expect.any(Object));
  });

  it.each([
    ['ROLE_IN_USE', 'rol está en uso', 'role'],
    ['SYSTEM_ROLE_PROTECTED', 'rol de sistema', 'role'],
  ] as const)('shows %s when deleting a role fails', (_code, text, kind) => {
    actions.deleteRole.error = new ApiError({ status: 409, code: _code, message: 'backend' });
    render(<RoleDeleteDialog role={{ id: 'r1', code: 'system', name: 'Administrador', description: null, permissions: [], createdAt: '', updatedAt: '' }} open onClose={vi.fn()} />);
    expect(kind).toBe('role');
    expect(screen.getByText(new RegExp(text, 'i'))).toBeTruthy();
  });

  it('shows PERMISSION_IN_USE when permission deletion fails', () => {
    actions.deletePermission.error = new ApiError({ status: 409, code: 'PERMISSION_IN_USE', message: 'backend' });
    render(<PermissionDeleteDialog permission={{ id: 'p1', code: 'users:read', name: 'Leer usuarios', description: null, createdAt: '', updatedAt: '' }} open onClose={vi.fn()} />);
    expect(screen.getByText(/retirarse de los roles/i)).toBeTruthy();
  });

  it('updates a permission with its editable fields', async () => {
    const actor = userEvent.setup();
    render(<PermissionFormSheet permission={{ id: 'p1', code: 'users:read', name: 'Leer usuarios', description: null, createdAt: '', updatedAt: '' }} open onOpenChange={vi.fn()} />);
    const name = screen.getByDisplayValue('Leer usuarios');
    await actor.clear(name);
    await actor.type(name, 'Consultar usuarios');
    await actor.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(actions.updatePermission.mutate).toHaveBeenCalledWith(
      { id: 'p1', input: { code: 'users:read', name: 'Consultar usuarios', description: null } },
      expect.any(Object),
    );
  });
});