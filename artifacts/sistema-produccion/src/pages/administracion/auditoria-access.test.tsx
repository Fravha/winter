import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { PermissionGuard } from '@/components/shared/PermissionGuard';

const auth = vi.hoisted(() => ({ can: vi.fn() }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => auth }));

describe('audit permission access', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: false,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
  });

  it('shows Auditoría in the landing sidebar only with audit:read', () => {
    auth.can.mockImplementation((permission: string) => permission === 'audit:read');
    const { rerender } = render(<SidebarProvider><AppSidebar /></SidebarProvider>);
    expect(screen.getByText('Auditoría')).toBeTruthy();

    auth.can.mockReturnValue(false);
    rerender(<SidebarProvider><AppSidebar /></SidebarProvider>);
    expect(screen.queryByText('Auditoría')).toBeNull();
  });

  it('guards the audit route content when audit:read is absent', () => {
    auth.can.mockReturnValue(false);
    const { rerender } = render(
      <PermissionGuard permission="audit:read" showErrorPage>
        <div>audit route</div>
      </PermissionGuard>,
    );
    expect(screen.queryByText('audit route')).toBeNull();
    expect(screen.getByText('Acceso denegado')).toBeTruthy();

    auth.can.mockImplementation((permission: string) => permission === 'audit:read');
    rerender(
      <PermissionGuard permission="audit:read" showErrorPage>
        <div>audit route</div>
      </PermissionGuard>,
    );
    expect(screen.getByText('audit route')).toBeTruthy();
  });
});