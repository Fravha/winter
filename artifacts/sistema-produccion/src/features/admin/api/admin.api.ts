import { request } from '@/lib/api/request';
import type { AuditLogListResponse, AuditLogQuery, PermissionAdmin, PermissionInput, PermissionUpdateInput, RoleAdmin, RoleInput, RoleUpdateInput, UserAdmin, UserInput, UserUpdateInput } from '../types';

type DataResponse<T> = { data: T };
const data = <T>(response: DataResponse<T>) => response.data;

export const adminApi = {
  auditLogs: {
    list(query: AuditLogQuery = {}, signal?: AbortSignal) {
      const params = new URLSearchParams();
      for (const key of ['actorUserId', 'action', 'resourceType', 'resourceId', 'from', 'to', 'page', 'pageSize'] as const) {
        const value = query[key];
        if (value !== undefined && value !== '') params.set(key, String(value));
      }
      const suffix = params.toString();
      return request<AuditLogListResponse>(`audit-logs${suffix ? `?${suffix}` : ''}`, { signal });
    },
  },
  users: {
    async list(signal?: AbortSignal) { return data(await request<DataResponse<UserAdmin[]>>('users', { signal })); },
    async get(id: string, signal?: AbortSignal) { return data(await request<DataResponse<UserAdmin>>(`users/${id}`, { signal })); },
    async create(input: UserInput) { return data(await request<DataResponse<UserAdmin>>('users', { method: 'POST', body: input })); },
    async update(id: string, input: UserUpdateInput) { return data(await request<DataResponse<UserAdmin>>(`users/${id}`, { method: 'PATCH', body: input })); },
    async activate(id: string) { return data(await request<DataResponse<UserAdmin>>(`users/${id}/activate`, { method: 'POST' })); },
    async suspend(id: string) { return data(await request<DataResponse<UserAdmin>>(`users/${id}/suspend`, { method: 'POST' })); },
    async sendPasswordSetup(id: string): Promise<void> { await request<void>(`users/${id}/send-password-setup`, { method: 'POST' }); },
    async replaceRole(id: string, roleId: string): Promise<void> { await request<void>(`users/${id}/role`, { method: 'PUT', body: { roleId } }); },
  },
  roles: {
    async list(signal?: AbortSignal) { return data(await request<DataResponse<RoleAdmin[]>>('roles', { signal })); },
    async get(id: string, signal?: AbortSignal) { return data(await request<DataResponse<RoleAdmin>>(`roles/${id}`, { signal })); },
    async create(input: RoleInput) { return data(await request<DataResponse<RoleAdmin>>('roles', { method: 'POST', body: input })); },
    async update(id: string, input: RoleUpdateInput) { return data(await request<DataResponse<RoleAdmin>>(`roles/${id}`, { method: 'PATCH', body: input })); },
    async remove(id: string): Promise<void> { await request<void>(`roles/${id}`, { method: 'DELETE' }); },
    async replacePermissions(id: string, permissionIds: string[]): Promise<void> { await request<void>(`roles/${id}/permissions`, { method: 'PUT', body: { permissionIds } }); },
  },
  permissions: {
    async list(signal?: AbortSignal) { return data(await request<DataResponse<PermissionAdmin[]>>('permissions', { signal })); },
    async get(id: string, signal?: AbortSignal) { return data(await request<DataResponse<PermissionAdmin>>(`permissions/${id}`, { signal })); },
    async create(input: PermissionInput) { return data(await request<DataResponse<PermissionAdmin>>('permissions', { method: 'POST', body: input })); },
    async update(id: string, input: PermissionUpdateInput) { return data(await request<DataResponse<PermissionAdmin>>(`permissions/${id}`, { method: 'PATCH', body: input })); },
    async remove(id: string): Promise<void> { await request<void>(`permissions/${id}`, { method: 'DELETE' }); },
  },
};