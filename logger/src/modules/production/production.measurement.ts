import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { SharedUnitOfWork, type SharedTransactionContext } from "../../core/database/shared-unit-of-work.js";
import { AuditService } from "../../core/audit/audit.service.js";
import { PrismaAuditRepository } from "../../core/audit/prisma-audit.repository.js";
import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import { AppError } from "../../shared/errors/app-error.js";

export type MeasurementInput = {
  measurementTypeId: string; productionBatchId?: string | undefined; productionContainerId?: string | undefined;
  productionWorkId?: string | undefined; participantId?: string | undefined; value: string; unit: string;
  measuredAt: Date; observations?: string | undefined;
};
export type MeasurementFilters = { page?: number; pageSize?: number; measurementTypeId?: string | undefined; productionBatchId?: string | undefined; productionContainerId?: string | undefined; productionWorkId?: string | undefined; measuredAtFrom?: Date | undefined; measuredAtTo?: Date | undefined };
const uuid = (value: string, label: string) => { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new AppError("INVALID_PRODUCTION_MEASUREMENT", `${label} must be a UUID`, 400); };
const map = (r: any) => ({ ...r, value: r.value.toString(), measuredAt: r.measuredAt.toISOString(), createdAt: r.createdAt.toISOString() });
async function lock(tx: SharedTransactionContext, table: string, ids: string[], label: string) {
  for (const id of [...new Set(ids)].sort()) { uuid(id, label); await tx.$queryRawUnsafe(`SELECT id FROM "${table}" WHERE id = $1::uuid FOR UPDATE`, id); }
}
export class ProductionMeasurementService {
  constructor(private readonly prisma: PrismaClient, private readonly auditFactory: (tx: SharedTransactionContext) => AuditService = tx => new AuditService(new PrismaAuditRepository(tx))) {}
  async create(data: MeasurementInput, context: AuthenticatedAuditContext) {
    const contexts = [data.productionBatchId, data.productionContainerId, data.productionWorkId].filter(Boolean);
    if (!contexts.length) throw new AppError("MEASUREMENT_CONTEXT_REQUIRED", "At least one production context is required", 400);
    if (!data.unit.trim()) throw new AppError("MEASUREMENT_UNIT_REQUIRED", "Unit is required", 400);
    uuid(context.actorUserId, "Actor user id");
    if (!(data.measuredAt instanceof Date) || Number.isNaN(data.measuredAt.valueOf())) throw new AppError("MEASUREMENT_DATE_INVALID", "measuredAt must be a valid date", 400);
    uuid(data.measurementTypeId, "Measurement type id"); if (data.productionBatchId) uuid(data.productionBatchId, "Batch id"); if (data.productionContainerId) uuid(data.productionContainerId, "Container id"); if (data.productionWorkId) uuid(data.productionWorkId, "Work id"); if (data.participantId) uuid(data.participantId, "Participant id");
    if (!/^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(data.value)) throw new AppError("MEASUREMENT_VALUE_INVALID", "Value must be a decimal with at most 6 fractional digits", 400);
    return new SharedUnitOfWork(this.prisma).execute(async tx => {
      await lock(tx, "production_measurement_types", [data.measurementTypeId], "Measurement type id");
      await lock(tx, "production_works", data.productionWorkId ? [data.productionWorkId] : [], "Work id");
      await lock(tx, "production_participants", data.participantId ? [data.participantId] : [], "Participant id");
      const type = await tx.measurementType.findUnique({ where: { id: data.measurementTypeId } }); if (!type) throw new AppError("MEASUREMENT_TYPE_NOT_FOUND", "Measurement type not found", 404); if (!type.active) throw new AppError("MEASUREMENT_TYPE_INACTIVE", "Measurement type is inactive", 409);
      if (data.productionBatchId && !(await tx.productionBatch.findUnique({ where: { id: data.productionBatchId } }))) throw new AppError("PRODUCTION_BATCH_NOT_FOUND", "Production batch not found", 404);
      if (data.productionContainerId && !(await tx.productionContainer.findUnique({ where: { id: data.productionContainerId } }))) throw new AppError("CONTAINER_NOT_FOUND", "Container not found", 404);
      if (data.productionWorkId && !(await tx.productionWork.findUnique({ where: { id: data.productionWorkId } }))) throw new AppError("PRODUCTION_WORK_NOT_FOUND", "Production work not found", 404);
      if (data.participantId) { const p = await tx.productionParticipant.findUnique({ where: { id: data.participantId } }); if (!p) throw new AppError("PRODUCTION_PARTICIPANT_NOT_FOUND", "Participant not found", 404); if (!p.active) throw new AppError("PRODUCTION_PARTICIPANT_INACTIVE", "Participant is inactive", 409); }
      if (data.productionWorkId && data.productionBatchId && !(await tx.productionWorkBatch.findUnique({ where: { productionWorkId_productionBatchId: { productionWorkId: data.productionWorkId, productionBatchId: data.productionBatchId } } }))) throw new AppError("MEASUREMENT_CONTEXT_INCOHERENT", "Batch is not linked to work", 409);
      if (data.productionWorkId && data.productionContainerId && !(await tx.productionWorkContainer.findUnique({ where: { productionWorkId_productionContainerId: { productionWorkId: data.productionWorkId, productionContainerId: data.productionContainerId } } }))) throw new AppError("MEASUREMENT_CONTEXT_INCOHERENT", "Container is not linked to work", 409);
      const observation = data.observations === undefined ? undefined : data.observations.trim();
      const row = await tx.productionMeasurement.create({ data: { measurementTypeId: data.measurementTypeId, ...(data.productionBatchId ? { productionBatchId: data.productionBatchId } : {}), ...(data.productionContainerId ? { productionContainerId: data.productionContainerId } : {}), ...(data.productionWorkId ? { productionWorkId: data.productionWorkId } : {}), ...(data.participantId ? { participantId: data.participantId } : {}), value: new Prisma.Decimal(data.value), unit: data.unit.trim(), measuredAt: data.measuredAt, ...(observation !== undefined ? { observations: observation || null } : {}), actorUserId: context.actorUserId } });
      await this.auditFactory(tx).record(context, { action: "PRODUCTION_MEASUREMENT_CREATED", resourceType: "production.measurement", resourceId: row.id });
      return map(row);
    });
  }
  async list(filters: MeasurementFilters = {}) {
    const page = filters.page ?? 1, pageSize = filters.pageSize ?? 20;
    const where: any = { ...(filters.measurementTypeId ? { measurementTypeId: filters.measurementTypeId } : {}), ...(filters.productionBatchId ? { productionBatchId: filters.productionBatchId } : {}), ...(filters.productionContainerId ? { productionContainerId: filters.productionContainerId } : {}), ...(filters.productionWorkId ? { productionWorkId: filters.productionWorkId } : {}), ...((filters.measuredAtFrom || filters.measuredAtTo) ? { measuredAt: { ...(filters.measuredAtFrom ? { gte: filters.measuredAtFrom } : {}), ...(filters.measuredAtTo ? { lte: filters.measuredAtTo } : {}) } } : {}) };
    const [rows, total] = await Promise.all([this.prisma.productionMeasurement.findMany({ where, orderBy: [{ measuredAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }), this.prisma.productionMeasurement.count({ where })]);
    return { items: rows.map(map), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }
  async get(id: string) {
    uuid(id, "Measurement id");
    const row = await this.prisma.productionMeasurement.findUnique({ where: { id }, include: { corrections: { orderBy: { toVersion: "asc" } } } });
    if (!row) return null;
    const result = map(row);
    return row.corrections.length === 0 ? result : {
      ...result,
      corrections: row.corrections.map(correction => ({ id: correction.id, field: correction.field, previousValue: correction.previousValue, newValue: correction.newValue, reason: correction.reason, correctedAt: correction.correctedAt.toISOString(), actorUserId: correction.actorUserId, fromVersion: correction.fromVersion, toVersion: correction.toVersion })),
    };
  }
}