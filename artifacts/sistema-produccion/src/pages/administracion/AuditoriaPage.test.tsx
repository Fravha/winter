import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuditoriaPage from './AuditoriaPage';

const mocks = vi.hoisted(() => ({
  useAuditLogs: vi.fn(),
}));

vi.mock('@/features/admin/api/admin.hooks', () => ({
  useAuditLogs: mocks.useAuditLogs,
}));

const log = {
  id: 'event-1',
  actorUserId: 'actor-1',
  action: 'UPDATE',
  resourceType: 'ARTICLE',
  resourceId: 'article-1',
  metadata: { changed: ['name'] },
  ipAddress: '127.0.0.1',
  requestId: 'request-1',
  createdAt: '2025-01-15T12:30:00.000Z',
};

const result = (overrides: Record<string, unknown> = {}) => ({
  data: { data: [log], meta: { page: 1, pageSize: 20, total: 21, totalPages: 2 } },
  isLoading: false,
  error: null,
  ...overrides,
});

beforeEach(() => {
  mocks.useAuditLogs.mockReset();
  mocks.useAuditLogs.mockReturnValue(result());
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { configurable: true, value: () => false },
    setPointerCapture: { configurable: true, value: () => {} },
    releasePointerCapture: { configurable: true, value: () => {} },
    scrollIntoView: { configurable: true, value: () => {} },
  });
});

describe('AuditoriaPage', () => {
  it('passes backend pagination metadata and resets page when filters are applied', async () => {
    const user = userEvent.setup();
    render(<AuditoriaPage />);

    expect(mocks.useAuditLogs).toHaveBeenCalledWith({ page: 1, pageSize: 20 }, { enabled: true });
    expect(screen.getByText('Mostrando pág. 1 de 2 (21 regs)')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /siguiente/i }));
    await waitFor(() => expect(mocks.useAuditLogs).toHaveBeenLastCalledWith(
      { page: 2, pageSize: 20 },
      { enabled: true },
    ));

    await user.type(screen.getByLabelText('Acción'), 'CREATE');
    await user.click(screen.getByRole('button', { name: /buscar/i }));
    await waitFor(() => expect(mocks.useAuditLogs).toHaveBeenLastCalledWith(
      { page: 1, pageSize: 20, action: 'CREATE', resourceType: undefined, actorUserId: undefined, resourceId: undefined, from: undefined, to: undefined },
      { enabled: true },
    ));
  });

  it('serializes date filters as ISO strings and rejects an invalid range without querying', async () => {
    const user = userEvent.setup();
    render(<AuditoriaPage />);
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2025-01-20T08:30' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2025-01-10T08:30' } });
    await user.click(screen.getByRole('button', { name: /buscar/i }));
    expect(screen.getByText('La fecha "Desde" no puede ser mayor que "Hasta".')).toBeTruthy();
    expect(mocks.useAuditLogs).toHaveBeenCalledWith({ page: 1, pageSize: 20 }, { enabled: true });

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2025-01-10T08:30' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2025-01-20T17:45' } });
    await user.click(screen.getByRole('button', { name: /buscar/i }));
    await waitFor(() => expect(mocks.useAuditLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: new Date('2025-01-10T08:30').toISOString(),
        to: new Date('2025-01-20T17:45').toISOString(),
        page: 1,
      }),
      { enabled: true },
    ));
  });

  it('opens detail from the loaded row without issuing another GET', async () => {
    const user = userEvent.setup();
    render(<AuditoriaPage />);
    await user.click(screen.getByRole('button', { name: 'Ver detalle de UPDATE' }));
    expect(screen.getByText('Detalle de Evento de Auditoría')).toBeTruthy();
    expect(screen.getByText('event-1')).toBeTruthy();
    expect(screen.getByText(/"changed"/)).toBeTruthy();
    expect(mocks.useAuditLogs).toHaveBeenCalledWith({ page: 1, pageSize: 20 }, { enabled: true });
  });

  it.each([50, 100])('supports the %s row cap and resets page', async (size) => {
    const user = userEvent.setup();
    render(<AuditoriaPage />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: String(size) }));
    await waitFor(() => expect(mocks.useAuditLogs).toHaveBeenLastCalledWith(
      { page: 1, pageSize: size },
      { enabled: true },
    ));
  });

  it('renders empty and error states', () => {
    mocks.useAuditLogs.mockReturnValueOnce(result({
      data: { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
    }));
    const { unmount } = render(<AuditoriaPage />);
    expect(screen.getByText('No hay registros')).toBeTruthy();
    unmount();

    mocks.useAuditLogs.mockReturnValue(result({ data: undefined, error: new Error('Audit backend unavailable') }));
    render(<AuditoriaPage />);
    expect(screen.getByText('Audit backend unavailable')).toBeTruthy();
  });
});