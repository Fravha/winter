export type AdminStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED';

export type AuditLog = {
  id: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  requestId: string | null;
  createdAt: string;
};

export type AuditLogQuery = {
  actorUserId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AuditLogListResponse = {
  data: AuditLog[];
  meta: PaginationMeta;
};

export type PermissionSummary = {
  id: string;
  code: string;
  name: string;
};

export type RoleSummary = {
  id: string;
  code: string;
  name: string;
};

export type UserAdmin = {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  status: AdminStatus;
  lastLoginAt: string | null;
  role: RoleSummary | null;
  createdAt: string;
  updatedAt: string;
};

export type RoleAdmin = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: PermissionSummary[];
  createdAt: string;
  updatedAt: string;
};

export type PermissionAdmin = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserInput = {
  email: string;
  roleId: string;
  displayName?: string;
};

export type UserUpdateInput = {
  email?: string;
  displayName?: string | null;
};

export type RoleInput = {
  code: string;
  name: string;
  description?: string;
};

export type RoleUpdateInput = {
  name?: string;
  description?: string | null;
};

export type PermissionInput = {
  code: string;
  name: string;
  description?: string | null;
};

export type PermissionUpdateInput = {
  code?: string;
  name?: string;
  description?: string | null;
};