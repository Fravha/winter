import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { SharedTransactionContext } from "../../core/database/shared-unit-of-work.js";
import { SharedUnitOfWork } from "../../core/database/shared-unit-of-work.js";
import { AuditService } from "../../core/audit/audit.service.js";
import { PrismaAuditRepository } from "../../core/audit/prisma-audit.repository.js";
import type { AuthenticatedAuditContext } from "../../core/audit/audit.types.js";
import { AppError } from "../../shared/errors/app-error.js";

type Tx = SharedTransactionContext;
type CorrectionInput = { field: string; newValue: unknown; reason: string; operationKey: string };
const uuid = (value: string, label: string) => { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new AppError("VALIDATION_ERROR", `${label} must be a UUID`, 400); };
const json = (value: unknown): Prisma.InputJsonValue => value === null ? null as never : typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : JSON.parse(JSON.stringify(value));
const digest = (targetId: string, data: CorrectionInput, value: unknown) => createHash("sha256").update(JSON.stringify({ targetId, field: data.field, newValue: value, reason: data.reason.trim() })).digest("hex");
const lock = async (tx: Tx, table: string, id: string) => { await tx.$queryRawUnsafe(`SELECT id FROM "${table}" WHERE id = $1::uuid FOR UPDATE`, id); };
const operationLock = async (tx: Tx, key: string) => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`; };
const canonicalDate = (value: unknown) => { const d = new Date(String(value)); if (Number.isNaN(d.valueOf())) throw new AppError("VALIDATION_ERROR", "Date is invalid", 400); return d; };
const isoDate = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new AppError("VALIDATION_ERROR", "receivedAt must be an ISO datetime", 400);
  return canonicalDate(value);
};
const decimal6 = (value: unknown) => { const s = String(value).trim(); if (!/^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(s)) throw new AppError("VALIDATION_ERROR", "Value must have at most six decimals", 400); return new Prisma.Decimal(s); };

export class ProductionCorrectionService {
  constructor(private readonly prisma: PrismaClient, private readonly auditFactory = (tx: Tx) => new AuditService(new PrismaAuditRepository(tx))) {}

  async correctMeasurement(id: string, data: CorrectionInput, context: AuthenticatedAuditContext) {
    uuid(id, "Measurement id"); if (!data.reason?.trim() || !data.operationKey?.trim()) throw new AppError("VALIDATION_ERROR", "Reason and operationKey are required", 400);
    return new SharedUnitOfWork(this.prisma).execute(async tx => {
      await operationLock(tx, data.operationKey); await lock(tx, "production_measurements", id);
      const old = await tx.productionMeasurement.findUnique({ where: { id }, include: { corrections: { orderBy: { toVersion: "asc" } } } });
      if (!old) throw new AppError("PRODUCTION_MEASUREMENT_NOT_FOUND", "Production measurement not found", 404);
      const value = data.field === "value" ? decimal6(data.newValue) : data.field === "measuredAt" ? canonicalDate(data.newValue) : data.field === "unit" ? String(data.newValue).trim() : data.field === "observations" ? (data.newValue == null ? null : String(data.newValue).trim() || null) : data.field === "participantId" ? (data.newValue == null ? null : String(data.newValue)) : (() => { throw new AppError("VALIDATION_ERROR", "Field is not correctable", 400); })();
      if (data.field === "unit" && !value) throw new AppError("VALIDATION_ERROR", "Unit is required", 400);
      if (data.field === "participantId" && value) { uuid(value as string, "Participant id"); await lock(tx, "production_participants", value as string); const p = await tx.productionParticipant.findUnique({ where: { id: value as string } }); if (!p) throw new AppError("PRODUCTION_PARTICIPANT_NOT_FOUND", "Participant not found", 404); if (!p.active) throw new AppError("PRODUCTION_PARTICIPANT_INACTIVE", "Participant is inactive", 409); }
      const previous = (old as any)[data.field]; const previousJson = previous instanceof Prisma.Decimal ? previous.toFixed(6) : previous instanceof Date ? previous.toISOString() : previous;
      const nextJson = value instanceof Prisma.Decimal ? value.toFixed(6) : value instanceof Date ? value.toISOString() : value;
      const hash = digest(id, data, nextJson); const existing = await tx.productionMeasurementCorrection.findUnique({ where: { operationKey: data.operationKey } });
      const crossType = await tx.grapeReceptionCorrection.findUnique({ where: { operationKey: data.operationKey } }); if (crossType) throw new AppError("IDEMPOTENCY_CONFLICT", "Operation key is already used by a reception correction", 409);
      if (existing) { if (existing.requestHash !== hash) throw new AppError("IDEMPOTENCY_CONFLICT", "Operation key was used with a different request", 409); return existing.result; }
      if (JSON.stringify(previousJson) === JSON.stringify(nextJson)) throw new AppError("CORRECTION_NOOP", "Correction does not change the value", 409);
      const correctionId = randomUUID(); const result = { id, field: data.field, value: nextJson, version: old.version + 1, correctionId };
      const correction = await tx.productionMeasurementCorrection.create({ data: { id: correctionId, productionMeasurementId: id, field: data.field, previousValue: json(previousJson), newValue: json(nextJson), reason: data.reason.trim(), correctedAt: new Date(), actorUserId: context.actorUserId, fromVersion: old.version, toVersion: old.version + 1, operationKey: data.operationKey, requestHash: hash, result: json(result) } });
      await tx.$executeRaw`SELECT set_config('app.production_measurement_correction_id', ${correction.id}, true)`;
      const updated = await tx.productionMeasurement.update({ where: { id }, data: { [data.field]: value, version: { increment: 1 } } as any });
      if (updated.version !== result.version) throw new AppError("PRODUCTION_CONCURRENCY_CONFLICT", "Measurement changed concurrently", 409);
      await this.auditFactory(tx).record(context, { action: "PRODUCTION_MEASUREMENT_CORRECTED", resourceType: "production.measurement", resourceId: id, metadata: { field: data.field, reason: data.reason.trim(), version: updated.version } });
      return result;
    });
  }

  async correctReception(id: string, data: CorrectionInput, context: AuthenticatedAuditContext) {
    uuid(id, "Reception id"); if (!data.reason?.trim() || !data.operationKey?.trim()) throw new AppError("VALIDATION_ERROR", "Reason and operationKey are required", 400);
    if (data.reason.trim().length > 2000 || data.operationKey.trim().length > 100 || !["receivedAt", "producerId", "observations", "status"].includes(data.field)) throw new AppError("VALIDATION_ERROR", "Invalid reception correction", 400);
    const value = data.field === "receivedAt" ? isoDate(data.newValue) : data.field === "producerId" ? (typeof data.newValue === "string" ? data.newValue : (() => { throw new AppError("VALIDATION_ERROR", "Producer id is required", 400); })()) : data.field === "observations" ? (data.newValue === null ? null : typeof data.newValue === "string" && data.newValue.length <= 2000 ? data.newValue : (() => { throw new AppError("VALIDATION_ERROR", "Observations must be at most 2000 characters", 400); })()) : data.field === "status" && (data.newValue === "ACCEPTED" || data.newValue === "ACCEPTED_WITH_OBSERVATIONS") ? data.newValue : (() => { throw new AppError("VALIDATION_ERROR", "Field is not correctable", 400); })();
    const nextJson = value instanceof Date ? value.toISOString() : value;
    const hash = digest(id, data, nextJson);
    return new SharedUnitOfWork(this.prisma).execute(async tx => {
      await operationLock(tx, data.operationKey);
      const existing = await tx.grapeReceptionCorrection.findUnique({ where: { operationKey: data.operationKey } }); if (existing) { if (existing.requestHash !== hash) throw new AppError("IDEMPOTENCY_CONFLICT", "Operation key was used with a different request", 409); return existing.result; }
      const crossType = await tx.productionMeasurementCorrection.findUnique({ where: { operationKey: data.operationKey } }); if (crossType) throw new AppError("IDEMPOTENCY_CONFLICT", "Operation key is already used by a measurement correction", 409);
      await lock(tx, "grape_receptions", id);
      const old = await tx.grapeReception.findUnique({ where: { id }, include: { items: { include: { productionBatch: { include: { ledger: { where: { entryType: "GENERATED" }, orderBy: { occurredAt: "asc" }, take: 1 } } } } }, corrections: { orderBy: { toVersion: "asc" } } } });
      if (!old) throw new AppError("GRAPE_RECEPTION_NOT_FOUND", "Grape reception not found", 404);
      if (data.field === "producerId" && value) { uuid(value as string, "Producer id"); await lock(tx, "production_producers", value as string); const p = await tx.producer.findUnique({ where: { id: value as string } }); if (!p) throw new AppError("PRODUCER_NOT_FOUND", "Producer not found", 404); if (!p.active) throw new AppError("PRODUCER_INACTIVE", "Producer is inactive", 409); }
      if (data.field === "status" && value === "ACCEPTED_WITH_OBSERVATIONS" && !String(old.observations ?? "").trim()) throw new AppError("RECEPTION_OBSERVATIONS_REQUIRED", "This status requires observations", 409);
      if (data.field === "observations" && old.status === "ACCEPTED_WITH_OBSERVATIONS" && !String(value ?? "").trim()) throw new AppError("RECEPTION_OBSERVATIONS_REQUIRED", "Observations cannot be cleared for this status", 409);
      if (data.field === "receivedAt") { const generated = old.items.flatMap((item: any) => item.productionBatch.ledger).map((x: any) => x.occurredAt).sort((a: Date, b: Date) => a.valueOf() - b.valueOf())[0]; if (generated && value instanceof Date && value > generated) throw new AppError("RECEPTION_DATE_AFTER_BATCH", "Received date cannot be after generated batch", 409); }
      const previous = (old as any)[data.field]; const previousJson = previous instanceof Date ? previous.toISOString() : previous;
      if (JSON.stringify(previousJson) === JSON.stringify(nextJson)) throw new AppError("CORRECTION_NOOP", "Correction does not change the value", 409);
      const correctionId = randomUUID(); const result = { id, field: data.field, value: nextJson, version: old.version + 1, correctionId };
      const correction = await tx.grapeReceptionCorrection.create({ data: { id: correctionId, grapeReceptionId: id, field: data.field, previousValue: json(previousJson), newValue: json(nextJson), reason: data.reason.trim(), correctedAt: new Date(), actorUserId: context.actorUserId, fromVersion: old.version, toVersion: old.version + 1, operationKey: data.operationKey, requestHash: hash, result: json(result) } });
      await tx.$executeRaw`SELECT set_config('app.grape_reception_correction_id', ${correction.id}, true)`;
      const updated = await tx.grapeReception.update({ where: { id }, data: { [data.field]: value, version: { increment: 1 } } as any });
      if (updated.version !== result.version) throw new AppError("PRODUCTION_CONCURRENCY_CONFLICT", "Reception changed concurrently", 409);
      await this.auditFactory(tx).record(context, { action: "GRAPE_RECEPTION_CORRECTED", resourceType: "production.grape_reception", resourceId: id, metadata: { field: data.field, reason: data.reason.trim(), version: updated.version } });
      return result;
    });
  }
}