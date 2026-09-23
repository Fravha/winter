import type { AuditLogPage, AuditLogQuery } from "../../../core/audit/audit.types.js";
import type { PrismaAuditRepository } from "../../../core/audit/prisma-audit.repository.js";

export interface AuditLogDto {
  id: string;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  data: AuditLogDto[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export class AuditLogService {
  constructor(
    private readonly repository: Pick<PrismaAuditRepository, "list">,
  ) {}

  async list(query: AuditLogQuery): Promise<AuditLogListResponse> {
    const result: AuditLogPage = await this.repository.list(query);
    return {
      data: result.items.map((item) => ({
        id: item.id,
        actorUserId: item.actorUserId,
        action: item.action,
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        metadata: item.metadata,
        ipAddress: item.ipAddress,
        requestId: item.requestId,
        createdAt: item.createdAt.toISOString(),
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }
}