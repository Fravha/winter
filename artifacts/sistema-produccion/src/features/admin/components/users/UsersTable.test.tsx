import "@testing-library/jest-dom";
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UsersTable } from './UsersTable';
import type { UserAdmin } from '../../types';

const user: UserAdmin = {
  id: 'u1',
  firebaseUid: 'must-not-be-presented',
  email: 'ana@example.com',
  displayName: 'Ana Pérez',
  status: 'ACTIVE',
  lastLoginAt: null,
  role: { id: 'r1', code: 'operator', name: 'Operador' },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const callbacks = {
  onView: vi.fn(),
  onEdit: vi.fn(),
  onChangeRole: vi.fn(),
  onActivate: vi.fn(),
  onSuspend: vi.fn(),
  onSetupPassword: vi.fn(),
};

describe('UsersTable permission guards', () => {
  it('renders core user data but does not expose firebaseUid', () => {
    render(<UsersTable users={[user]} isLoading={false} error={null} canManageUsers={false} canManageRoles={false} {...callbacks} />);
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    expect(screen.getByText('ana@example.com')).toBeTruthy();
    expect(screen.getByText('Activo')).toBeTruthy();
    expect(screen.getByText('Operador')).toBeTruthy();
    expect(screen.queryByText('must-not-be-presented')).toBeNull();
  });

  it('does not render management actions when the caller lacks permissions', () => {
    render(<UsersTable users={[user]} isLoading={false} error={null} canManageUsers={false} canManageRoles={false} {...callbacks} />);
    expect(screen.queryByText('Editar Datos')).toBeNull();
    expect(screen.queryByText('Cambiar Rol')).toBeNull();
    expect(screen.queryByText('Configurar Contraseña')).toBeNull();
    expect(screen.queryByText('Suspender')).toBeNull();
    expect(screen.queryByText('Activar')).toBeNull();
  });
});