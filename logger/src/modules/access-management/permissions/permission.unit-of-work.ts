import { PrismaAuditRepository } from "../../../core/audit/prisma-audit.repository.js";
import { AuditService } from "../../../core/audit/audit.service.js";
import {
  SharedUnitOfWork,
  type SharedTransactionContext,
} from "../../../core/database/shared-unit-of-work.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { PrismaPermissionRepository } from "./prisma-permission.repository.js";
import type { PermissionRepository } from "./permission.repository.js";

export interface PermissionUnitOfWork {
  execute<T>(
    work: (repository: PermissionRepository, audit: AuditService) => Promise<T>,
  ): Promise<T>;
}

export class PrismaPermissionUnitOfWork implements PermissionUnitOfWork {
  constructor(private readonly client: PrismaClient) {}

  execute<T>(
    work: (repository: PermissionRepository, audit: AuditService) => Promise<T>,
  ): Promise<T> {
    return new SharedUnitOfWork(this.client).execute(async (transaction) => {
      const scoped = transaction as SharedTransactionContext;
      return work(
        new PrismaPermissionRepository(scoped),
        new AuditService(new PrismaAuditRepository(scoped)),
      );
    });
  }
}