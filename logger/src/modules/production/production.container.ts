import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { SharedTransactionContext } from "../../core/database/shared-unit-of-work.js";
import { SharedUnitOfWork, isSerializationConflict } from "../../core/database/shared-unit-of-work.js";
import { AuditService } from "../../core/audit/audit.service.js";
import { PrismaAuditRepository } from "../../core/audit/prisma-audit.repository.js";
import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import { AppError } from "../../shared/errors/app-error.js";
import { BatchAvailabilityService, ProductionBatchService, splitOneBatchInTransaction } from "./production.batch.js";
import { z } from "zod";

const positive = /^(?:0|[1-9]\d{0,12})(?:\.\d{1,3})?$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const q = (value: string): Prisma.Decimal => {
  if (!positive.test(value)) throw new AppError("INVALID_CONTAINER_OPERATION", "Quantity must be positive with at most three decimal places", 400);
  const result = new Prisma.Decimal(value);
  if (result.lte(0) || result.decimalPlaces() > 3) throw new AppError("INVALID_CONTAINER_OPERATION", "Quantity must be positive with at most three decimal places", 400);
  return result;
};
const requireId = (value: string, name: string) => { if (!uuid.test(value)) throw new AppError("INVALID_CONTAINER_OPERATION", `${name} must be a UUID`, 400); };
const requireText = (value: string, name: string) => { if (!value.trim()) throw new AppError("INVALID_CONTAINER_OPERATION", `${name} is required`, 400); };
const textQuantity = (value: Prisma.Decimal | string) => new Prisma.Decimal(value).toFixed(3);
const iso = (value: Date) => value.toISOString();
const requireActor = (context: AuthenticatedAuditContext) => requireId(context.actorUserId, "Actor user id");
const output = (value: unknown): Prisma.InputJsonValue => {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value as Prisma.InputJsonValue;
  if (Array.isArray(value)) return value.map(output);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, output(item)])) as Prisma.InputJsonValue;
  throw new AppError("INVALID_CONTAINER_OPERATION", "Operation result is not JSON serializable", 400);
};
const occupancyResult = z.object({ container: z.object({ id: z.string(), code: z.string(), capacity: z.string(), capacityUnit: z.string(), status: z.string(), observations: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(), version: z.number().int() }), occupancy: z.object({ id: z.string(), containerId: z.string(), batchId: z.string(), quantity: z.string(), unit: z.string(), openedAt: z.string(), closedAt: z.string().nullable() }) });
const batchBalance = z.object({ productionBatchId: z.string(), generated: z.string(), consumed: z.string(), separated: z.string(), lost: z.string(), transferredToInventory: z.string(), available: z.string(), ledgerVersion: z.number().int(), updatedAt: z.string() });
const batchDetail = z.object({ id: z.string(), code: z.string(), productionOrderId: z.string(), articuloId: z.string(), unit: z.string(), createdAt: z.string(), observations: z.string().nullable(), version: z.number().int(), balance: batchBalance });
const partialResult = z.object({ parent: batchBalance, child: batchDetail, source: occupancyResult.shape.occupancy, destination: occupancyResult.shape.occupancy });
const storedResultSchemas = { BATCH_CONTAINER_ASSIGNED: occupancyResult, BATCH_CONTAINER_TRANSFERRED: occupancyResult, BATCH_CONTAINER_PARTIAL_TRANSFERRED: partialResult } as const;
function decodeStoredResult(operation: string, result: unknown): unknown {
  const schema = storedResultSchemas[operation as keyof typeof storedResultSchemas];
  if (!schema) throw new AppError("IDEMPOTENCY_CONFLICT", "Unknown stored container operation", 409);
  const parsed = schema.safeParse(result);
  if (!parsed.success) throw new AppError("IDEMPOTENCY_CONFLICT", "Stored container operation result is invalid", 409);
  return parsed.data;
}
function mapConcurrency(error: unknown): never {
  if (isSerializationConflict(error)) throw new AppError("PRODUCTION_CONCURRENCY_CONFLICT", "Container operation changed concurrently; retry the command", 409);
  throw error;
}

export type ContainerCreateInput = { code: string; capacity: string; capacityUnit: string; observations?: string | undefined };
export type ContainerUpdateInput = { capacity?: string | undefined; observations?: string | undefined };
export type ContainerMoveInput = { batchId: string; sourceContainerId?: string; destinationContainerId: string; quantity?: string; childCode?: string; operationKey: string; requestHash: string; occurredAt?: Date };
export type ContainerDto = { id: string; code: string; capacity: string; capacityUnit: string; status: string; observations: string | null; createdAt: string; updatedAt: string; version: number };
export type OccupancyDto = { id: string; containerId: string; batchId: string; quantity: string; unit: string; openedAt: string; closedAt: string | null };
export type ContainerMovementDto = { id: string; movementType: string; sourceContainerId: string | null; destinationContainerId: string; sourceBatchId: string; destinationBatchId: string | null; quantity: string; unit: string; occurredAt: string; createdAt: string };

function mapContainer(item: any): ContainerDto {
  return { id: item.id, code: item.code, capacity: textQuantity(item.capacity), capacityUnit: item.capacityUnit, status: item.status, observations: item.observations, createdAt: iso(item.createdAt), updatedAt: iso(item.updatedAt), version: item.version };
}
function mapOccupancy(item: any): OccupancyDto {
  return { id: item.id, containerId: item.containerId, batchId: item.batchId, quantity: textQuantity(item.quantity), unit: item.unit, openedAt: iso(item.openedAt), closedAt: item.closedAt ? iso(item.closedAt) : null };
}

async function lockRows(tx: SharedTransactionContext, containerIds: string[], batchIds: string[]) {
  for (const id of [...new Set(containerIds)].sort()) { requireId(id, "Container id"); await tx.$queryRaw`SELECT id FROM production_containers WHERE id = ${id}::uuid FOR UPDATE`; }
  for (const id of [...new Set(batchIds)].sort()) { requireId(id, "Batch id"); await tx.$queryRaw`SELECT id FROM production_batches WHERE id = ${id}::uuid FOR UPDATE`; }
}
async function openOccupancy(tx: SharedTransactionContext, containerId: string) {
  return tx.productionContainerOccupancy.findFirst({ where: { containerId, closedAt: null }, orderBy: { openedAt: "desc" } });
}
async function openAllocated(tx: SharedTransactionContext, batchId: string) {
  const rows = await tx.productionContainerOccupancy.findMany({ where: { batchId, closedAt: null } });
  return rows.reduce((sum, row) => sum.plus(row.quantity), new Prisma.Decimal(0));
}

export class ProductionContainerService {
  private readonly batches: ProductionBatchService;
  constructor(private readonly prisma: PrismaClient, private readonly audit: AuditService, private readonly auditFactory: (tx: SharedTransactionContext) => AuditService = (tx) => new AuditService(new PrismaAuditRepository(tx))) { this.batches = new ProductionBatchService(prisma, audit); }
  private auditIn(tx: SharedTransactionContext) { return this.auditFactory(tx); }
  async list() { const rows = await this.prisma.productionContainer.findMany({ orderBy: [{ status: "asc" }, { code: "asc" }] }); return rows.map(mapContainer); }
  async get(id: string) {
    requireId(id, "Container id");
    const row = await this.prisma.productionContainer.findUnique({ where: { id }, include: { occupancies: { orderBy: { openedAt: "desc" } } } });
    if (!row) throw new AppError("CONTAINER_NOT_FOUND", "Production container not found", 404);
    return { ...mapContainer(row), occupancies: row.occupancies.map(mapOccupancy) };
  }
  async occupancies(id: string) { const row = await this.get(id); return row.occupancies; }
  async movements(id: string) {
    requireId(id, "Container id");
    const container = await this.prisma.productionContainer.findUnique({ where: { id }, select: { id: true } });
    if (!container) throw new AppError("CONTAINER_NOT_FOUND", "Production container not found", 404);
    const rows = await this.prisma.productionBatchContainerMovement.findMany({ where: { OR: [{ sourceContainerId: id }, { destinationContainerId: id }] }, orderBy: [{ occurredAt: "asc" }, { id: "asc" }] });
    return rows.map((row): ContainerMovementDto => ({ id: row.id, movementType: row.movementType, sourceContainerId: row.sourceContainerId, destinationContainerId: row.destinationContainerId, sourceBatchId: row.sourceBatchId, destinationBatchId: row.destinationBatchId, quantity: textQuantity(row.quantity), unit: row.unit, occurredAt: iso(row.occurredAt), createdAt: iso(row.createdAt) }));
  }
  async create(data: ContainerCreateInput, context: AuthenticatedAuditContext) {
    requireActor(context);
    requireText(data.code, "Container code"); requireText(data.capacityUnit, "Capacity unit"); const capacity = q(data.capacity);
    return new SharedUnitOfWork(this.prisma).execute(async tx => {
      try {
        const row = await tx.productionContainer.create({ data: { code: data.code.trim(), capacity, capacityUnit: data.capacityUnit.trim(), ...(data.observations !== undefined ? { observations: data.observations } : {}) } });
        await this.auditIn(tx).record(context, { action: "CONTAINER_CREATED", resourceType: "production.container", resourceId: row.id, metadata: { code: row.code, capacity: textQuantity(capacity), capacityUnit: row.capacityUnit } });
        return mapContainer(row);
      } catch (error) { if (isPrisma(error, "P2002")) throw new AppError("PRODUCTION_CODE_ALREADY_EXISTS", "Container code already exists", 409); throw error; }
    }).catch(mapConcurrency);
  }
  async update(id: string, data: ContainerUpdateInput, context: AuthenticatedAuditContext) {
    requireActor(context);
    requireId(id, "Container id");
    return new SharedUnitOfWork(this.prisma).execute(async tx => {
      await lockRows(tx, [id], []);
      const existing = await tx.productionContainer.findUnique({ where: { id } }); if (!existing) throw new AppError("CONTAINER_NOT_FOUND", "Production container not found", 404);
      const open = await openOccupancy(tx, id); const capacity = data.capacity === undefined ? undefined : q(data.capacity);
      if (capacity && open && capacity.lt(open.quantity)) throw new AppError("CONTAINER_CAPACITY_EXCEEDED", "Capacity cannot be below current occupancy", 409);
      try {
        const row = await tx.productionContainer.update({ where: { id }, data: { ...(capacity ? { capacity } : {}), ...(data.observations !== undefined ? { observations: data.observations } : {}), version: { increment: 1 } } });
        await this.auditIn(tx).record(context, { action: "CONTAINER_UPDATED", resourceType: "production.container", resourceId: id, metadata: { code: row.code } }); return mapContainer(row);
      } catch (error) { if (isPrisma(error, "P2002")) throw new AppError("PRODUCTION_CODE_ALREADY_EXISTS", "Container code already exists", 409); throw error; }
    }).catch(mapConcurrency);
  }
  async setStatus(id: string, status: "DISPONIBLE" | "FUERA_DE_SERVICIO", context: AuthenticatedAuditContext) {
    requireActor(context);
    requireId(id, "Container id");
    return new SharedUnitOfWork(this.prisma).execute(async tx => {
      await lockRows(tx, [id], []);
      const row = await tx.productionContainer.findUnique({ where: { id } }); if (!row) throw new AppError("CONTAINER_NOT_FOUND", "Production container not found", 404);
      const open = await openOccupancy(tx, id);
      if (open) throw new AppError("CONTAINER_OCCUPIED", "Occupied containers cannot change service state", 409);
      const updated = await tx.productionContainer.update({ where: { id }, data: { status, version: { increment: 1 } } });
      await this.auditIn(tx).record(context, { action: status === "FUERA_DE_SERVICIO" ? "CONTAINER_DEACTIVATED" : "CONTAINER_ACTIVATED", resourceType: "production.container", resourceId: id });
      return mapContainer(updated);
    }).catch(mapConcurrency);
  }
  private async operation<T>(key: string, hash: string, name: string, work: (tx: SharedTransactionContext) => Promise<T>) {
    requireText(key, "Operation key"); requireText(hash, "Request hash");
    const execute = () => new SharedUnitOfWork(this.prisma).execute(async tx => {
      await tx.$queryRaw`SELECT 1::int FROM pg_advisory_xact_lock(hashtext(${key}))`;
      const old = await tx.productionContainerOperation.findUnique({ where: { operationKey: key } });
      if (old) { if (old.operation !== name || old.requestHash !== hash) throw new AppError("IDEMPOTENCY_CONFLICT", "Operation key was used with a different request", 409); return decodeStoredResult(old.operation, old.result) as T; }
      const result = await work(tx);
      await tx.productionContainerOperation.create({ data: { operationKey: key, operation: name, requestHash: hash, result: output(result) } });
      return result;
    });
    return execute().catch(async error => {
      if (!isPrisma(error, "P2002") && !isSerializationConflict(error)) throw error;
      const old = await this.prisma.productionContainerOperation.findUnique({ where: { operationKey: key } });
      if (!old) throw new AppError("PRODUCTION_CONCURRENCY_CONFLICT", "Container operation changed concurrently; retry with the same operation key", 409);
      if (old.operation !== name || old.requestHash !== hash) throw new AppError("IDEMPOTENCY_CONFLICT", "Operation key was used with a different request", 409);
      return decodeStoredResult(old.operation, old.result) as T;
    });
  }
  async assign(data: ContainerMoveInput, context: AuthenticatedAuditContext) {
    requireActor(context); requireId(data.batchId, "Batch id"); requireId(data.destinationContainerId, "Destination container id");
    const quantity = q(data.quantity ?? "0"); return this.operation(data.operationKey, data.requestHash, "BATCH_CONTAINER_ASSIGNED", async tx => this.assignIn(tx, data, quantity, context));
  }
  private async assignIn(tx: SharedTransactionContext, data: ContainerMoveInput, quantity: Prisma.Decimal, context: AuthenticatedAuditContext) {
    await lockRows(tx, [data.destinationContainerId], [data.batchId]); const container = await tx.productionContainer.findUnique({ where: { id: data.destinationContainerId } }); if (!container) throw new AppError("CONTAINER_NOT_FOUND", "Production container not found", 404);
    if (container.status === "FUERA_DE_SERVICIO") throw new AppError("CONTAINER_OUT_OF_SERVICE", "Container is out of service", 409);
    const existing = await openOccupancy(tx, container.id);
    const batch = await tx.productionBatch.findUnique({ where: { id: data.batchId } }); if (!batch) throw new AppError("BATCH_NOT_FOUND", "Production batch not found", 404);
    if (batch.unit !== container.capacityUnit) throw new AppError("INVALID_CONTAINER_OPERATION", "Container unit does not match batch unit", 409);
    const total = await openAllocated(tx, batch.id); const balance = await new BatchAvailabilityService(tx, true).get(batch.id); if (total.plus(quantity).gt(new Prisma.Decimal(balance.available))) throw new AppError("INSUFFICIENT_BATCH_QUANTITY", "Allocation exceeds available batch quantity", 409);
    const combined = existing && existing.batchId === batch.id ? existing.quantity.plus(quantity) : quantity;
    if (combined.gt(container.capacity)) throw new AppError("CONTAINER_CAPACITY_EXCEEDED", "Container capacity exceeded", 409);
    const now = data.occurredAt ?? new Date();
    if (existing) {
      if (existing.batchId !== batch.id) throw new AppError("CONTAINER_OCCUPIED", "Container already contains a different batch", 409);
      if (now < existing.openedAt) throw new AppError("INVALID_CONTAINER_OPERATION", "Operation time cannot precede the current occupancy", 400);
      await tx.productionContainerOccupancy.update({ where: { id: existing.id }, data: { closedAt: now, version: { increment: 1 } } });
    }
    const occupancy = await tx.productionContainerOccupancy.create({ data: { containerId: container.id, batchId: batch.id, quantity: combined, unit: batch.unit, openedAt: now } });
    const updated = await tx.productionContainer.update({ where: { id: container.id }, data: { status: "OCUPADO", version: { increment: 1 } } });
    await tx.productionBatchContainerMovement.create({ data: { movementType: "ASSIGNED", destinationContainerId: container.id, sourceBatchId: batch.id, quantity, unit: batch.unit, operationKey: data.operationKey, requestHash: data.requestHash, occurredAt: now, actorUserId: context.actorUserId } });
    await this.auditIn(tx).record(context, { action: "BATCH_CONTAINER_ASSIGNED", resourceType: "production.container_occupancy", resourceId: occupancy.id, metadata: { containerId: container.id, batchId: batch.id, quantity: textQuantity(quantity), unit: batch.unit } });
    return { container: mapContainer(updated), occupancy: mapOccupancy(occupancy) };
  }
  async transferTotal(data: ContainerMoveInput, context: AuthenticatedAuditContext) {
    requireActor(context); requireId(data.batchId, "Batch id"); requireId(data.destinationContainerId, "Destination container id");
    if (!data.sourceContainerId) throw new AppError("INVALID_CONTAINER_OPERATION", "Source container is required", 400);
    requireId(data.sourceContainerId, "Source container id");
    return this.operation(data.operationKey, data.requestHash, "BATCH_CONTAINER_TRANSFERRED", async tx => {
      await lockRows(tx, [data.sourceContainerId!, data.destinationContainerId], [data.batchId]); const source = await openOccupancy(tx, data.sourceContainerId!); if (!source || source.batchId !== data.batchId) throw new AppError("CONTAINER_OCCUPANCY_NOT_FOUND", "Batch is not open in source container", 404);
      const dest = await tx.productionContainer.findUnique({ where: { id: data.destinationContainerId } }); if (!dest) throw new AppError("CONTAINER_NOT_FOUND", "Destination container not found", 404);
      if (dest.status === "FUERA_DE_SERVICIO") throw new AppError("CONTAINER_OUT_OF_SERVICE", "Container is out of service", 409); if (await openOccupancy(tx, dest.id)) throw new AppError("CONTAINER_OCCUPIED", "Container already contains a batch", 409);
      if (source.unit !== dest.capacityUnit) throw new AppError("INVALID_CONTAINER_OPERATION", "Container unit does not match batch unit", 409);
      if (source.quantity.gt(dest.capacity)) throw new AppError("CONTAINER_CAPACITY_EXCEEDED", "Container capacity exceeded", 409);
       const now = data.occurredAt ?? new Date(); if (now < source.openedAt) throw new AppError("INVALID_CONTAINER_OPERATION", "Operation time cannot precede the current occupancy", 400); await tx.productionContainerOccupancy.update({ where: { id: source.id }, data: { closedAt: now, version: { increment: 1 } } });
      const occupancy = await tx.productionContainerOccupancy.create({ data: { containerId: dest.id, batchId: source.batchId, quantity: source.quantity, unit: source.unit, openedAt: now } });
      await tx.productionContainer.update({ where: { id: data.sourceContainerId! }, data: { status: "DISPONIBLE", version: { increment: 1 } } }); const updated = await tx.productionContainer.update({ where: { id: dest.id }, data: { status: "OCUPADO", version: { increment: 1 } } });
      const sourceContainerId = data.sourceContainerId!;
      await tx.productionBatchContainerMovement.create({ data: { movementType: "TRANSFERRED", sourceContainerId, destinationContainerId: dest.id, sourceBatchId: source.batchId, quantity: source.quantity, unit: source.unit, operationKey: data.operationKey, requestHash: data.requestHash, occurredAt: now, actorUserId: context.actorUserId } });
      await this.auditIn(tx).record(context, { action: "BATCH_CONTAINER_TRANSFERRED", resourceType: "production.container_occupancy", resourceId: occupancy.id, metadata: { sourceContainerId, destinationContainerId: dest.id, batchId: source.batchId, quantity: textQuantity(source.quantity), unit: source.unit } });
      return { container: mapContainer(updated), occupancy: mapOccupancy(occupancy) };
    });
  }
  async transferPartial(data: ContainerMoveInput, context: AuthenticatedAuditContext) {
    requireActor(context); requireId(data.batchId, "Batch id"); requireId(data.destinationContainerId, "Destination container id");
    if (!data.sourceContainerId || !data.childCode) throw new AppError("INVALID_CONTAINER_OPERATION", "Source container and child code are required", 400);
    requireId(data.sourceContainerId, "Source container id"); requireText(data.childCode, "Child code");
    const quantity = q(data.quantity ?? "0");
    return this.operation(data.operationKey, data.requestHash, "BATCH_CONTAINER_PARTIAL_TRANSFERRED", async tx => {
      await lockRows(tx, [data.sourceContainerId!, data.destinationContainerId], [data.batchId]); const source = await openOccupancy(tx, data.sourceContainerId!); if (!source || source.batchId !== data.batchId) throw new AppError("CONTAINER_OCCUPANCY_NOT_FOUND", "Batch is not open in source container", 404); if (quantity.gte(source.quantity)) throw new AppError("INVALID_CONTAINER_OPERATION", "Partial transfer must be less than source allocation", 409);
      const dest = await tx.productionContainer.findUnique({ where: { id: data.destinationContainerId } }); if (!dest) throw new AppError("CONTAINER_NOT_FOUND", "Destination container not found", 404); if (dest.status === "FUERA_DE_SERVICIO") throw new AppError("CONTAINER_OUT_OF_SERVICE", "Container is out of service", 409); if (await openOccupancy(tx, dest.id)) throw new AppError("CONTAINER_OCCUPIED", "Container already contains a batch", 409);
      if (source.unit !== dest.capacityUnit) throw new AppError("INVALID_CONTAINER_OPERATION", "Container unit does not match batch unit", 409); if (quantity.gt(dest.capacity)) throw new AppError("CONTAINER_CAPACITY_EXCEEDED", "Container capacity exceeded", 409);
       const now = data.occurredAt ?? new Date();
       if (now < source.openedAt) throw new AppError("INVALID_CONTAINER_OPERATION", "Operation time cannot precede the current occupancy", 400);
       await tx.productionContainerOccupancy.update({ where: { id: source.id }, data: { closedAt: now, version: { increment: 1 } } });
       const remainder = await tx.productionContainerOccupancy.create({ data: { containerId: source.containerId, batchId: source.batchId, quantity: source.quantity.minus(quantity), unit: source.unit, openedAt: now } });
       const split = await splitOneBatchInTransaction(tx, { parentBatchId: data.batchId, code: data.childCode!, quantity: textQuantity(quantity), operationKey: `${data.operationKey}:split` }, context, now);
       const target = await tx.productionContainerOccupancy.create({ data: { containerId: dest.id, batchId: split.child.id, quantity, unit: source.unit, openedAt: now } });
      await tx.productionContainer.update({ where: { id: dest.id }, data: { status: "OCUPADO", version: { increment: 1 } } });
      await tx.productionBatchContainerMovement.create({ data: { movementType: "PARTIAL_TRANSFERRED", sourceContainerId: source.containerId, destinationContainerId: dest.id, sourceBatchId: source.batchId, destinationBatchId: split.child.id, quantity, unit: source.unit, operationKey: data.operationKey, requestHash: data.requestHash, occurredAt: now, actorUserId: context.actorUserId } });
      await this.auditIn(tx).record(context, { action: "BATCH_CONTAINER_PARTIAL_TRANSFERRED", resourceType: "production.container_occupancy", resourceId: target.id, metadata: { sourceContainerId: source.containerId, destinationContainerId: dest.id, sourceBatchId: source.batchId, destinationBatchId: split.child.id, quantity: textQuantity(quantity), unit: source.unit } });
      return { parent: split.parent, child: split.child, source: mapOccupancy(remainder), destination: mapOccupancy(target) };
    });
  }
}
function isPrisma(error: unknown, code: string) { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code; }