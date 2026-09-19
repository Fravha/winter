import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { AuditService } from "../../core/audit/audit.service.js";
import { PrismaAuditRepository } from "../../core/audit/prisma-audit.repository.js";
import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import { SharedUnitOfWork } from "../../core/database/shared-unit-of-work.js";
import type { SharedTransactionContext } from "../../core/database/shared-unit-of-work.js";
import { AppError } from "../../shared/errors/app-error.js";
import { z } from "zod";
import type { ArticulosApi } from "../articulos/articulos.api.js";
import { BatchAvailabilityService, BatchLedgerService, BatchLineageService, createInitialBatchInTransaction } from "./production.batch.js";

type Db = PrismaClient | SharedTransactionContext;
const quantityPattern = /^(?:0|[1-9]\d{0,12})(?:\.\d{1,3})?$/;
const uuid = (value: string, name: string) => { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new AppError("INVALID_TRANSFORMATION", `${name} must be a UUID`, 400); };
const text = (value: string, name: string) => { if (!value.trim()) throw new AppError("INVALID_TRANSFORMATION", `${name} is required`, 400); };
const decimal = (value: string) => { if (!quantityPattern.test(value)) throw new AppError("INVALID_TRANSFORMATION", "Quantity must be positive with at most three decimals", 400); const n = new Prisma.Decimal(value); if (n.lte(0)) throw new AppError("INVALID_TRANSFORMATION", "Quantity must be positive", 400); return n; };
const q = (v: Prisma.Decimal | string) => new Prisma.Decimal(v).toFixed(3);
const json = (v: unknown): Prisma.InputJsonValue => v === null ? null as never : typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? v : Array.isArray(v) ? v.map(json) as Prisma.InputJsonValue : Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, json(x)])) as Prisma.InputJsonValue;
const storedInputSchema = z.object({ productionBatchId: z.string(), quantity: z.string(), unit: z.string() });
const storedOutputSchema = z.object({ productionBatchId: z.string(), articuloId: z.string(), quantity: z.string(), unit: z.string(), code: z.string() });
const storedLossSchema = z.object({ id: z.string(), productionBatchId: z.string().nullable(), quantity: z.string(), unit: z.string(), operationKey: z.string() });
const storedDtoSchema = z.object({
  id: z.string(), productionOrderId: z.string(), transformationOrderId: z.string().nullable(), productionWorkId: z.string().nullable(),
  performedAt: z.string(), actorUserId: z.string(), observations: z.string().nullable(), operationKey: z.string(), requestHash: z.string(),
  inputs: z.array(storedInputSchema), outputs: z.array(storedOutputSchema), losses: z.array(storedLossSchema),
});

export type TransformationInput = { productionBatchId: string; quantity: string };
export type TransformationOutput = { articuloId: string; quantity: string; unit: string; observations?: string | undefined };
export type TransformationLoss = { productionBatchId?: string | undefined; quantity: string; unit: string; operationKey?: string | undefined; requestHash?: string | undefined; observations?: string | undefined };
export type TransformationCreateInput = {
  productionOrderId: string; transformationOrderId?: string | undefined; productionWorkId?: string | undefined;
  performedAt: Date; observations?: string | undefined; operationKey: string; requestHash: string;
  inputs: TransformationInput[]; outputs: TransformationOutput[]; losses?: TransformationLoss[] | undefined;
};
export type TransformationDto = {
  id: string; productionOrderId: string; transformationOrderId: string | null; productionWorkId: string | null;
  performedAt: string; actorUserId: string; observations: string | null; operationKey: string; requestHash: string;
  inputs: Array<{ productionBatchId: string; quantity: string; unit: string }>;
  outputs: Array<{ productionBatchId: string; articuloId: string; quantity: string; unit: string; code: string }>;
  losses: Array<{ id: string; productionBatchId: string | null; quantity: string; unit: string; operationKey: string }>;
};

function map(row: any): TransformationDto {
  return {
    id: row.id, productionOrderId: row.productionOrderId, transformationOrderId: row.transformationOrderId,
    productionWorkId: row.productionWorkId, performedAt: row.performedAt.toISOString(), actorUserId: row.actorUserId,
    observations: row.observations, operationKey: row.operationKey, requestHash: row.requestHash,
    inputs: (row.inputs ?? []).map((x: any) => ({ productionBatchId: x.productionBatchId, quantity: q(x.quantity), unit: x.unit })),
    outputs: (row.outputs ?? []).map((x: any) => ({ productionBatchId: x.productionBatchId, articuloId: x.productionBatch.articuloId, quantity: q(x.quantity), unit: x.unit, code: x.productionBatch.code })),
    losses: (row.losses ?? []).map((x: any) => ({ id: x.id, productionBatchId: x.productionBatchId, quantity: q(x.quantity), unit: x.unit, operationKey: x.operationKey })),
  };
}
function canonical(value: TransformationCreateInput): string {
  const normalized = {
    productionOrderId: value.productionOrderId.trim(),
    transformationOrderId: value.transformationOrderId?.trim() ?? null,
    productionWorkId: value.productionWorkId?.trim() ?? null,
    performedAt: value.performedAt.toISOString(),
    observations: value.observations?.trim() ?? null,
    operationKey: value.operationKey.trim(),
    inputs: value.inputs.map(item => ({ productionBatchId: item.productionBatchId.trim(), quantity: q(item.quantity) })),
    outputs: value.outputs.map(item => ({ articuloId: item.articuloId.trim(), quantity: q(item.quantity), unit: item.unit.trim(), observations: item.observations?.trim() ?? null })),
    losses: (value.losses ?? []).map(item => ({ productionBatchId: item.productionBatchId?.trim() ?? null, quantity: q(item.quantity), unit: item.unit.trim(), operationKey: item.operationKey?.trim() ?? null, observations: item.observations?.trim() ?? null })),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export class ProductionTransformationService {
  constructor(private readonly prisma: PrismaClient, private readonly articulos: ArticulosApi, private readonly auditFactory: (tx: SharedTransactionContext) => AuditService = tx => new AuditService(new PrismaAuditRepository(tx))) {}
  private include = { inputs: true, outputs: { include: { productionBatch: true } }, losses: true } as const;
  private audit(tx: SharedTransactionContext) { return this.auditFactory(tx); }
  private async locks(tx: SharedTransactionContext, ids: string[]) {
    for (const id of [...new Set(ids)].sort()) { uuid(id, "Batch id"); await tx.$queryRaw`SELECT id FROM production_batches WHERE id = ${id}::uuid FOR UPDATE`; }
  }
  private async lockRow(tx: SharedTransactionContext, table: "production_orders" | "transformation_orders" | "production_works", id: string) {
    uuid(id, "Context id");
    await tx.$queryRawUnsafe(`SELECT id FROM "${table}" WHERE id = $1::uuid FOR UPDATE`, id);
  }
  private async operation(tx: SharedTransactionContext, key: string, hash: string, work: () => Promise<TransformationDto>) {
    await tx.$queryRaw`SELECT 1::int AS locked FROM pg_advisory_xact_lock(hashtext(${key}))`;
    const existing = await tx.productionBatchOperation.findUnique({ where: { operationKey: key } });
    if (existing) {
      if (existing.operation !== "TRANSFORMATION_CREATED" || existing.requestHash !== hash) throw new AppError("IDEMPOTENCY_CONFLICT", "Operation key was used with a different payload", 409);
      const parsed = storedDtoSchema.safeParse(existing.result);
      if (!parsed.success) throw new AppError("IDEMPOTENCY_CONFLICT", "Stored transformation result is invalid", 409);
      return parsed.data;
    }
    const result = await work();
    await tx.productionBatchOperation.create({ data: { operationKey: key, operation: "TRANSFORMATION_CREATED", requestHash: hash, result: json(result) } });
    return result;
  }
  async create(data: TransformationCreateInput, context: AuthenticatedAuditContext): Promise<TransformationDto> {
    uuid(data.productionOrderId, "Production order id"); text(data.operationKey, "Operation key"); text(data.requestHash, "Request hash"); uuid(context.actorUserId, "Actor user id");
    if (!data.inputs.length || !data.outputs.length) throw new AppError("INVALID_TRANSFORMATION", "At least one input and output are required", 400);
    data.inputs.forEach(x => { uuid(x.productionBatchId, "Input batch id"); decimal(x.quantity); });
    data.outputs.forEach(x => { uuid(x.articuloId, "Output article id"); decimal(x.quantity); text(x.unit, "Output unit"); });
    const digest = canonical(data);
    return new SharedUnitOfWork(this.prisma).execute(tx => this.operation(tx, data.operationKey, digest, async () => {
      await this.lockRow(tx, "production_orders", data.productionOrderId);
      const order = await tx.productionOrder.findUnique({ where: { id: data.productionOrderId } });
      if (!order) throw new AppError("PRODUCTION_ORDER_NOT_FOUND", "Production order not found", 404);
      if (order.status !== "OPEN") throw new AppError("PRODUCTION_ORDER_CLOSED", "Production order is closed", 409);
      if (data.transformationOrderId) {
        uuid(data.transformationOrderId, "Transformation order id");
        await this.lockRow(tx, "transformation_orders", data.transformationOrderId);
        const t = await tx.transformationOrder.findUnique({ where: { id: data.transformationOrderId } });
        if (!t) throw new AppError("TRANSFORMATION_ORDER_NOT_FOUND", "Transformation order not found", 404);
        if (t.productionOrderId !== data.productionOrderId) throw new AppError("TRANSFORMATION_ORDER_MISMATCH", "Transformation order belongs to another order", 409);
        if (t.status !== "OPEN") throw new AppError("TRANSFORMATION_ORDER_CLOSED", "Transformation order is closed", 409);
      }
      if (data.productionWorkId) {
        uuid(data.productionWorkId, "Production work id");
        await this.lockRow(tx, "production_works", data.productionWorkId);
        const w = await tx.productionWork.findUnique({ where: { id: data.productionWorkId } });
        if (!w) throw new AppError("PRODUCTION_WORK_NOT_FOUND", "Production work not found", 404);
        if (w.productionOrderId !== data.productionOrderId) throw new AppError("PRODUCTION_WORK_MISMATCH", "Production work belongs to another order", 409);
        if (data.transformationOrderId && w.transformationOrderId !== data.transformationOrderId) throw new AppError("PRODUCTION_WORK_MISMATCH", "Production work transformation order is incompatible", 409);
      }
      const inputIds = data.inputs.map(x => x.productionBatchId);
      if (new Set(inputIds).size !== inputIds.length) throw new AppError("DUPLICATE_INPUT_BATCH", "Input batch ids must be unique", 400);
      const lossIds = (data.losses ?? []).flatMap(x => x.productionBatchId ? [x.productionBatchId] : []);
      await this.locks(tx, inputIds.concat(lossIds));
      const batches = await tx.productionBatch.findMany({ where: { id: { in: [...new Set(inputIds.concat(lossIds))] } } });
      if (batches.length !== new Set(inputIds.concat(lossIds)).size) throw new AppError("BATCH_NOT_FOUND", "One or more input or loss batches do not exist", 404);
      for (const batch of batches) {
        if (batch.productionOrderId !== data.productionOrderId && (inputIds.includes(batch.id) || lossIds.includes(batch.id))) throw new AppError("BATCH_ORDER_MISMATCH", "Batch belongs to another production order", 409);
      }
      for (const loss of data.losses ?? []) {
        if (loss.productionBatchId) {
          const batch = batches.find(item => item.id === loss.productionBatchId);
          if (!batch) throw new AppError("LOSS_BATCH_NOT_FOUND", "Known loss batch does not exist", 404);
          if (batch.unit !== loss.unit) throw new AppError("UNIT_INCOMPATIBLE", "Loss unit does not match batch unit", 409);
        }
      }
      const articles = await this.articulos.lockAndValidateArticulosInTransaction({ articuloIds: data.outputs.map(x => x.articuloId) }, tx);
      for (const output of data.outputs) { const a = articles.get(output.articuloId); if (!a?.valid || !a.articulo) throw new AppError("ARTICULO_INVALID", "Output article is missing or inactive", 409); if (a.articulo.unidadMedida !== output.unit) throw new AppError("UNIT_INCOMPATIBLE", "Output unit does not match article unit", 409); if (batches.some(batch => batch.unit !== output.unit)) throw new AppError("UNIT_INCOMPATIBLE", "Transformation does not convert units", 409); }
      for (const input of data.inputs) { const batch = batches.find(x => x.id === input.productionBatchId)!; await new BatchAvailabilityService(tx, true).assertAvailable(batch.id, decimal(input.quantity), batch.unit); }
      const row = await tx.transformation.create({ data: { productionOrderId: data.productionOrderId, ...(data.transformationOrderId ? { transformationOrderId: data.transformationOrderId } : {}), ...(data.productionWorkId ? { productionWorkId: data.productionWorkId } : {}), performedAt: data.performedAt, actorUserId: context.actorUserId, ...(data.observations !== undefined ? { observations: data.observations.trim() } : {}), operationKey: data.operationKey, requestHash: digest } });
      for (const input of data.inputs) {
        const batch = batches.find(x => x.id === input.productionBatchId)!;
        await tx.transformationInput.create({ data: { transformationId: row.id, productionBatchId: batch.id, quantity: decimal(input.quantity), unit: batch.unit } });
        await new BatchLedgerService(tx, true).append(batch.id, "CONSUMED", decimal(input.quantity), batch.unit, `${data.operationKey}:input:${batch.id}`, context.actorUserId, data.performedAt, undefined, { transformationId: row.id });
        await new BatchAvailabilityService(tx, true).rebuild(batch.id);
      }
      for (let i = 0; i < data.outputs.length; i++) {
        const output = data.outputs[i]!;
        const article = articles.get(output.articuloId)!.articulo!;
        const batch = await createInitialBatchInTransaction(tx, { code: `TR-${randomUUID()}`, productionOrderId: data.productionOrderId, articuloId: article.id, unit: output.unit, quantity: output.quantity, operationKey: `${data.operationKey}:output:${i}`, requestHash: digest, transformationId: row.id }, context, data.performedAt);
        await tx.transformationOutput.create({ data: { transformationId: row.id, productionBatchId: batch.id, quantity: decimal(output.quantity), unit: output.unit } });
        for (const input of data.inputs) await new BatchLineageService(tx, true).create(input.productionBatchId, batch.id, null, null, `${data.operationKey}:lineage:${i}:${input.productionBatchId}`);
      }
      for (let i = 0; i < (data.losses ?? []).length; i++) {
        const loss = data.losses![i]!;
        const amount = decimal(loss.quantity); const lossKey = loss.operationKey ?? `${data.operationKey}:loss:${i}`;
        const lossRow = await tx.productionLoss.create({ data: { productionOrderId: data.productionOrderId, ...(data.transformationOrderId ? { transformationOrderId: data.transformationOrderId } : {}), transformationId: row.id, ...(data.productionWorkId ? { productionWorkId: data.productionWorkId } : {}), ...(loss.productionBatchId ? { productionBatchId: loss.productionBatchId } : {}), quantity: amount, unit: loss.unit, occurredAt: data.performedAt, actorUserId: context.actorUserId, ...(loss.observations ? { observations: loss.observations.trim() } : {}), operationKey: lossKey, requestHash: digest } });
        if (loss.productionBatchId) {
          await new BatchLedgerService(tx, true).append(loss.productionBatchId, "LOSS", amount, loss.unit, `${lossKey}:ledger`, context.actorUserId, data.performedAt, undefined, { transformationId: row.id, productionLossId: lossRow.id });
          await new BatchAvailabilityService(tx, true).rebuild(loss.productionBatchId);
        }
        await this.audit(tx).record(context, { action: "PRODUCTION_LOSS_CREATED", resourceType: "production.loss", resourceId: lossRow.id, metadata: { quantity: q(amount), unit: loss.unit } });
      }
      await this.audit(tx).record(context, { action: "PRODUCTION_TRANSFORMATION_CREATED", resourceType: "production.transformation", resourceId: row.id, metadata: { inputCount: data.inputs.length, outputCount: data.outputs.length } });
      return map(await tx.transformation.findUniqueOrThrow({ where: { id: row.id }, include: this.include }));
    }));
  }
  async list(filters: { page?: number | undefined; pageSize?: number | undefined; productionOrderId?: string | undefined } = {}) {
    const page = filters.page ?? 1, pageSize = filters.pageSize ?? 20;
    const where = filters.productionOrderId ? { productionOrderId: filters.productionOrderId } : {};
    const [rows, total] = await Promise.all([this.prisma.transformation.findMany({ where, include: this.include, orderBy: [{ performedAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }), this.prisma.transformation.count({ where })]);
    return { items: rows.map(map), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }
  async get(id: string) { uuid(id, "Transformation id"); const row = await this.prisma.transformation.findUnique({ where: { id }, include: this.include }); return row ? map(row) : null; }
}