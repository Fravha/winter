import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from './admin.api';
import * as client from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  getApiUrl: (path: string) => `http://api.test/api/v1/${path}`,
  getAuthToken: vi.fn().mockResolvedValue('test-token'),
}));

const response = (body: unknown): Response => ({
  ok: true,
  status: 200,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => body,
} as unknown as Response);

describe('audit log API contract', () => {
  beforeEach(() => {
    vi.mocked(client.getAuthToken).mockResolvedValue('test-token');
    global.fetch = vi.fn().mockResolvedValue(response({
      data: [],
      meta: { page: 2, pageSize: 50, total: 51, totalPages: 2 },
    }));
  });

  it('serializes all eight query keys in the backend contract and preserves the envelope', async () => {
    const result = await adminApi.auditLogs.list({
      actorUserId: 'actor-1',
      action: 'UPDATE',
      resourceType: 'ARTICLE',
      resourceId: 'article-1',
      from: '2025-01-01T00:00:00.000Z',
      to: '2025-01-31T23:59:59.999Z',
      page: 2,
      pageSize: 50,
    });

    expect(result).toEqual({
      data: [],
      meta: { page: 2, pageSize: 50, total: 51, totalPages: 2 },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://api.test/api/v1/audit-logs?actorUserId=actor-1&action=UPDATE&resourceType=ARTICLE&resourceId=article-1&from=2025-01-01T00%3A00%3A00.000Z&to=2025-01-31T23%3A59%3A59.999Z&page=2&pageSize=50',
      expect.objectContaining({ signal: undefined, headers: expect.any(Headers) }),
    );
  });

  it('omits empty and undefined optional values while retaining zero-like pagination values', async () => {
    await adminApi.auditLogs.list({ action: '', resourceId: undefined, page: 1, pageSize: 20 });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://api.test/api/v1/audit-logs?page=1&pageSize=20',
      expect.anything(),
    );
  });
});