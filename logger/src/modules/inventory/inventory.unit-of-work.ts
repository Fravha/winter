import type { PrismaClient } from "../../generated/prisma/client.js";
import { SharedUnitOfWork } from "../../core/database/shared-unit-of-work.js";
import type { SharedTransactionContext } from "../../core/database/shared-unit-of-work.js";
export class InventoryUnitOfWork {
 constructor(private readonly prisma: PrismaClient) {}
 execute<T>(work: (transaction: SharedTransactionContext) => Promise<T>): Promise<T> {
   return new SharedUnitOfWork(this.prisma).execute(work);
 }
}