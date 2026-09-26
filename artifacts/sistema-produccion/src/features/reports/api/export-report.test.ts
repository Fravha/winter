import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportReport, safeFilename } from './export-report';
import { reportPaths } from '../schemas/report.schema';

vi.mock('@/lib/api/client', () => ({
  getApiUrl: (path: string) => `https://winter.example/api/v1/${path}`,
  getAuthToken: () => Promise.resolve('test-token'),
}));
const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const objectUrl = vi.fn(() => 'blob:test');
const revoke = vi.fn();
let click: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: objectUrl });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
  click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); objectUrl.mockClear(); revoke.mockClear(); });

describe('Excel download', () => {
  it('uses six exact authenticated endpoints, omits empty filters and revokes each URL', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation(async () => new Response(new Blob(['xlsx'], { type: mime }), { status: 200, headers: { 'content-type': mime, 'content-disposition': 'attachment; filename="export.xlsx"' } }));
    for (const kind of Object.keys(reportPaths) as (keyof typeof reportPaths)[]) {
      expect(await exportReport(kind, { from: '', warehouseId: '123' })).toBe('export.xlsx');
      expect(vi.mocked(fetch).mock.lastCall?.[0]).toBe(`https://winter.example/api/v1/reports/${reportPaths[kind]}/export?warehouseId=123`);
      expect(vi.mocked(fetch).mock.lastCall?.[1]).toMatchObject({ headers: { Authorization: 'Bearer test-token' } });
    }
    expect(click).toHaveBeenCalledTimes(6);
    expect(objectUrl).toHaveBeenCalledTimes(6);
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledTimes(6);
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });
  it('parses RFC 5987 filename and refuses paths, markup, and non-xlsx names', () => {
    expect(safeFilename("attachment; filename=\"old.xlsx\"; filename*=UTF-8''trazabilidad%20uva.xlsx", 'fallback.xlsx')).toBe('trazabilidad uva.xlsx');
    expect(safeFilename('attachment; filename="../../evil.csv"', 'fallback.xlsx')).toBe('fallback.xlsx');
    expect(safeFilename('attachment; filename="../evil.xlsx"', 'fallback.xlsx')).toBe('_evil.xlsx');
    expect(safeFilename('attachment; filename="<script>.xlsx"', 'fallback.xlsx')).toBe('_script_.xlsx');
  });
  it('preserves backend error metadata and never announces a download on error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: { code: 'INVALID_FILTER', message: 'Rango inválido', details: { from: 'future' } }, requestId: 'req-8' }), { status: 400, headers: { 'content-type': 'application/json' } }));
    await expect(exportReport('stock', {})).rejects.toMatchObject({ status: 400, code: 'INVALID_FILTER', message: 'Rango inválido', requestId: 'req-8', details: { from: 'future' } });
    expect(objectUrl).not.toHaveBeenCalled();
  });
});