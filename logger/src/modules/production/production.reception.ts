import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import { SharedUnitOfWork } from "../../core/database/shared-unit-of-work.js";
import { AuditService } from "../../core/audit/audit.service.js";
import { PrismaAuditRepository } from "../../core/audit/prisma-audit.repository.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { ArticulosApi } from "../articulos/articulos.api.js";
import { createInitialBatchInTransaction } from "./production.batch.js";
import { persistCustomFieldValue } from "./custom-fields.js";
import { createHash } from "node:crypto";

export type ReceptionInput = {
  productionOrderId: string; producerId?: string | undefined; receivedAt: Date;
  status: "ACCEPTED" | "ACCEPTED_WITH_OBSERVATIONS"; observations?: string | undefined;
  items: Array<{ grapeVarietyId: string; articuloId: string; quantity: string; unit: string }>;
  customFields?: Array<{ definitionId: string; value: string | number | boolean }> | undefined;
  operationKey: string; requestHash: string;
};
export type ReceptionResult = { reception: unknown; items: unknown[]; batchIds: string[] };
export type ReceptionDependencies = {
  createBatch?: typeof createInitialBatchInTransaction;
  recordAudit?: (tx: any, context: AuthenticatedAuditContext, receptionId: string, batchIds: string[]) => Promise<void>;
};
const quantityPattern = /^(?:0|[1-9]\d{0,12})(?:\.\d{1,3})?$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const canonicalDigest = (data: ReceptionInput) => createHash("sha256").update(JSON.stringify({
  productionOrderId: data.productionOrderId, producerId: data.producerId ?? null, receivedAt: data.receivedAt.toISOString(),
  status: data.status, observations: data.observations ?? null,
  items: data.items.map(item => ({ grapeVarietyId: item.grapeVarietyId, articuloId: item.articuloId, quantity: new Prisma.Decimal(item.quantity).toFixed(3), unit: item.unit })),
  customFields: [...(data.customFields ?? [])].sort((a, b) => a.definitionId.localeCompare(b.definitionId)).map(field => ({ definitionId: field.definitionId, value: field.value })),
})).digest("hex");
const hashLock = async (tx: any, key: string) => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`; };
const lockRows = async (tx: any, table: string, ids: string[]) => {
  for (const id of [...new Set(ids)].sort()) await tx.$queryRawUnsafe(`SELECT id FROM "${table}" WHERE id = $1::uuid FOR UPDATE`, id);
};

export class ProductionReceptionService {
  private readonly createBatch: typeof createInitialBatchInTransaction;
  private readonly recordAudit: NonNullable<ReceptionDependencies["recordAudit"]>;
  constructor(private readonly prisma: PrismaClient, private readonly articulos: ArticulosApi, dependencies: ReceptionDependencies = {}) {
    this.createBatch = dependencies.createBatch ?? createInitialBatchInTransaction;
    this.recordAudit = dependencies.recordAudit ?? (async (tx, context, receptionId, batchIds) => new AuditService(new PrismaAuditRepository(tx)).record(context, { action: "GRAPE_RECEPTION_CREATED", resourceType: "production.grape_reception", resourceId: receptionId, metadata: { batchIds } }));
  }
  async create(data: ReceptionInput, context: AuthenticatedAuditContext): Promise<ReceptionResult> {
    if (!uuidPattern.test(context.actorUserId) || !uuidPattern.test(data.productionOrderId) || (data.producerId !== undefined && !uuidPattern.test(data.producerId))) throw new AppError("VALIDATION_ERROR", "Reception identifiers must be UUIDs", 400);
    if (!["ACCEPTED", "ACCEPTED_WITH_OBSERVATIONS"].includes(data.status) || !(data.receivedAt instanceof Date) || Number.isNaN(data.receivedAt.getTime())) throw new AppError("VALIDATION_ERROR", "Invalid reception status or receivedAt", 400);
    if (data.observations !== undefined && (typeof data.observations !== "string" || data.observations.length > 2000)) throw new AppError("VALIDATION_ERROR", "Observations must be at most 2000 characters", 400);
    if (data.status === "ACCEPTED_WITH_OBSERVATIONS" && !data.observations?.trim()) throw new AppError("RECEPTION_OBSERVATIONS_REQUIRED", "This status requires observations", 400);
    if (!data.operationKey.trim() || !data.requestHash.trim()) throw new AppError("IDEMPOTENCY_KEY_REQUIRED", "Operation key and request hash are required", 400);
    if (!data.items.length) throw new AppError("INVALID_RECEPTION_ITEMS", "At least one reception item is required", 400);
    for (const item of data.items) {
      if (!uuidPattern.test(item.grapeVarietyId) || !uuidPattern.test(item.articuloId)) throw new AppError("VALIDATION_ERROR", "Reception item identifiers must be UUIDs", 400);
      if (!quantityPattern.test(item.quantity) || new Prisma.Decimal(item.quantity).lte(0)) throw new AppError("INVALID_QUANTITY", "Quantity must be greater than zero with at most three decimals", 400);
    }
    const payloadDigest = canonicalDigest(data);
    const operationDigest = createHash("sha256").update(`${payloadDigest}:${data.operationKey}`).digest("hex");
    return new SharedUnitOfWork(this.prisma).execute(async tx => {
      await hashLock(tx, data.operationKey);
      await lockRows(tx, "production_orders", [data.productionOrderId]);
      await lockRows(tx, "production_producers", data.producerId ? [data.producerId] : []);
      await lockRows(tx, "production_grape_varieties", data.items.map(item => item.grapeVarietyId));
      const articuloResults = await this.articulos.lockAndValidateArticulosInTransaction({ articuloIds: data.items.map(item => item.articuloId) }, tx);
      const old = await tx.grapeReceptionOperation.findUnique({ where: { operationKey: data.operationKey } });
      if (old) {
        if (old.requestHash !== payloadDigest) throw new AppError("IDEMPOTENCY_CONFLICT", "Operation key was used with a different request", 409);
        return old.result as ReceptionResult;
      }
      const order = await tx.productionOrder.findUnique({ where: { id: data.productionOrderId } });
      if (!order) throw new AppError("PRODUCTION_ORDER_NOT_FOUND", "Production order not found", 404);
      if (order.status !== "OPEN") throw new AppError("PRODUCTION_ORDER_CLOSED", "Production order is closed", 409);
      if (data.producerId) {
        const producer = await tx.producer.findUnique({ where: { id: data.producerId } });
        if (!producer) throw new AppError("PRODUCER_NOT_FOUND", "Producer not found", 404);
        if (!producer.active) throw new AppError("PRODUCER_INACTIVE", "Producer is inactive", 409);
      }
      const definitions = await tx.customFieldDefinition.findMany({ where: { entityType: "GRAPE_RECEPTION", active: true } });
      const supplied = new Set((data.customFields ?? []).map(field => field.definitionId));
      const missing = definitions.find(definition => definition.required && !supplied.has(definition.id));
      if (missing) throw new AppError("CUSTOM_FIELD_REQUIRED", `Required custom field ${missing.code} is missing`, 400);
      const reception = await tx.grapeReception.create({ data: { productionOrderId: data.productionOrderId, ...(data.producerId ? { producerId: data.producerId } : {}), receivedAt: data.receivedAt, status: data.status, ...(data.observations !== undefined ? { observations: data.observations } : {}), actorUserId: context.actorUserId } });
      const items: unknown[] = [];
      const batchIds: string[] = [];
      for (let i = 0; i < data.items.length; i++) {
        const input = data.items[i]!;
        const variety = await tx.grapeVariety.findUnique({ where: { id: input.grapeVarietyId } });
        if (!variety) throw new AppError("GRAPE_VARIETY_NOT_FOUND", "Grape variety not found", 404);
        if (!variety.active) throw new AppError("GRAPE_VARIETY_INACTIVE", "Grape variety is inactive", 409);
        const valid = articuloResults.get(input.articuloId) ?? { valid: false, reason: "NOT_FOUND" as const };
        if (!valid.valid || !valid.articulo) {
          if (valid.reason === "INACTIVE") throw new AppError("ARTICULO_INACTIVE", "Articulo is inactive", 409);
          throw new AppError("ARTICULO_NOT_FOUND", "Articulo not found", 404);
        }
        if (valid.articulo.unidadMedida !== input.unit) throw new AppError("INVALID_UNIT", "Unit does not match Articulo", 400);
        const batch = await this.createBatch(tx, { code: `GRAPE-${operationDigest.slice(0, 24)}-${i}`, productionOrderId: data.productionOrderId, articuloId: input.articuloId, unit: input.unit, quantity: input.quantity, operationKey: `${data.operationKey}:${i}`, requestHash: `${payloadDigest}:${i}` }, context, data.receivedAt);
        await tx.grapeReceptionItem.create({ data: { receptionId: reception.id, grapeVarietyId: input.grapeVarietyId, articuloId: input.articuloId, quantity: new Prisma.Decimal(input.quantity), unit: input.unit as any, productionBatchId: batch.id } });
        items.push({ grapeVarietyId: input.grapeVarietyId, articuloId: input.articuloId, quantity: new Prisma.Decimal(input.quantity).toFixed(3), unit: input.unit, productionBatchId: batch.id });
        batchIds.push(batch.id);
      }
      for (const field of data.customFields ?? []) {
        await persistCustomFieldValue(tx, { definitionId: field.definitionId, entityType: "GRAPE_RECEPTION", entityId: reception.id, value: field.value });
      }
      const result: ReceptionResult = { reception: { ...reception, receivedAt: reception.receivedAt.toISOString(), createdAt: reception.createdAt.toISOString(), updatedAt: reception.updatedAt.toISOString() }, items, batchIds };
      await tx.grapeReceptionOperation.create({ data: { operationKey: data.operationKey, requestHash: payloadDigest, receptionId: reception.id, result: json(result) } });
      await this.recordAudit(tx, context, reception.id, batchIds);
      return result;
    });
  }
  async list(page = 1, pageSize = 20) {
    const [rows, total] = await Promise.all([
      this.prisma.grapeReception.findMany({ include: { items: true }, orderBy: [{ receivedAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.grapeReception.count(),
    ]);
    return { items: rows.map(mapReception), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }
  async get(id: string) {
    const row = await this.prisma.grapeReception.findUnique({ where: { id }, include: { items: true, corrections: { orderBy: { toVersion: "asc" } } } });
    if (!row) return null;
    const customValues = await this.prisma.customFieldValue.findMany({ where: { entityId: id, entityType: "GRAPE_RECEPTION" }, include: { definition: true } });
    return {
      ...mapReception(row),
      corrections: row.corrections.map(correction => ({ id: correction.id, field: correction.field, previousValue: correction.previousValue, newValue: correction.newValue, reason: correction.reason, correctedAt: correction.correctedAt.toISOString(), actorUserId: correction.actorUserId, fromVersion: correction.fromVersion, toVersion: correction.toVersion })),
      customFields: customValues.map(mapCustomField),
    };
  }
}
function mapCustomField(value: any) {
  const definition = value.definition;
  const column: Record<string, string> = { TEXT: "textValue", INTEGER: "integerValue", DECIMAL: "decimalValue", BOOLEAN: "booleanValue", DATE: "dateValue", SELECT: "selectValue" };
  let scalar = value[column[definition.dataType]!];
  if (definition.dataType === "DATE" && scalar instanceof Date) scalar = scalar.toISOString();
  if (scalar && typeof scalar === "object" && typeof scalar.toString === "function") scalar = scalar.toString();
  return { definitionId: value.definitionId, entityType: value.entityType, value: scalar };
}
function mapReception(row: any) {
  return { id: row.id, productionOrderId: row.productionOrderId, producerId: row.producerId, receivedAt: row.receivedAt.toISOString(), status: row.status, observations: row.observations, actorUserId: row.actorUserId, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), version: row.version, items: row.items.map((item: any) => ({ id: item.id, grapeVarietyId: item.grapeVarietyId, articuloId: item.articuloId, quantity: new Prisma.Decimal(item.quantity).toFixed(3), unit: item.unit, productionBatchId: item.productionBatchId })) };
}