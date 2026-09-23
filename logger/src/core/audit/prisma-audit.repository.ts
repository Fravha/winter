import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { AuditRepository } from "./audit.repository.js";
import type { AuditLogPage, AuditLogQuery, AuditRecord } from "./audit.types.js";

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly client: Pick<PrismaClient, "auditLog">) {}

  async create(record: AuditRecord): Promise<void> {
    await this.client.auditLog.create({
      data: {
        action: record.action,
        resourceType: record.resourceType,

        ...(record.actorUserId !== undefined
          ? { actorUserId: record.actorUserId }
          : {}),

        ...(record.resourceId !== undefined
          ? { resourceId: record.resourceId }
          : {}),

        ...(record.metadata !== undefined
          ? { metadata: record.metadata as Prisma.InputJsonValue }
          : {}),

        ...(record.ipAddress !== undefined
          ? { ipAddress: record.ipAddress }
          : {}),

        ...(record.requestId !== undefined
          ? { requestId: record.requestId }
          : {}),
      },
    });
  }

  async list(query: AuditLogQuery): Promise<AuditLogPage> {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {}),
      ...(query.resourceId ? { resourceId: query.resourceId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.client.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          actorUserId: true,
          action: true,
          resourceType: true,
          resourceId: true,
          metadata: true,
          ipAddress: true,
          requestId: true,
          createdAt: true,
        },
      }),
      this.client.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}
