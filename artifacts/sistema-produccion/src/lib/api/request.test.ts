import { afterEach, describe, expect, it, vi } from 'vitest';
import { request } from './request';

vi.mock('./client', () => ({
  getApiUrl: (path: string) => `https://api.example.test/api/v1/${path}`,
  getAuthToken: async () => null,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('API error responses', () => {
  it('preserves error metadata from a direct backend error payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'INVALID_FILTER',
      message: 'Rango inválido',
      requestId: 'req-direct',
      details: { from: 'future' },
    }), { status: 400, headers: { 'content-type': 'application/json' } })));

    await expect(request('/reports')).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_FILTER',
      message: 'Rango inválido',
      requestId: 'req-direct',
      details: { from: 'future' },
    });
  });

  it('keeps a top-level requestId alongside an enveloped error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'INVALID_FILTER', message: 'Rango inválido' },
      requestId: 'req-envelope',
    }), { status: 400, headers: { 'content-type': 'application/json' } })));

    await expect(request('/reports')).rejects.toMatchObject({
      code: 'INVALID_FILTER',
      requestId: 'req-envelope',
    });
  });
});