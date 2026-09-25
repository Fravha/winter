import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { PermissionGuard } from '@/components/shared/PermissionGuard';

const auth = vi.hoisted(() => ({ can: vi.fn() }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));

describe('reports:export access', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({
      matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {},
    }) });
  });
  it('reveals Reportes navigation only to reports:export, not inventory:read or production:read', () => {
    auth.can.mockImplementation((permission: string) => permission === 'reports:export');
    const { rerender } = render(<SidebarProvider><AppSidebar /></SidebarProvider>);
    expect(screen.getByText('Reportes').closest('a')?.getAttribute('href')).toBe('/reportes');
    auth.can.mockImplementation((permission: string) => permission === 'production:read' || permission === 'inventory:read');
    rerender(<SidebarProvider><AppSidebar /></SidebarProvider>);
    expect(screen.queryByText('Reportes')).toBeNull();
  });
  it('requires the exact permission at the route guard', () => {
    auth.can.mockReturnValue(false);
    const content = <PermissionGuard permission="reports:export" showErrorPage><div>Área de reportes</div></PermissionGuard>;
    const { rerender } = render(content);
    expect(screen.queryByText('Área de reportes')).toBeNull();
    expect(screen.getByText('Acceso denegado')).toBeTruthy();
    auth.can.mockImplementation((permission: string) => permission === 'reports:export');
    rerender(<PermissionGuard permission="reports:export" showErrorPage><div>Área de reportes</div></PermissionGuard>);
    expect(screen.getByText('Área de reportes')).toBeTruthy();
  });
});