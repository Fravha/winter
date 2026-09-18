import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { SharedTransactionContext } from "../../core/database/shared-unit-of-work.js";
import { SharedUnitOfWork } from "../../core/database/shared-unit-of-work.js";
import { AuditService } from "../../core/audit/audit.service.js";
import { PrismaAuditRepository } from "../../core/audit/prisma-audit.repository.js";
import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import { AppError } from "../../shared/errors/app-error.js";

type Db = PrismaClient | SharedTransactionContext;
export type WorkParticipantInput = { participantId: string; role?: string | undefined };
export type WorkCreateInput = { productionOrderId: string; transformationOrderId?: string | undefined; workTypeId: string; performedAt: Date; observations?: string | undefined; batchIds?: string[] | undefined; containerIds?: string[] | undefined; participants?: WorkParticipantInput[] | undefined };
export type WorkCorrectionInput = { field: "performedAt" | "workTypeId" | "transformationOrderId" | "observations"; newValue: string | null; reason: string };
const iso = (value: Date) => value.toISOString();
const json = (value: unknown): Prisma.InputJsonValue => value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value as Prisma.InputJsonValue : Array.isArray(value) ? value.map(json) as Prisma.InputJsonValue : Object.fromEntries(Object.entries(value as object).map(([k, v]) => [k, json(v)])) as Prisma.InputJsonValue;
const requiredText = (value: string, name: string) => { if (!value.trim()) throw new AppError("INVALID_PRODUCTION_WORK", `${name} is required`, 400); };
const uuid = (value: string, name: string) => { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new AppError("INVALID_PRODUCTION_WORK", `${name} must be a UUID`, 400); };
const unique = (values: string[], name: string) => { const seen = new Set<string>(); for (const value of values) { uuid(value, name); if (seen.has(value)) throw new AppError("INVALID_PRODUCTION_WORK", `${name} contains duplicate ids`, 400); seen.add(value); } return values; };

function mapWork(row: any) {
  return {
    id: row.id, productionOrderId: row.productionOrderId, transformationOrderId: row.transformationOrderId,
    workTypeId: row.workTypeId, performedAt: iso(row.performedAt), observations: row.observations,
    createdByUserId: row.createdByUserId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), version: row.version,
    batchIds: row.batches?.map((x: any) => x.productionBatchId) ?? [],
    containerIds: row.containers?.map((x: any) => x.productionContainerId) ?? [],
    participants: row.participants?.map((x: any) => ({ participantId: x.productionParticipantId, role: x.role })) ?? [],
    corrections: row.corrections?.map((x: any) => ({ id: x.id, field: x.field, previousValue: x.previousValue, newValue: x.newValue, reason: x.reason, correctedAt: iso(x.correctedAt), actorUserId: x.actorUserId, fromVersion: x.fromVersion, toVersion: x.toVersion })) ?? [],
  };
}

async function lock(tx: SharedTransactionContext, table: string, ids: string[], label: string) {
  for (const id of [...new Set(ids)].sort()) { uuid(id, label); await tx.$queryRawUnsafe(`SELECT id FROM "${table}" WHERE id = $1::uuid FOR UPDATE`, id); }
}

export class ProductionWorkService {
  constructor(private readonly prisma: PrismaClient, private readonly audit: AuditService, private readonly auditFactory: (tx: SharedTransactionContext) => AuditService = (tx) => new AuditService(new PrismaAuditRepository(tx))) {}
  private auditIn(tx: SharedTransactionContext) { return this.auditFactory(tx); }
  private include = { batches: true, containers: true, participants: true, corrections: { orderBy: { correctedAt: "asc" as const } } };

  async list(filters: { page?: number | undefined; pageSize?: number | undefined; productionOrderId?: string | undefined; workTypeId?: string | undefined }) {
    const page = filters.page ?? 1; const pageSize = filters.pageSize ?? 20;
    const where = { ...(filters.productionOrderId ? { productionOrderId: filters.productionOrderId } : {}), ...(filters.workTypeId ? { workTypeId: filters.workTypeId } : {}) };
    const [rows, total] = await Promise.all([this.prisma.productionWork.findMany({ where, include: this.include, orderBy: [{ performedAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }), this.prisma.productionWork.count({ where })]);
    return { items: rows.map(mapWork), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }
  async get(id: string) {
    uuid(id, "Work id");
    const row = await this.prisma.productionWork.findUnique({ where: { id }, include: this.include });
    if (!row) throw new AppError("PRODUCTION_WORK_NOT_FOUND", "Production work not found", 404);
    return mapWork(row);
  }
  async create(data: WorkCreateInput, context: AuthenticatedAuditContext) {
    uuid(data.productionOrderId, "Production order id"); uuid(data.workTypeId, "Work type id"); requiredText(context.actorUserId, "Actor user id");
    const batchIds = unique(data.batchIds ?? [], "Batch ids"); const containerIds = unique(data.containerIds ?? [], "Container ids");
    const participants = data.participants ?? []; const roleById = new Map<string, string | undefined>();
    for (const item of participants) { uuid(item.participantId, "Participant id"); const role = item.role?.trim(); if (roleById.has(item.participantId)) { if (roleById.get(item.participantId) !== role) throw new AppError("INVALID_PRODUCTION_WORK", "Participant has conflicting roles", 400); throw new AppError("INVALID_PRODUCTION_WORK", "Participant ids must be unique", 400); } roleById.set(item.participantId, role); }
    return new SharedUnitOfWork(this.prisma).execute(async tx => {
      await lock(tx, "production_orders", [data.productionOrderId], "Production order id");
      await lock(tx, "transformation_orders", data.transformationOrderId ? [data.transformationOrderId] : [], "Transformation order id");
      await lock(tx, "production_work_types", [data.workTypeId], "Work type id");
      await lock(tx, "production_batches", batchIds, "Batch id"); await lock(tx, "production_containers", containerIds, "Container id"); await lock(tx, "production_participants", participants.map(x => x.participantId), "Participant id");
      const order = await tx.productionOrder.findUnique({ where: { id: data.productionOrderId } });
      if (!order) throw new AppError("PRODUCTION_ORDER_NOT_FOUND", "Production order not found", 404);
      if (order.status !== "OPEN") throw new AppError("PRODUCTION_ORDER_CLOSED", "Production order is closed", 409);
      if (data.transformationOrderId) { const transformation = await tx.transformationOrder.findUnique({ where: { id: data.transformationOrderId } }); if (!transformation) throw new AppError("TRANSFORMATION_ORDER_NOT_FOUND", "Transformation order not found", 404); if (transformation.productionOrderId !== data.productionOrderId) throw new AppError("TRANSFORMATION_ORDER_MISMATCH", "Transformation order belongs to another production order", 409); if (transformation.status !== "OPEN") throw new AppError("TRANSFORMATION_ORDER_CLOSED", "Transformation order is closed", 409); }
      const workType = await tx.workType.findUnique({ where: { id: data.workTypeId } }); if (!workType) throw new AppError("WORK_TYPE_NOT_FOUND", "Work type not found", 404); if (!workType.active) throw new AppError("WORK_TYPE_INACTIVE", "Work type is inactive", 409);
      if (batchIds.length && await tx.productionBatch.count({ where: { id: { in: batchIds } } }) !== batchIds.length) throw new AppError("PRODUCTION_BATCH_NOT_FOUND", "One or more production batches not found", 404);
      if (containerIds.length && await tx.productionContainer.count({ where: { id: { in: containerIds } } }) !== containerIds.length) throw new AppError("CONTAINER_NOT_FOUND", "One or more production containers not found", 404);
      const activeParticipants = await tx.productionParticipant.count({ where: { id: { in: participants.map(x => x.participantId) }, active: true } }); if (activeParticipants !== participants.length) throw new AppError("PRODUCTION_PARTICIPANT_INACTIVE", "One or more participants are missing or inactive", 409);
      const row = await tx.productionWork.create({ data: { productionOrderId: data.productionOrderId, ...(data.transformationOrderId ? { transformationOrderId: data.transformationOrderId } : {}), workTypeId: data.workTypeId, performedAt: data.performedAt, ...(data.observations !== undefined ? { observations: data.observations.trim() } : {}), createdByUserId: context.actorUserId, batches: { create: batchIds.map(productionBatchId => ({ productionBatch: { connect: { id: productionBatchId } } })), }, containers: { create: containerIds.map(productionContainerId => ({ productionContainer: { connect: { id: productionContainerId } } })) }, participants: { create: participants.map(x => ({ productionParticipant: { connect: { id: x.participantId } }, ...(x.role !== undefined ? { role: x.role.trim() } : {}) })) } }, include: this.include });
      await this.auditIn(tx).record(context, { action: "PRODUCTION_WORK_CREATED", resourceType: "production.work", resourceId: row.id, metadata: { productionOrderId: row.productionOrderId } });
      return mapWork(row);
    });
  }
  async correct(id: string, data: WorkCorrectionInput, context: AuthenticatedAuditContext) {
    uuid(id, "Work id"); requiredText(data.reason, "Correction reason");
    return new SharedUnitOfWork(this.prisma).execute(async tx => {
      await lock(tx, "production_works", [id], "Work id");
      const work = await tx.productionWork.findUnique({ where: { id } }); if (!work) throw new AppError("PRODUCTION_WORK_NOT_FOUND", "Production work not found", 404);
      let previous: unknown = work[data.field as keyof typeof work]; let next: unknown = data.newValue;
      if (data.field === "performedAt") { const parsed = new Date(data.newValue ?? ""); if (Number.isNaN(parsed.valueOf())) throw new AppError("INVALID_PRODUCTION_WORK", "performedAt must be a valid date", 400); next = parsed; }
      if (data.field === "workTypeId") { uuid(data.newValue ?? "", "Work type id"); await lock(tx, "production_work_types", [data.newValue!], "Work type id"); const type = await tx.workType.findUnique({ where: { id: data.newValue! } }); if (!type) throw new AppError("WORK_TYPE_NOT_FOUND", "Work type not found", 404); if (!type.active) throw new AppError("WORK_TYPE_INACTIVE", "Work type is inactive", 409); }
      if (data.field === "transformationOrderId") { if (data.newValue) { uuid(data.newValue, "Transformation order id"); await lock(tx, "transformation_orders", [data.newValue], "Transformation order id"); const t = await tx.transformationOrder.findUnique({ where: { id: data.newValue } }); if (!t) throw new AppError("TRANSFORMATION_ORDER_NOT_FOUND", "Transformation order not found", 404); if (t.productionOrderId !== work.productionOrderId) throw new AppError("TRANSFORMATION_ORDER_MISMATCH", "Transformation order belongs to another production order", 409); if (t.status !== "OPEN") throw new AppError("TRANSFORMATION_ORDER_CLOSED", "Transformation order is closed", 409); } next = data.newValue; }
      if (data.field === "observations") next = data.newValue?.trim() || null;
      const update = { [data.field]: next, version: { increment: 1 } } as any;
      const correctedAt = new Date();
      const correction = await tx.productionWorkCorrection.create({ data: { productionWorkId: id, field: data.field, previousValue: json(previous instanceof Date ? iso(previous) : previous), newValue: json(next instanceof Date ? iso(next) : next), reason: data.reason.trim(), correctedAt, actorUserId: context.actorUserId, fromVersion: work.version, toVersion: work.version + 1 } });
      await tx.$executeRaw`SELECT set_config('app.production_work_correction_id', ${correction.id}, true)`;
      const updated = await tx.productionWork.update({ where: { id }, data: update, include: this.include });
      await this.auditIn(tx).record(context, { action: "PRODUCTION_WORK_CORRECTED", resourceType: "production.work", resourceId: id, metadata: { field: data.field, reason: data.reason.trim() } });
      return mapWork(updated);
    });
  }
}