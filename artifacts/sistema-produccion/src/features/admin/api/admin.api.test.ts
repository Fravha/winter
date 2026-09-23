import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from './admin.api';
import * as client from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  getApiUrl: (path: string) => `http://api.test/api/v1/${path}`,
  getAuthToken: vi.fn().mockResolvedValue('test-token'),
}));

const jsonResponse = (body: unknown, status = 200): Response => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: '',
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => body,
} as unknown as Response);

const noContent = (): Response => ({
  ok: true,
  status: 204,
  headers: new Headers(),
} as unknown as Response);

describe('adminApi HTTP contracts', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.mocked(client.getAuthToken).mockResolvedValue('test-token');
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  it('uses exact user paths, methods, envelopes and payloads', async () => {
    const user = { id: 'u1', email: 'one@example.com' };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [user] }))
      .mockResolvedValueOnce(jsonResponse({ data: user }))
      .mockResolvedValueOnce(jsonResponse({ data: user }))
      .mockResolvedValueOnce(jsonResponse({ data: user }))
      .mockResolvedValueOnce(jsonResponse({ data: user }))
      .mockResolvedValueOnce(jsonResponse({ data: user }))
      .mockResolvedValueOnce(noContent())
      .mockResolvedValueOnce(noContent());

    await expect(adminApi.users.list()).resolves.toEqual([user]);
    await expect(adminApi.users.get('u1')).resolves.toEqual(user);
    await expect(adminApi.users.create({ email: 'one@example.com', displayName: 'One', roleId: 'r1' })).resolves.toEqual(user);
    await expect(adminApi.users.update('u1', { email: 'new@example.com', displayName: null })).resolves.toEqual(user);
    await expect(adminApi.users.activate('u1')).resolves.toEqual(user);
    await expect(adminApi.users.suspend('u1')).resolves.toEqual(user);
    await expect(adminApi.users.sendPasswordSetup('u1')).resolves.toBeUndefined();
    await expect(adminApi.users.replaceRole('u1', 'r2')).resolves.toBeUndefined();

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method ?? 'GET', init?.body && JSON.parse(init.body)]))
      .toEqual([
        ['http://api.test/api/v1/users', 'GET', undefined],
        ['http://api.test/api/v1/users/u1', 'GET', undefined],
        ['http://api.test/api/v1/users', 'POST', { email: 'one@example.com', displayName: 'One', roleId: 'r1' }],
        ['http://api.test/api/v1/users/u1', 'PATCH', { email: 'new@example.com', displayName: null }],
        ['http://api.test/api/v1/users/u1/activate', 'POST', undefined],
        ['http://api.test/api/v1/users/u1/suspend', 'POST', undefined],
        ['http://api.test/api/v1/users/u1/send-password-setup', 'POST', undefined],
        ['http://api.test/api/v1/users/u1/role', 'PUT', { roleId: 'r2' }],
      ]);
  });

  it('uses exact role paths and sends the complete replacement permission set', async () => {
    const role = { id: 'r1', code: 'admin', name: 'Admin' };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [role] }))
      .mockResolvedValueOnce(jsonResponse({ data: role }))
      .mockResolvedValueOnce(jsonResponse({ data: role }))
      .mockResolvedValueOnce(jsonResponse({ data: role }))
      .mockResolvedValueOnce(noContent())
      .mockResolvedValueOnce(noContent());

    await expect(adminApi.roles.list()).resolves.toEqual([role]);
    await expect(adminApi.roles.get('r1')).resolves.toEqual(role);
    await expect(adminApi.roles.create({ code: 'admin', name: 'Admin', description: 'all' })).resolves.toEqual(role);
    await expect(adminApi.roles.update('r1', { name: 'Administrators', description: null })).resolves.toEqual(role);
    await expect(adminApi.roles.remove('r1')).resolves.toBeUndefined();
    await expect(adminApi.roles.replacePermissions('r1', ['p1', 'p2'])).resolves.toBeUndefined();

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method ?? 'GET', init?.body && JSON.parse(init.body)]))
      .toEqual([
        ['http://api.test/api/v1/roles', 'GET', undefined],
        ['http://api.test/api/v1/roles/r1', 'GET', undefined],
        ['http://api.test/api/v1/roles', 'POST', { code: 'admin', name: 'Admin', description: 'all' }],
        ['http://api.test/api/v1/roles/r1', 'PATCH', { name: 'Administrators', description: null }],
        ['http://api.test/api/v1/roles/r1', 'DELETE', undefined],
        ['http://api.test/api/v1/roles/r1/permissions', 'PUT', { permissionIds: ['p1', 'p2'] }],
      ]);
  });

  it('uses exact permission CRUD paths and supports 204 deletion', async () => {
    const permission = { id: 'p1', code: 'users:read', name: 'Read users' };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: [permission] }))
      .mockResolvedValueOnce(jsonResponse({ data: permission }))
      .mockResolvedValueOnce(jsonResponse({ data: permission }))
      .mockResolvedValueOnce(jsonResponse({ data: permission }))
      .mockResolvedValueOnce(noContent());

    await expect(adminApi.permissions.list()).resolves.toEqual([permission]);
    await expect(adminApi.permissions.get('p1')).resolves.toEqual(permission);
    await expect(adminApi.permissions.create({ code: 'users:read', name: 'Read users', description: null })).resolves.toEqual(permission);
    await expect(adminApi.permissions.update('p1', { code: 'users:view', name: 'View users' })).resolves.toEqual(permission);
    await expect(adminApi.permissions.remove('p1')).resolves.toBeUndefined();

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method ?? 'GET', init?.body && JSON.parse(init.body)]))
      .toEqual([
        ['http://api.test/api/v1/permissions', 'GET', undefined],
        ['http://api.test/api/v1/permissions/p1', 'GET', undefined],
        ['http://api.test/api/v1/permissions', 'POST', { code: 'users:read', name: 'Read users', description: null }],
        ['http://api.test/api/v1/permissions/p1', 'PATCH', { code: 'users:view', name: 'View users' }],
        ['http://api.test/api/v1/permissions/p1', 'DELETE', undefined],
      ]);
  });
});