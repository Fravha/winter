export type AuditJsonPrimitive = string | number | boolean | null;

export type AuditJsonValue =
  | AuditJsonPrimitive
  | AuditJsonValue[]
  | { [key: string]: AuditJsonValue };

export type AuditMetadata = Record<string, AuditJsonValue>;

export interface AuditContext {
  actorUserId?: string;
  ipAddress?: string;
  requestId?: string;
}

export interface AuthenticatedAuditContext extends AuditContext {
  actorUserId: string;
  permissions?: readonly string[];
}

export interface AuditEvent {
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: AuditMetadata;
}

export interface AuditRecord {
  action: string;
  resourceType: string;
  actorUserId?: string;
  resourceId?: string;
  metadata?: AuditMetadata;
  ipAddress?: string;
  requestId?: string;
}

export interface AuditLogQuery {
  actorUserId?: string | undefined;
  action?: string | undefined;
  resourceType?: string | undefined;
  resourceId?: string | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  page: number;
  pageSize: number;
}

export interface AuditLogRecord {
  id: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  requestId: string | null;
  createdAt: Date;
}

export interface AuditLogPage {
  items: AuditLogRecord[];
  total: number;
}
