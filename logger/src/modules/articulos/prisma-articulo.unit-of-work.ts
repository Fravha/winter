import { PrismaAuditRepository } from "../../core/audit/prisma-audit.repository.js";
import { AuditService } from "../../core/audit/audit.service.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { PrismaArticuloRepository } from "./prisma-articulo.repository.js";
import type {
  ArticuloTransaction,
  ArticuloUnitOfWork,
} from "./articulo.unit-of-work.js";

export class PrismaArticuloUnitOfWork implements ArticuloUnitOfWork {
  constructor(private readonly client: PrismaClient) {}

  execute<T>(
    work: (transaction: ArticuloTransaction) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(async (transaction) =>
      work({
        articulos: new PrismaArticuloRepository(transaction),
        audit: new AuditService(new PrismaAuditRepository(transaction)),
      })
    );
  }
}