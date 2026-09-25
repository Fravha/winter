import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionGuard } from '@/components/shared/PermissionGuard';
import { ReportField } from './ReportFields';
import { getReportOptions, reportOptionPaths } from '../api/report-options';

const mocks = vi.hoisted(() => ({ request: vi.fn(), can: vi.fn((permission: string) => permission === 'reports:export') }));
vi.mock('@/lib/api/request', () => ({ request: mocks.request }));
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ can: mocks.can }) }));

const batchId = '31b05269-d392-4136-b935-810896212118';
function subject(name: 'productionBatchId' | 'warehouseId' = 'productionBatchId') {
  const onChange = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <PermissionGuard permission="reports:export" showErrorPage>
      <ReportField name={name} value="" onChange={onChange} required={name === 'productionBatchId'} />
    </PermissionGuard>
  </QueryClientProvider>);
  return onChange;
}
beforeEach(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  mocks.can.mockClear();
  mocks.request.mockReset();
  mocks.request.mockResolvedValue({ data: [{ id: batchId, code: 'BAT-42', productionOrderId: 'order-1', articuloId: 'article-1' }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
});

describe('reports-only option selectors', () => {
  it('loads the required batch from the Reports endpoint, then selects it with only reports:export', async () => {
    const onChange = subject();
    expect(mocks.request).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('select-productionBatchId'));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith('reports/options/batches?page=1&pageSize=20', expect.objectContaining({ signal: expect.any(AbortSignal) })));
    await userEvent.click(await screen.findByRole('option', { name: 'BAT-42' }));
    expect(onChange).toHaveBeenCalledWith(batchId);
    expect(mocks.can).not.toHaveBeenCalledWith('production:read');
    expect(mocks.can).not.toHaveBeenCalledWith('inventory:read');
  });
  it('searches warehouse options through reports:export rather than inventory:read', async () => {
    subject('warehouseId');
    fireEvent.change(screen.getByTestId('search-warehouseId'), { target: { value: 'Central' } });
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith('reports/options/warehouses?page=1&pageSize=20&search=Central', expect.any(Object)));
    expect(mocks.can).not.toHaveBeenCalledWith('inventory:read');
  });
  it('keeps a manual UUID fallback for missing catalogue access', async () => {
    const onChange = subject();
    await userEvent.click(screen.getByTestId('toggle-id-productionBatchId'));
    fireEvent.change(screen.getByTestId('input-productionBatchId'), { target: { value: batchId } });
    expect(onChange).toHaveBeenCalledWith(batchId);
  });
  it('offers all seven exact report options paths and only bounded pagination', async () => {
    for (const [field, path] of Object.entries(reportOptionPaths)) {
      mocks.request.mockClear();
      await getReportOptions(field as keyof typeof reportOptionPaths, { page: 2, search: ' uva ' });
      expect(mocks.request).toHaveBeenCalledWith(`reports/options/${path}?page=2&pageSize=20&search=uva`, expect.any(Object));
    }
  });
});