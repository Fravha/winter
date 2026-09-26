import type { AuditLogQuery } from '../types';

export const adminKeys = {
  auditLogs: {
    list: (filters: AuditLogQuery) => ['admin', 'auditLogs', 'list', filters] as const,
  },
  users: {
    all: ['admin', 'users'] as const,
    detail: (id: string) => [...adminKeys.users.all, 'detail', id] as const,
  },
  roles: {
    all: ['admin', 'roles'] as const,
    detail: (id: string) => [...adminKeys.roles.all, 'detail', id] as const,
  },
  permissions: {
    all: ['admin', 'permissions'] as const,
    detail: (id: string) => [...adminKeys.permissions.all, 'detail', id] as const,
  },
};