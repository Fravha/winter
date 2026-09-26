import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';

const auth = vi.hoisted(() => ({
  authenticated: true,
  authorized: true,
  can: vi.fn((_permission: string) => true),
}));

// Use the real router rather than the minimal global test stub.
vi.mock('wouter', async () => vi.importActual('wouter'));

vi.mock('@/auth/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({
    authenticated: auth.authenticated,
    authorized: auth.authorized,
    loading: false,
    contractualError: null,
    technicalError: null,
    can: auth.can,
  }),
}));
vi.mock('@/auth/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/pages/HomePage', () => ({
  default: () => <h1>Inicio vigente</h1>,
}));
vi.mock('@/pages/auth/LoginPage', () => ({
  default: () => <h1>Inicio de sesión vigente</h1>,
}));
vi.mock('@/pages/articulos/ArticulosPage', () => ({
  default: () => <h1>Artículos vigentes</h1>,
}));
vi.mock('@/pages/produccion/BatchTracePage', () => ({
  default: ({ batchId }: { batchId: string }) => <h1>Trazabilidad {batchId}</h1>,
  BATCH_TRACE_PERMISSION: 'production:read',
}));

beforeEach(() => {
  auth.authenticated = true;
  auth.authorized = true;
  auth.can.mockImplementation(() => true);
  window.history.replaceState({}, '', '/');
});

describe('rutas no encontradas', () => {
  it.each(['/esto-no-existe', '/produccion/esto-no-existe'])(
    'muestra la página 404 en %s',
    (path) => {
      window.history.replaceState({}, '', path);
      render(<App />);

      expect(screen.getByText('404')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Parece que este camino no llega a la bodega.' })).toBeTruthy();
      expect(screen.getByText('La página que buscas no existe o fue movida.')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe('/');
    },
  );

  it('vuelve al inicio desde el botón principal', async () => {
    window.history.replaceState({}, '', '/esto-no-existe');
    render(<App />);

    await userEvent.click(screen.getByRole('link', { name: 'Volver al inicio' }));

    expect(window.location.pathname).toBe('/');
    expect(screen.getByRole('heading', { name: 'Inicio vigente' })).toBeTruthy();
  });

  it('muestra 404 sin sesión para una URL inexistente', () => {
    auth.authenticated = false;
    window.history.replaceState({}, '', '/produccion/esto-no-existe');
    render(<App />);

    expect(screen.getByText('404')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Inicio de sesión vigente' })).toBeNull();
  });

  it('conserva AuthGuard en rutas válidas sin sesión', async () => {
    auth.authenticated = false;
    window.history.replaceState({}, '', '/articulos');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Inicio de sesión vigente' })).toBeTruthy();
    expect(window.location.pathname).toBe('/iniciar-sesion');
    expect(screen.queryByText('404')).toBeNull();
  });

  it('mantiene una ruta existente y su control de permisos', () => {
    window.history.replaceState({}, '', '/articulos');
    const { rerender } = render(<App />);
    expect(screen.getByRole('heading', { name: 'Artículos vigentes' })).toBeTruthy();
    expect(screen.queryByText('404')).toBeNull();

    auth.can.mockImplementation(() => false);
    rerender(<App />);
    expect(screen.getByRole('heading', { name: 'Acceso denegado' })).toBeTruthy();
    expect(screen.queryByText('404')).toBeNull();
  });

  it('reconoce la ruta existente de trazabilidad con su parámetro', () => {
    window.history.replaceState({}, '', '/produccion/batches/batch-1/trace');
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Trazabilidad batch-1' })).toBeTruthy();
    expect(screen.queryByText('404')).toBeNull();
  });
});