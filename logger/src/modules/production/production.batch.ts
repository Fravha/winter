import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { AuditService } from "../../core/audit/audit.service.js";
import { PrismaAuditRepository } from "../../core/audit/prisma-audit.repository.js";
import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import { SharedUnitOfWork, isSerializationConflict } from "../../core/database/shared-unit-of-work.js";
import type { SharedTransactionContext } from "../../core/database/shared-unit-of-work.js";
import { AppError } from "../../shared/errors/app-error.js";
import { z } from "zod";

type Db = PrismaClient | SharedTransactionContext;
type EntryType = "GENERATED" | "CONSUMED" | "SEPARATED";
const quantityPattern = /^(?:0|[1-9]\d{0,12})(?:\.\d{1,3})?$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requireUuid = (value: string, name: string): void => { if (!uuidPattern.test(value)) throw new AppError("INVALID_BATCH_TRANSFORMATION", `${name} must be a UUID`, 400); };
const requireText = (value: string, name: string): void => { if (!value.trim()) throw new AppError("INVALID_BATCH_TRANSFORMATION", `${name} is required`, 400); };

export interface BatchDto {
  id: string; code: string; productionOrderId: string; articuloId: string; unit: string;
  createdAt: string; observations: string | null; version: number;
}
export interface BatchBalanceDto {
  productionBatchId: string; generated: string; consumed: string; separated: string;
  lost: string; transferredToInventory: string; available: string; ledgerVersion: number; updatedAt: string;
}
export interface BatchDetailDto extends BatchDto { balance: BatchBalanceDto; }
export interface BatchListFilters { page?: number; pageSize?: number; articuloId?: string | undefined; productionOrderId?: string | undefined; }
export interface BatchCreateInput { code: string; productionOrderId: string; articuloId: string; unit: string; quantity: string; observations?: string; operationKey: string; requestHash: string; occurredAt?: Date; }
export interface BatchConsumptionInput { batchId: string; quantity: string; unit: string; operationKey: string; requestHash: string; occurredAt?: Date; }
export interface BatchSplitInput { parentBatchId: string; children: Array<{ code: string; quantity: string; observations?: string }>; operationKey: string; requestHash: string; occurredAt?: Date; }
export interface BatchMergeInput { parentBatches: Array<{ batchId: string; quantity: string }>; code: string; articuloId: string; unit: string; productionOrderId: string; observations?: string; operationKey: string; requestHash: string; occurredAt?: Date; }
export interface BatchLineageDto { id: string; parentBatchId: string; childBatchId: string; quantity: string | null; unit: string | null; operationKey: string; createdAt: string; }

const decimal = (value: string | Prisma.Decimal): Prisma.Decimal => {
  if (value instanceof Prisma.Decimal) return value;
  if (!quantityPattern.test(value)) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Quantity must be positive with at most three decimal places", 400);
  const parsed = new Prisma.Decimal(value);
  if (parsed.lte(0) || parsed.decimalPlaces() > 3) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Quantity must be positive with at most three decimal places", 400);
  return parsed;
};
const quantityString = (value: Prisma.Decimal | string): string => new Prisma.Decimal(value).toFixed(3);
const dateString = (value: Date): string => value.toISOString();
function output(value: unknown): Prisma.InputJsonValue {
  if (value === null) return null as unknown as Prisma.InputJsonValue;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(output);
  if (typeof value === "object") {
    const result: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, item] of Object.entries(value)) result[key] = output(item);
    return result;
  }
  throw new AppError("INVALID_BATCH_TRANSFORMATION", "Operation result is not JSON serializable", 400);
}
const batchDtoSchema = z.object({ id: z.string(), code: z.string(), productionOrderId: z.string(), articuloId: z.string(), unit: z.string(), createdAt: z.string(), observations: z.string().nullable(), version: z.number().int() });
const balanceDtoSchema = z.object({ productionBatchId: z.string(), generated: z.string(), consumed: z.string(), separated: z.string(), lost: z.string(), transferredToInventory: z.string(), available: z.string(), ledgerVersion: z.number().int(), updatedAt: z.string() });
const detailDtoSchema = batchDtoSchema.extend({ balance: balanceDtoSchema });
const storedResultSchemas = {
  BATCH_CREATED: detailDtoSchema,
  BATCH_MERGED: detailDtoSchema,
  BATCH_CONSUMED: balanceDtoSchema,
  BATCH_SPLIT: z.object({ parent: balanceDtoSchema, children: z.array(detailDtoSchema) }),
} as const;

function mapBatch(item: { id: string; code: string; productionOrderId: string; articuloId: string; unit: string; createdAt: Date; observations: string | null; version: number }): BatchDto {
  return { id: item.id, code: item.code, productionOrderId: item.productionOrderId, articuloId: item.articuloId, unit: item.unit, createdAt: dateString(item.createdAt), observations: item.observations, version: item.version };
}
function mapBalance(item: { productionBatchId: string; generated: Prisma.Decimal; consumed: Prisma.Decimal; separated: Prisma.Decimal; lost: Prisma.Decimal; transferredToInventory: Prisma.Decimal; available: Prisma.Decimal; ledgerVersion: number; updatedAt: Date }): BatchBalanceDto {
  return { productionBatchId: item.productionBatchId, generated: quantityString(item.generated), consumed: quantityString(item.consumed), separated: quantityString(item.separated), lost: quantityString(item.lost), transferredToInventory: quantityString(item.transferredToInventory), available: quantityString(item.available), ledgerVersion: item.ledgerVersion, updatedAt: dateString(item.updatedAt) };
}

async function lockBatches(db: Db, ids: string[]): Promise<void> {
  if (!("$queryRaw" in db) || typeof db.$queryRaw !== "function") {
    throw new AppError("PRODUCTION_CONCURRENCY_CONFLICT", "Batch locking requires a transaction", 409);
  }
  for (const id of [...new Set(ids)].sort()) {
    requireUuid(id, "Batch id");
    await db.$queryRaw`SELECT id FROM production_batches WHERE id = ${id}::uuid FOR UPDATE`;
  }
}

async function lockOperation(db: SharedTransactionContext, key: string): Promise<void> {
  await db.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext(${key}))`;
}

function decodeStoredResult(operation: string, result: unknown): BatchDetailDto | BatchBalanceDto | { parent: BatchBalanceDto; children: BatchDetailDto[] } {
  const schema = storedResultSchemas[operation as keyof typeof storedResultSchemas];
  if (!schema) throw new AppError("IDEMPOTENCY_CONFLICT", "Unknown stored batch operation", 409);
  const parsed = schema.safeParse(result);
  if (!parsed.success) throw new AppError("IDEMPOTENCY_CONFLICT", "Stored operation result is invalid", 409);
  return parsed.data as BatchDetailDto | BatchBalanceDto | { parent: BatchBalanceDto; children: BatchDetailDto[] };
}

export class ProductionBatchRepository {
  constructor(private readonly db: Db) {}
  find(id: string) { return this.db.productionBatch.findUnique({ where: { id } }); }
  findByCode(code: string) { return this.db.productionBatch.findUnique({ where: { code } }); }
  list(filters: BatchListFilters) {
    const page = filters.page ?? 1; const pageSize = filters.pageSize ?? 20;
    const where = { ...(filters.articuloId ? { articuloId: filters.articuloId } : {}), ...(filters.productionOrderId ? { productionOrderId: filters.productionOrderId } : {}) };
    return Promise.all([
      this.db.productionBatch.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: [{ createdAt: "desc" }, { code: "asc" }] }),
      this.db.productionBatch.count({ where }),
    ]).then(([items, total]) => ({ items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } }));
  }
  ledger(batchId: string) { return this.db.productionBatchLedgerEntry.findMany({ where: { productionBatchId: batchId }, orderBy: [{ occurredAt: "asc" }, { id: "asc" }] }); }
}

export class BatchAvailabilityService {
  constructor(private readonly db: Db, private readonly transactional = false) {}
  async rebuild(batchId: string): Promise<BatchBalanceDto> {
    if (!this.transactional) {
      return new SharedUnitOfWork(this.db as PrismaClient).execute(async tx => new BatchAvailabilityService(tx, true).rebuild(batchId));
    }
    await lockBatches(this.db, [batchId]);
    const entries = await this.db.productionBatchLedgerEntry.findMany({ where: { productionBatchId: batchId } });
    const totals = { generated: new Prisma.Decimal(0), consumed: new Prisma.Decimal(0), separated: new Prisma.Decimal(0), lost: new Prisma.Decimal(0), transferredToInventory: new Prisma.Decimal(0) };
    for (const entry of entries) {
      if (entry.entryType === "GENERATED") totals.generated = totals.generated.plus(entry.quantity);
      if (entry.entryType === "CONSUMED") totals.consumed = totals.consumed.plus(entry.quantity);
      if (entry.entryType === "SEPARATED") totals.separated = totals.separated.plus(entry.quantity);
      if (entry.entryType === "LOSS") totals.lost = totals.lost.plus(entry.quantity);
      if (entry.entryType === "TRANSFERRED_TO_INVENTORY") totals.transferredToInventory = totals.transferredToInventory.plus(entry.quantity);
    }
    const available = totals.generated.minus(totals.consumed).minus(totals.separated).minus(totals.lost).minus(totals.transferredToInventory);
    if (available.lt(0)) throw new AppError("INSUFFICIENT_BATCH_QUANTITY", "Batch available quantity cannot be negative", 409);
    const current = await this.db.productionBatchBalance.findUnique({ where: { productionBatchId: batchId } });
    if (current && current.ledgerVersion > entries.length) return mapBalance(current);
    const balance = await this.db.productionBatchBalance.upsert({
      where: { productionBatchId: batchId },
      update: { ...totals, available, ledgerVersion: entries.length },
      create: { productionBatchId: batchId, ...totals, available, ledgerVersion: entries.length },
    });
    return mapBalance(balance);
  }
  async get(batchId: string): Promise<BatchBalanceDto> {
    if (!this.transactional) {
      return new SharedUnitOfWork(this.db as PrismaClient).execute(async tx => new BatchAvailabilityService(tx, true).get(batchId));
    }
    await lockBatches(this.db, [batchId]);
    const batch = await this.db.productionBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new AppError("BATCH_NOT_FOUND", "Production batch not found", 404);
    return this.rebuild(batchId);
  }
  async assertAvailable(batchId: string, quantity: Prisma.Decimal, unit: string): Promise<{ batch: { id: string; unit: string }; balance: BatchBalanceDto }> {
    if (quantity.lte(0) || quantity.decimalPlaces() > 3) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Quantity must be positive with at most three decimal places", 400);
    if (!this.transactional) {
      return new SharedUnitOfWork(this.db as PrismaClient).execute(async tx => new BatchAvailabilityService(tx, true).assertAvailable(batchId, quantity, unit));
    }
    await lockBatches(this.db, [batchId]);
    const batch = await this.db.productionBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new AppError("BATCH_NOT_FOUND", "Production batch not found", 404);
    if (batch.unit !== unit) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Batch unit does not match operation unit", 409);
    const balance = await this.rebuild(batchId);
    if (new Prisma.Decimal(balance.available).lt(quantity)) throw new AppError("INSUFFICIENT_BATCH_QUANTITY", "Insufficient batch quantity", 409);
    return { batch, balance };
  }
}

export class BatchLedgerService {
  constructor(private readonly db: Db, private readonly transactional = false) {}
  async append(batchId: string, entryType: EntryType, quantity: Prisma.Decimal, unit: string, operationKey: string, actorUserId: string, occurredAt: Date, metadata?: object): Promise<unknown> {
    requireUuid(batchId, "Batch id");
    requireText(operationKey, "Operation key");
    requireText(unit, "Unit");
    requireUuid(actorUserId, "Actor user id");
    if (!["GENERATED", "CONSUMED", "SEPARATED"].includes(entryType)) throw new AppError("INVALID_BATCH_TRANSFORMATION", "P3 only supports generated, consumed and separated ledger facts", 400);
    if (quantity.lte(0) || quantity.decimalPlaces() > 3) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Ledger quantity must be positive with at most three decimal places", 400);
    if (!this.transactional) {
      return new SharedUnitOfWork(this.db as PrismaClient).execute(async tx => new BatchLedgerService(tx, true).append(batchId, entryType, quantity, unit, operationKey, actorUserId, occurredAt, metadata));
    }
    await lockBatches(this.db, [batchId]);
    const batch = await this.db.productionBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new AppError("BATCH_NOT_FOUND", "Production batch not found", 404);
    if (batch.unit !== unit) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Batch unit does not match operation unit", 409);
    if (entryType !== "GENERATED") {
      const availability = new BatchAvailabilityService(this.db, true);
      const { balance } = await availability.assertAvailable(batchId, quantity, unit);
      const allocations = await this.db.productionContainerOccupancy.findMany({ where: { batchId, closedAt: null }, select: { quantity: true } });
      const allocated = allocations.reduce((sum, row) => sum.plus(row.quantity), new Prisma.Decimal(0));
      if (new Prisma.Decimal(balance.available).minus(quantity).lt(allocated)) {
        throw new AppError("INSUFFICIENT_BATCH_QUANTITY", "Reduction would consume quantity allocated to a production container", 409);
      }
    }
    try {
      return await this.db.productionBatchLedgerEntry.create({ data: { productionBatchId: batchId, entryType, quantity, unit, operationKey, actorUserId, occurredAt, ...(metadata ? { metadata: output(metadata) } : {}) } });
    } catch (error) {
      if (isPrismaCode(error, "P2002")) throw new AppError("IDEMPOTENCY_CONFLICT", "Ledger operation key already exists", 409);
      throw error;
    }
  }
}

export class BatchLineageService {
  constructor(private readonly db: Db, private readonly transactional = false) {}
  async assertNoCycle(parentBatchId: string, childBatchId: string): Promise<void> {
    requireUuid(parentBatchId, "Parent batch id");
    requireUuid(childBatchId, "Child batch id");
    if (!this.transactional) {
      return new SharedUnitOfWork(this.db as PrismaClient).execute(async tx => new BatchLineageService(tx, true).assertNoCycle(parentBatchId, childBatchId));
    }
    if (parentBatchId === childBatchId) throw new AppError("INVALID_BATCH_TRANSFORMATION", "A batch cannot be its own parent", 409);
    const seen = new Set<string>(); const queue = [parentBatchId];
    while (queue.length) {
      const current = queue.shift()!;
      if (seen.has(current)) continue;
      seen.add(current);
      const parents = await this.db.productionBatchLineage.findMany({ where: { childBatchId: current }, select: { parentBatchId: true } });
      for (const parent of parents) {
        if (parent.parentBatchId === childBatchId) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Lineage cycle is not allowed", 409);
        queue.push(parent.parentBatchId);
      }
    }
  }
  async create(parentBatchId: string, childBatchId: string, quantity: Prisma.Decimal | null, unit: string | null, operationKey: string): Promise<unknown> {
    requireText(operationKey, "Operation key");
    if (quantity !== null && (quantity.lte(0) || quantity.decimalPlaces() > 3)) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Lineage quantity must be positive with at most three decimal places", 400);
    if (quantity !== null && !unit) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Lineage quantity requires a unit", 400);
    if (!this.transactional) {
      return new SharedUnitOfWork(this.db as PrismaClient).execute(async tx => new BatchLineageService(tx, true).create(parentBatchId, childBatchId, quantity, unit, operationKey));
    }
    await lockBatches(this.db, [parentBatchId, childBatchId]);
    await this.assertNoCycle(parentBatchId, childBatchId);
    try {
      return await this.db.productionBatchLineage.create({ data: { parentBatchId, childBatchId, quantity, unit, operationKey } });
    } catch (error) {
      if (isPrismaCode(error, "P2002")) throw new AppError("IDEMPOTENCY_CONFLICT", "Lineage operation key already exists", 409);
      throw error;
    }
  }
}

export class ProductionBatchService {
  private readonly audit: AuditService;
  constructor(private readonly prisma: PrismaClient, audit: AuditService) { this.audit = audit; }
  private auditIn(tx: SharedTransactionContext) { return new AuditService(new PrismaAuditRepository(tx)); }
  private async operation<T>(tx: SharedTransactionContext, key: string, operation: string, hash: string, work: () => Promise<T>): Promise<T> {
    await lockOperation(tx, key);
    const existing = await tx.productionBatchOperation.findUnique({ where: { operationKey: key } });
    if (existing) {
      if (existing.requestHash !== hash || existing.operation !== operation) throw new AppError("IDEMPOTENCY_CONFLICT", "Operation key was used with a different request or operation", 409);
      return decodeStoredResult(existing.operation, existing.result) as T;
    }
    const result = await work();
    await tx.productionBatchOperation.create({ data: { operationKey: key, operation, requestHash: hash, result: output(result) } });
    return result;
  }
  private async executeCommand<T>(key: string, operation: string, hash: string, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (!isPrismaCode(error, "P2002") && !isSerializationConflict(error)) throw error;
      const existing = await this.prisma.productionBatchOperation.findUnique({ where: { operationKey: key } });
      if (existing) {
        if (existing.operation !== operation || existing.requestHash !== hash) throw new AppError("IDEMPOTENCY_CONFLICT", "Operation key was used with a different request or operation", 409);
        return decodeStoredResult(existing.operation, existing.result) as T;
      }
      if (isPrismaCode(error, "P2002") && isCodeUniqueConflict(error)) throw new AppError("PRODUCTION_CODE_ALREADY_EXISTS", "Production batch code already exists", 409);
      if (isPrismaCode(error, "P2002")) throw new AppError("IDEMPOTENCY_CONFLICT", "Operation key could not be claimed", 409);
      throw new AppError("PRODUCTION_CONCURRENCY_CONFLICT", "Batch operation changed concurrently; retry with the same operation key", 409);
    }
  }
  private operationWithTransaction<T>(key: string, operation: string, hash: string, work: (tx: SharedTransactionContext) => Promise<T>): Promise<T> {
    return new SharedUnitOfWork(this.prisma).execute(async tx => this.operation(tx, key, operation, hash, () => work(tx)));
  }
  private async orderOpen(tx: SharedTransactionContext, id: string) {
    const order = await tx.productionOrder.findUnique({ where: { id } });
    if (!order) throw new AppError("PRODUCTION_ORDER_NOT_FOUND", "Production order not found", 404);
    if (order.status !== "OPEN") throw new AppError("PRODUCTION_ORDER_CLOSED", "Production order is closed", 409);
  }
  async createBatch(data: BatchCreateInput, context: AuthenticatedAuditContext): Promise<BatchDetailDto> {
    validateCreateInput(data, context);
    const quantity = decimal(data.quantity);
    return this.executeCommand(data.operationKey, "BATCH_CREATED", data.requestHash, async () => this.operationWithTransaction(data.operationKey, "BATCH_CREATED", data.requestHash, async tx => {
        await this.orderOpen(tx, data.productionOrderId);
        const occurredAt = data.occurredAt ?? new Date();
        const generated = await createInitialBatchPrimitive(tx, { code: data.code, productionOrderId: data.productionOrderId, articuloId: data.articuloId, unit: data.unit, quantity: data.quantity, operationKey: data.operationKey, requestHash: data.requestHash, ...(data.observations !== undefined ? { observations: data.observations } : {}) }, context, occurredAt);
        await this.auditIn(tx).record(context, { action: "BATCH_CREATED", resourceType: "production.batch", resourceId: generated.id, metadata: { code: generated.code, quantity: quantityString(quantity), unit: data.unit } });
        return generated;
      }));
  }
  async consumeBatch(data: BatchConsumptionInput, context: AuthenticatedAuditContext): Promise<BatchBalanceDto> {
    validateConsumptionInput(data, context);
    const quantity = decimal(data.quantity);
    return this.executeCommand(data.operationKey, "BATCH_CONSUMED", data.requestHash, async () => this.operationWithTransaction(data.operationKey, "BATCH_CONSUMED", data.requestHash, async tx => {
        await lockBatches(tx, [data.batchId]);
        const batch = await tx.productionBatch.findUnique({ where: { id: data.batchId } });
        if (!batch) throw new AppError("BATCH_NOT_FOUND", "Production batch not found", 404);
        await new BatchLedgerService(tx, true).append(data.batchId, "CONSUMED", quantity, data.unit, `${data.operationKey}:consumed`, context.actorUserId, data.occurredAt ?? new Date());
        const balance = await new BatchAvailabilityService(tx, true).rebuild(data.batchId);
        await this.auditIn(tx).record(context, { action: "BATCH_CONSUMED", resourceType: "production.batch", resourceId: data.batchId, metadata: { quantity: quantityString(quantity), unit: data.unit } });
        return balance;
      }));
  }
  async splitBatch(data: BatchSplitInput, context: AuthenticatedAuditContext): Promise<{ parent: BatchBalanceDto; children: BatchDetailDto[] }> {
    validateSplitInput(data, context);
    if (!data.children.length) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Split requires at least one child", 400);
    const quantities = data.children.map(child => decimal(child.quantity));
    return this.executeCommand(data.operationKey, "BATCH_SPLIT", data.requestHash, async () => this.operationWithTransaction(data.operationKey, "BATCH_SPLIT", data.requestHash, async tx => {
      await lockBatches(tx, [data.parentBatchId]);
      const parent = await tx.productionBatch.findUnique({ where: { id: data.parentBatchId } });
      if (!parent) throw new AppError("BATCH_NOT_FOUND", "Production batch not found", 404);
      const sum = quantities.reduce((total, item) => total.plus(item), new Prisma.Decimal(0));
      await new BatchAvailabilityService(tx, true).assertAvailable(data.parentBatchId, sum, parent.unit);
      const children: BatchDetailDto[] = [];
      for (let index = 0; index < data.children.length; index++) {
        const childInput = data.children[index]!;
        const child = await tx.productionBatch.create({ data: { code: childInput.code, productionOrderId: parent.productionOrderId, articuloId: parent.articuloId, unit: parent.unit, ...(childInput.observations !== undefined ? { observations: childInput.observations } : {}) } });
        await new BatchLedgerService(tx, true).append(child.id, "GENERATED", quantities[index]!, parent.unit, `${data.operationKey}:generated:${index}`, context.actorUserId, data.occurredAt ?? new Date());
        await new BatchLineageService(tx, true).create(parent.id, child.id, quantities[index]!, parent.unit, `${data.operationKey}:lineage:${index}`);
        children.push({ ...mapBatch(child), balance: await new BatchAvailabilityService(tx, true).rebuild(child.id) });
      }
      await new BatchLedgerService(tx, true).append(parent.id, "SEPARATED", sum, parent.unit, `${data.operationKey}:separated`, context.actorUserId, data.occurredAt ?? new Date());
      const parentBalance = await new BatchAvailabilityService(tx, true).rebuild(parent.id);
      await this.auditIn(tx).record(context, { action: "BATCH_SPLIT", resourceType: "production.batch", resourceId: parent.id, metadata: { childCount: children.length, quantity: quantityString(sum), unit: parent.unit } });
      return { parent: parentBalance, children };
    }));
  }
  async mergeBatches(data: BatchMergeInput, context: AuthenticatedAuditContext): Promise<BatchDetailDto> {
    validateMergeInput(data, context);
    if (data.parentBatches.length < 2) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Merge requires at least two parents", 400);
    const quantities = data.parentBatches.map(parent => decimal(parent.quantity));
    return this.executeCommand(data.operationKey, "BATCH_MERGED", data.requestHash, async () => this.operationWithTransaction(data.operationKey, "BATCH_MERGED", data.requestHash, async tx => {
      const ids = data.parentBatches.map(parent => parent.batchId);
      if (new Set(ids).size !== ids.length) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Merge requires distinct parent batches", 400);
      await lockBatches(tx, ids);
      await this.orderOpen(tx, data.productionOrderId);
      const parents = [];
      for (let index = 0; index < data.parentBatches.length; index++) {
        const parent = await tx.productionBatch.findUnique({ where: { id: data.parentBatches[index]!.batchId } });
        if (!parent) throw new AppError("BATCH_NOT_FOUND", "Production batch not found", 404);
        if (parent.unit !== data.unit) throw new AppError("INVALID_BATCH_TRANSFORMATION", "All batch units must match", 409);
        if (parent.articuloId !== data.articuloId) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Merged batches must share article", 409);
        await new BatchAvailabilityService(tx, true).assertAvailable(parent.id, quantities[index]!, data.unit);
        parents.push(parent);
      }
      const sum = quantities.reduce((total, item) => total.plus(item), new Prisma.Decimal(0));
      const child = await tx.productionBatch.create({ data: { code: data.code, productionOrderId: data.productionOrderId, articuloId: data.articuloId, unit: data.unit, ...(data.observations !== undefined ? { observations: data.observations } : {}) } });
      await new BatchLedgerService(tx, true).append(child.id, "GENERATED", sum, data.unit, `${data.operationKey}:generated`, context.actorUserId, data.occurredAt ?? new Date());
      for (let index = 0; index < parents.length; index++) {
        const parent = parents[index]!;
        const quantity = quantities[index]!;
        await new BatchLedgerService(tx, true).append(parent.id, "SEPARATED", quantity, parent.unit, `${data.operationKey}:separated:${index}`, context.actorUserId, data.occurredAt ?? new Date());
        await new BatchLineageService(tx, true).create(parent.id, child.id, quantity, data.unit, `${data.operationKey}:lineage:${index}`);
      }
      const balance = await new BatchAvailabilityService(tx, true).rebuild(child.id);
      await this.auditIn(tx).record(context, { action: "BATCH_MERGED", resourceType: "production.batch", resourceId: child.id, metadata: { parentCount: parents.length, quantity: quantityString(sum), unit: data.unit } });
      return { ...mapBatch(child), balance };
    }));
  }
  async listBatches(filters: BatchListFilters) {
    const result = await new ProductionBatchRepository(this.prisma).list(filters);
    return { items: result.items.map(mapBatch), pagination: result.pagination };
  }
  async getBatch(id: string): Promise<BatchDetailDto> {
    const batch = await new ProductionBatchRepository(this.prisma).find(id);
    if (!batch) throw new AppError("BATCH_NOT_FOUND", "Production batch not found", 404);
    return { ...mapBatch(batch), balance: await new BatchAvailabilityService(this.prisma).get(id) };
  }
  async getAvailableBatchQuantity(id: string): Promise<{ productionBatchId: string; unit: string; available: string }> {
    const batch = await new ProductionBatchRepository(this.prisma).find(id);
    if (!batch) throw new AppError("BATCH_NOT_FOUND", "Production batch not found", 404);
    return { productionBatchId: id, unit: batch.unit, available: (await new BatchAvailabilityService(this.prisma).get(id)).available };
  }
  async validateProductionBatch(id: string) {
    const batch = await new ProductionBatchRepository(this.prisma).find(id);
    if (!batch) throw new AppError("BATCH_NOT_FOUND", "Production batch not found", 404);
    const balance = await new BatchAvailabilityService(this.prisma).get(id);
    return { valid: new Prisma.Decimal(balance.available).gte(0), batchId: id, unit: batch.unit, available: balance.available };
  }
  async lineage(id: string): Promise<BatchLineageDto[]> {
    const batch = await new ProductionBatchRepository(this.prisma).find(id);
    if (!batch) throw new AppError("BATCH_NOT_FOUND", "Production batch not found", 404);
    const edges = await this.prisma.productionBatchLineage.findMany({ where: { OR: [{ parentBatchId: id }, { childBatchId: id }] }, orderBy: { createdAt: "asc" } });
    return edges.map(edge => ({ id: edge.id, parentBatchId: edge.parentBatchId, childBatchId: edge.childBatchId, quantity: edge.quantity ? quantityString(edge.quantity) : null, unit: edge.unit, operationKey: edge.operationKey, createdAt: dateString(edge.createdAt) }));
  }
}

export async function splitOneBatchInTransaction(
  tx: SharedTransactionContext,
  data: { parentBatchId: string; code: string; quantity: string; observations?: string; operationKey: string },
  context: AuthenticatedAuditContext,
  occurredAt = new Date(),
): Promise<{ parent: BatchBalanceDto; child: BatchDetailDto }> {
  requireUuid(data.parentBatchId, "Parent batch id");
  requireText(data.code, "Child code");
  requireText(data.operationKey, "Operation key");
  const quantity = decimal(data.quantity);
  await lockBatches(tx, [data.parentBatchId]);
  const parent = await tx.productionBatch.findUnique({ where: { id: data.parentBatchId } });
  if (!parent) throw new AppError("BATCH_NOT_FOUND", "Production batch not found", 404);
  const availability = await new BatchAvailabilityService(tx, true).assertAvailable(data.parentBatchId, quantity, parent.unit);
  void availability;
  let child;
  try {
    child = await tx.productionBatch.create({ data: { code: data.code, productionOrderId: parent.productionOrderId, articuloId: parent.articuloId, unit: parent.unit, ...(data.observations !== undefined ? { observations: data.observations } : {}) } });
  } catch (error) {
    if (isPrismaCode(error, "P2002")) throw new AppError("PRODUCTION_CODE_ALREADY_EXISTS", "Production batch code already exists", 409);
    throw error;
  }
  await new BatchLedgerService(tx, true).append(child.id, "GENERATED", quantity, parent.unit, `${data.operationKey}:generated`, context.actorUserId, occurredAt);
  await new BatchLineageService(tx, true).create(parent.id, child.id, quantity, parent.unit, `${data.operationKey}:lineage`);
  await new BatchLedgerService(tx, true).append(parent.id, "SEPARATED", quantity, parent.unit, `${data.operationKey}:separated`, context.actorUserId, occurredAt);
  const childBalance = await new BatchAvailabilityService(tx, true).rebuild(child.id);
  const parentBalance = await new BatchAvailabilityService(tx, true).rebuild(parent.id);
  return { parent: parentBalance, child: { ...mapBatch(child), balance: childBalance } };
}

/** P6 primitive: generation plus the P3 ledger/balance services in the caller's transaction. */
export async function createInitialBatchInTransaction(
  tx: SharedTransactionContext,
  data: { code: string; productionOrderId: string; articuloId: string; unit: string; quantity: string; operationKey: string; requestHash: string },
  context: AuthenticatedAuditContext,
  occurredAt: Date,
): Promise<BatchDetailDto> {
  const quantity = decimal(data.quantity);
  requireText(data.requestHash, "Request hash");
  return createInitialBatchPrimitive(tx, data, context, occurredAt);
}
async function createInitialBatchPrimitive(
  tx: SharedTransactionContext,
  data: { code: string; productionOrderId: string; articuloId: string; unit: string; quantity: string; operationKey: string; requestHash: string; observations?: string },
  context: AuthenticatedAuditContext,
  occurredAt: Date,
): Promise<BatchDetailDto> {
  const batch = await tx.productionBatch.create({ data: { code: data.code, productionOrderId: data.productionOrderId, articuloId: data.articuloId, unit: data.unit, ...(data.observations !== undefined ? { observations: data.observations } : {}) } });
  await new BatchLedgerService(tx, true).append(batch.id, "GENERATED", decimal(data.quantity), data.unit, `${data.operationKey}:generated`, context.actorUserId, occurredAt, { requestHash: data.requestHash });
  return { ...mapBatch(batch), balance: await new BatchAvailabilityService(tx, true).rebuild(batch.id) };
}
function isPrismaCode(error: unknown, code: string): boolean { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code; }
function isCodeUniqueConflict(error: unknown): boolean {
  if (!isPrismaCode(error, "P2002")) return false;
  const meta = (error as {
    meta?: {
      target?: unknown;
      driverAdapterError?: {
        cause?: {
          constraint?: { fields?: unknown } | string;
          originalMessage?: unknown;
        };
      };
    };
  }).meta;
  const target = meta?.target;
  if (Array.isArray(target) && target.includes("code")) return true;
  if (typeof target === "string" && target.includes("code")) return true;
  const constraint = meta?.driverAdapterError?.cause?.constraint;
  if (typeof constraint === "object" && constraint !== null) {
    const fields = constraint.fields;
    if (Array.isArray(fields) && fields.includes("code")) return true;
  }
  if (typeof constraint === "string" && constraint.includes("code")) return true;
  const originalMessage = meta?.driverAdapterError?.cause?.originalMessage;
  return typeof originalMessage === "string"
    && (originalMessage.includes("production_batches_code_key") || originalMessage.includes("Key (code)"));
}
function validDate(value: Date | undefined): boolean { return value === undefined || (value instanceof Date && !Number.isNaN(value.getTime())); }
function validateContext(context: AuthenticatedAuditContext): void { requireUuid(context.actorUserId, "Actor user id"); }
function validateCommon(data: { unit: string; operationKey: string; requestHash: string; occurredAt?: Date }, context: AuthenticatedAuditContext): void {
  requireText(data.unit, "Unit"); requireText(data.operationKey, "Operation key"); requireText(data.requestHash, "Request hash");
  if (!validDate(data.occurredAt)) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Occurred at must be a valid date", 400);
  validateContext(context);
}
function validateCreateInput(data: BatchCreateInput, context: AuthenticatedAuditContext): void {
  validateCommon(data, context); requireText(data.code, "Batch code"); requireUuid(data.productionOrderId, "Production order id"); requireUuid(data.articuloId, "Article id");
}
function validateConsumptionInput(data: BatchConsumptionInput, context: AuthenticatedAuditContext): void {
  validateCommon(data, context); requireUuid(data.batchId, "Batch id");
}
function validateSplitInput(data: BatchSplitInput, context: AuthenticatedAuditContext): void {
  requireText(data.operationKey, "Operation key"); requireText(data.requestHash, "Request hash"); validateContext(context);
  if (!validDate(data.occurredAt)) throw new AppError("INVALID_BATCH_TRANSFORMATION", "Occurred at must be a valid date", 400);
  requireUuid(data.parentBatchId, "Parent batch id");
  const codes = new Set<string>();
  for (const child of data.children) {
    requireText(child.code, "Child code");
    if (codes.has(child.code)) throw new AppError("PRODUCTION_CODE_ALREADY_EXISTS", "Child batch code already exists", 409);
    codes.add(child.code);
  }
}
function validateMergeInput(data: BatchMergeInput, context: AuthenticatedAuditContext): void {
  validateCommon(data, context); requireText(data.code, "Batch code"); requireUuid(data.productionOrderId, "Production order id"); requireUuid(data.articuloId, "Article id");
  for (const parent of data.parentBatches) requireUuid(parent.batchId, "Parent batch id");
}