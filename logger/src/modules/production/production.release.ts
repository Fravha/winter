import { Prisma } from "../../generated/prisma/client.js";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { AuthenticatedAuditContext, AuditMetadata } from "../../core/audit/audit.types.js";
import type { AuditService } from "../../core/audit/audit.service.js";
import { SharedUnitOfWork } from "../../core/database/shared-unit-of-work.js";
import type { SharedTransactionContext } from "../../core/database/shared-unit-of-work.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { InventoryApi } from "../inventory/inventory.api.js";
import { createTrustedIntermoduleContext, type InventoryLotClassification } from "../inventory/inventory.model.js";
import { BatchAvailabilityService, BatchLedgerService } from "./production.batch.js";

export interface ReleaseBatchInput {
  productionBatchId: string; quantity: string; warehouseId: string; operationKey: string;
  lotCode: string; classification: InventoryLotClassification; fechaIngreso: Date; observations?: string;
}
export interface ReleaseBatchResult {
  releaseId: string;
  productionBatchId: string; quantity: string; remainingProductionQuantity: string;
  inventoryLotId: string; inventoryMovementId: string; warehouseId: string;
}
const quantity = (value: string) => {
  if (!/^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/.test(value)) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Quantity must be positive with at most three decimal places", 400);
  const result = new Prisma.Decimal(value);
  if (result.lte(0)) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Quantity must be positive", 400);
  return result;
};
const keyLock = (tx: SharedTransactionContext, key: string) => tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtext(${key}))`;
const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.keys(value as object).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
const digest = (input: ReleaseBatchInput): string => createHash("sha256").update(canonical(input)).digest("hex");
const releaseResultSchema = z.object({ releaseId: z.string().uuid(), productionBatchId: z.string().uuid(), quantity: z.string(), remainingProductionQuantity: z.string(), inventoryLotId: z.string().uuid(), inventoryMovementId: z.string().uuid(), warehouseId: z.string().uuid() });

export class ProductionReleaseService {
  constructor(private readonly prisma: PrismaClient, private readonly inventory: InventoryApi, private readonly auditFactory: (tx: SharedTransactionContext) => AuditService) {}
  listActiveWarehouseOptions() { return this.inventory.listActiveWarehouseOptions(); }
  async release(input: ReleaseBatchInput, context: AuthenticatedAuditContext): Promise<ReleaseBatchResult> {
    const amount = quantity(input.quantity);
    const normalized: ReleaseBatchInput = {
      productionBatchId: input.productionBatchId, quantity: amount.toFixed(3), warehouseId: input.warehouseId,
      operationKey: input.operationKey.trim(), lotCode: input.lotCode.trim(), classification: input.classification,
      fechaIngreso: new Date(input.fechaIngreso.toISOString()), ...(input.observations?.trim() ? { observations: input.observations.trim() } : {}),
    };
    if (!normalized.operationKey || !normalized.lotCode) throw new AppError("VALIDATION_ERROR", "Operation key and lot code are required", 400);
    if (normalized.classification !== "PRODUCTO_ENVASADO") throw new AppError("INVALID_LOT_CLASSIFICATION", "Production output lots must start as PRODUCTO_ENVASADO", 400);
    const hash = digest({ ...normalized, fechaIngreso: normalized.fechaIngreso.toISOString() } as unknown as ReleaseBatchInput);
    return new SharedUnitOfWork(this.prisma).execute(async tx => {
      await keyLock(tx, normalized.operationKey);
      const prior = await tx.productionBatchOperation.findUnique({ where: { operationKey: normalized.operationKey } });
      if (prior) {
        if (prior.operation !== "BATCH_RELEASED_TO_INVENTORY" || prior.requestHash !== hash) throw new AppError("IDEMPOTENCY_CONFLICT", "Operation key was used with a different request", 409);
        const parsed = releaseResultSchema.safeParse(prior.result);
        if (!parsed.success) throw new AppError("IDEMPOTENCY_CONFLICT", "Stored operation result is invalid", 409);
        return parsed.data;
      }
      const initialBatch = await tx.productionBatch.findUnique({ where: { id: normalized.productionBatchId } });
      const orderId = initialBatch?.productionOrderId;
      if (!orderId) throw new AppError("BATCH_NOT_FOUND", "Production batch not found", 404);
      await tx.$queryRaw`SELECT id FROM production_orders WHERE id = ${orderId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM production_batches WHERE id = ${normalized.productionBatchId}::uuid FOR UPDATE`;
      const batch = await tx.productionBatch.findUnique({ where: { id: normalized.productionBatchId } });
      if (!batch) throw new AppError("BATCH_NOT_FOUND", "Production batch not found", 404);
      const order = await tx.productionOrder.findUnique({ where: { id: batch.productionOrderId } });
      if (!order) throw new AppError("PRODUCTION_ORDER_NOT_FOUND", "Production order not found", 404);
      const balance = await new BatchAvailabilityService(tx, true).assertAvailable(batch.id, amount, batch.unit);
      const inventoryResult = await this.inventory.releaseProductionOutput({ warehouseId: normalized.warehouseId, articuloId: batch.articuloId, unit: batch.unit, quantity: normalized.quantity, lotCode: normalized.lotCode, classification: "PRODUCTO_ENVASADO", fechaIngreso: normalized.fechaIngreso, ...(normalized.observations === undefined ? {} : { observations: normalized.observations }), originProductionBatchId: batch.id, idempotencyKey: `${normalized.operationKey}:inventory` }, createTrustedIntermoduleContext(context), tx);
      await new BatchLedgerService(tx, true).append(batch.id, "TRANSFERRED_TO_INVENTORY", amount, batch.unit, `${normalized.operationKey}:ledger`, context.actorUserId, new Date(), { warehouseId: normalized.warehouseId, inventoryLotId: inventoryResult.inventoryLotId, inventoryMovementId: inventoryResult.inventoryMovementId, operationKey: normalized.operationKey });
      const remaining = await new BatchAvailabilityService(tx, true).rebuild(batch.id);
       const release = await tx.productionInventoryRelease.create({ data: { productionBatchId: batch.id, quantity: amount, unit: batch.unit, warehouseId: normalized.warehouseId, inventoryLotId: inventoryResult.inventoryLotId, inventoryMovementId: inventoryResult.inventoryMovementId, operationKey: normalized.operationKey, actorUserId: context.actorUserId, occurredAt: new Date(), observations: normalized.observations ?? null } });
       const result: ReleaseBatchResult = { releaseId: release.id, productionBatchId: batch.id, quantity: amount.toFixed(3), remainingProductionQuantity: remaining.available, inventoryLotId: inventoryResult.inventoryLotId, inventoryMovementId: inventoryResult.inventoryMovementId, warehouseId: normalized.warehouseId };
       await tx.productionBatchOperation.create({ data: { operationKey: normalized.operationKey, operation: "BATCH_RELEASED_TO_INVENTORY", requestHash: hash, result: result as unknown as Prisma.InputJsonValue } });
       await this.auditFactory(tx).record(context, { action: "PRODUCTION_BATCH_RELEASED_TO_INVENTORY", resourceType: "production.batch", resourceId: batch.id, metadata: { ...result, operationKey: normalized.operationKey } as unknown as AuditMetadata });
      void balance;
      return result;
    });
  }
  async list(batchId: string) {
    const [batch, rows] = await Promise.all([
      this.prisma.productionBatch.findUniqueOrThrow({ where: { id: batchId }, select: { articuloId: true } }),
      this.prisma.productionInventoryRelease.findMany({ where: { productionBatchId: batchId }, include: { reversal: true, warehouse: true, inventoryLot: true }, orderBy: [{ occurredAt: "asc" }, { id: "asc" }] }),
    ]);
    const activeRows = rows.filter(row => !row.reversal);
    const reversible = await this.inventory.areProductionOutputsReversible(activeRows.map(row => ({ warehouseId: row.warehouseId, articuloId: batch.articuloId, unit: row.unit, quantity: row.quantity.toFixed(3), inventoryLotId: row.inventoryLotId })), createTrustedIntermoduleContext({ actorUserId: rows[0]?.actorUserId ?? "00000000-0000-4000-8000-000000000000" }));
    const reversibleById = new Map(activeRows.map((row, index) => [row.id, reversible[index] ?? false]));
    return rows.map(row => ({ releaseId: row.id, productionBatchId: row.productionBatchId, quantity: row.quantity.toFixed(3), unit: row.unit, warehouseId: row.warehouseId, warehouse: { id: row.warehouse.id, code: row.warehouse.codigo, name: row.warehouse.nombre }, inventoryLotId: row.inventoryLotId, inventoryLot: { id: row.inventoryLot.id, lotCode: row.inventoryLot.lotCode, classification: row.inventoryLot.classification }, inventoryMovementId: row.inventoryMovementId, operationKey: row.operationKey, actorUserId: row.actorUserId, occurredAt: row.occurredAt.toISOString(), observations: row.observations, status: row.reversal ? "REVERSED" : "ACTIVE", reversible: reversibleById.get(row.id) ?? false, reversal: row.reversal ? { operationKey: row.reversal.operationKey, reason: row.reversal.reason, actorUserId: row.reversal.actorUserId, occurredAt: row.reversal.occurredAt.toISOString(), inventoryMovementId: row.reversal.inventoryMovementId } : null }));
  }
  async reverse(batchId: string, releaseId: string, input: { operationKey: string; reason: string }, context: AuthenticatedAuditContext) {
    const normalized = { operationKey: input.operationKey.trim(), reason: input.reason.trim() };
    if (!normalized.operationKey || !normalized.reason) throw new AppError("VALIDATION_ERROR", "Operation key and reason are required", 400);
    const hash = digest({ productionBatchId: batchId, releaseId, ...normalized } as unknown as ReleaseBatchInput);
    return new SharedUnitOfWork(this.prisma).execute(async tx => {
      await keyLock(tx, normalized.operationKey);
      const prior = await tx.productionBatchOperation.findUnique({ where: { operationKey: normalized.operationKey } });
      if (prior) {
        if (prior.operation !== "BATCH_RELEASE_REVERSED" || prior.requestHash !== hash) throw new AppError("IDEMPOTENCY_CONFLICT", "Operation key was used with a different request", 409);
        return prior.result;
      }
      const release = await tx.productionInventoryRelease.findUnique({ where: { id: releaseId }, include: { reversal: true } });
      if (!release || release.productionBatchId !== batchId) throw new AppError("RELEASE_NOT_FOUND", "Production release not found", 404);
      if (release.reversal) throw new AppError("RELEASE_ALREADY_REVERSED", "Production release was already reversed", 409);
      const result = await this.inventory.reverseProductionOutput({ warehouseId: release.warehouseId, articuloId: (await tx.productionBatch.findUniqueOrThrow({ where: { id: batchId } })).articuloId, unit: release.unit, quantity: release.quantity.toFixed(3), inventoryLotId: release.inventoryLotId, idempotencyKey: `${normalized.operationKey}:inventory`, reason: normalized.reason }, createTrustedIntermoduleContext(context), tx);
      await new BatchLedgerService(tx, true).append(batchId, "INVENTORY_RELEASE_RESTORED", release.quantity, release.unit, `${normalized.operationKey}:ledger`, context.actorUserId, new Date(), { releaseId, inventoryMovementId: result.inventoryMovementId, reason: normalized.reason });
      await tx.productionInventoryReversal.create({ data: { releaseId, operationKey: normalized.operationKey, reason: normalized.reason, actorUserId: context.actorUserId, occurredAt: new Date(), inventoryMovementId: result.inventoryMovementId } });
      const balance = await new BatchAvailabilityService(tx, true).rebuild(batchId);
      const stored = { releaseId, reversalOperationKey: normalized.operationKey, inventoryMovementId: result.inventoryMovementId, remainingProductionQuantity: balance.available };
      await tx.productionBatchOperation.create({ data: { operationKey: normalized.operationKey, operation: "BATCH_RELEASE_REVERSED", requestHash: hash, result: stored as unknown as Prisma.InputJsonValue } });
      await this.auditFactory(tx).record(context, { action: "PRODUCTION_BATCH_RELEASE_REVERSED", resourceType: "production.inventory_release", resourceId: releaseId, metadata: stored as unknown as AuditMetadata });
      return stored;
    });
  }
}