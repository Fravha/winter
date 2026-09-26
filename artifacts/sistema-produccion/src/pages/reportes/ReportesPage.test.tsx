import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReportesPage from './ReportesPage';
import { validateReport } from '@/features/reports/schemas/report.schema';

const exportMock = vi.hoisted(() => vi.fn());
vi.mock('@/features/reports/api/export-report', () => ({ exportReport: exportMock }));
vi.mock('@/features/reports/components/ReportFields', () => ({
  ReportField: ({ name, value, onChange, error }: { name: string; value: string; onChange: (v: string) => void; error?: string }) =>
    <div><input aria-label={name} value={value} onChange={e => onChange(e.target.value)} />{error && <span role="alert">{error}</span>}</div>,
}));

describe('Reportes', () => {
  beforeEach(() => exportMock.mockReset());
  it('shows exactly six reports without querying export endpoints on mount', () => {
    render(<ReportesPage />);
    expect(screen.getAllByRole('button', { name: 'Descargar Excel' })).toHaveLength(6);
    expect(screen.getByText('Trabajos de producción')).toBeTruthy();
    expect(screen.getByText('Trazabilidad')).toBeTruthy();
    expect(exportMock).not.toHaveBeenCalled();
  });
  it('rejects reversed dates and missing batch locally', () => {
    expect(validateReport('works', { from: '2026-09-18', to: '2026-09-16' }).errors.to).toBeTruthy();
    expect(validateReport('traceability', {}).errors.productionBatchId).toBeTruthy();
    expect(validateReport('stock', { warehouseId: '', articuloId: '' }).values).toEqual({});
    render(<ReportesPage />);
    fireEvent.click(screen.getByTestId('download-traceability'));
    expect(screen.getByText(/Selecciona un batch para descargar/)).toBeTruthy();
    expect(exportMock).not.toHaveBeenCalled();
  });
  it('blocks reversed dates in the form and omits blank optional filters', () => {
    render(<ReportesPage />);
    const card = screen.getByTestId('card-report-works');
    fireEvent.change(card.querySelector('input[aria-label="from"]')!, { target: { value: '2026-07-18' } });
    fireEvent.change(card.querySelector('input[aria-label="to"]')!, { target: { value: '2026-07-02' } });
    fireEvent.click(screen.getByTestId('download-works'));
    expect(screen.getByText('La fecha fin debe ser igual o posterior a la fecha inicio.')).toBeTruthy();
    expect(exportMock).not.toHaveBeenCalled();
  });
  it('submits work order/date filters, shows per-card progress and success only after promise settles', async () => {
    exportMock.mockResolvedValue('trabajos.xlsx');
    render(<ReportesPage />);
    const card = screen.getByTestId('card-report-works');
    fireEvent.change(card.querySelector('input[aria-label="from"]')!, { target: { value: '2026-03-01' } });
    fireEvent.click(screen.getByTestId('download-works'));
    expect(exportMock).toHaveBeenCalledWith('works', { from: '2026-03-01' });
    expect(screen.getByTestId('download-works').hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('download-stock').hasAttribute('disabled')).toBe(false);
    expect(screen.queryByText(/Archivo listo/)).toBeNull();
    await waitFor(() => expect(screen.getByText(/Archivo listo: trabajos.xlsx/)).toBeTruthy());
  });
  it('shows structured errors and enables retry', async () => {
    exportMock.mockRejectedValueOnce(Object.assign(new Error('Sin acceso'), { status: 403, code: 'FORBIDDEN', requestId: 'req-4' })).mockResolvedValueOnce('stock.xlsx');
    render(<ReportesPage />);
    fireEvent.click(screen.getByTestId('download-stock'));
    await waitFor(() => expect(screen.getByText('Sin acceso')).toBeTruthy());
    fireEvent.click(screen.getByTestId('retry-stock'));
    await waitFor(() => expect(screen.getByText(/Archivo listo: stock.xlsx/)).toBeTruthy());
  });
});