import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createTemporaryProductionDatabaseResource } from "./helpers/production-test-database.js";
import { AuditService } from "../src/core/audit/audit.service.js";
import { PrismaAuditRepository } from "../src/core/audit/prisma-audit.repository.js";
import { ArticuloService } from "../src/modules/articulos/articulo.service.js";
import { PrismaArticuloRepository } from "../src/modules/articulos/prisma-articulo.repository.js";
import { PrismaArticuloUnitOfWork } from "../src/modules/articulos/prisma-articulo.unit-of-work.js";
import { ProductionService } from "../src/modules/production/production.service.js";
import { InventoryService } from "../src/modules/inventory/inventory.service.js";
import { createTrustedIntermoduleContext } from "../src/modules/inventory/inventory.model.js";

const database = createTemporaryProductionDatabaseResource("P10_DATABASE_URL", connectionString => ({ connectionString, createClient: () => new PrismaClient({ adapter: new PrismaPg({ connectionString }) }) }));
const prisma = database?.createClient();
let available = false;
if (prisma) { try { await prisma.$queryRaw`SELECT 1 FROM production_measurement_corrections LIMIT 1`; available = true; } catch { available = false; } }
if (database && !available) throw new Error("P10_DATABASE_URL was supplied but P10 migration/database is unavailable");
const options = available ? {} : { skip: "requires P10_DATABASE_URL with P10 migration applied" };

describe("Production P10 PostgreSQL guards", () => {
  after(async () => { await prisma?.$disconnect(); });
  it("exposes versioned correction tables and permissions only after P10 migration", options, async () => {
    assert.ok(prisma);
    const tables = await prisma.$queryRaw<Array<{ name: string }>>`SELECT table_name AS name FROM information_schema.tables WHERE table_name IN ('production_measurement_corrections','grape_reception_corrections')`;
    assert.deepEqual(tables.map(row => row.name).sort(), ["grape_reception_corrections", "production_measurement_corrections"]);
    const permissions = await prisma.permission.count({ where: { code: { in: ["production:measurement_correct", "production:reception_correct"] } } });
    assert.equal(permissions, 2);
  });
  it("has append-only correction triggers and deferred target guards", options, async () => {
    assert.ok(prisma);
    const triggers = await prisma.$queryRaw<Array<{ trigger_name: string }>>`SELECT trigger_name FROM information_schema.triggers WHERE trigger_name IN ('production_measurement_corrections_append_only','grape_reception_corrections_append_only','production_measurement_correction_commit_guard','grape_reception_correction_commit_guard')`;
    assert.equal(new Set(triggers.map(row => row.trigger_name)).size, 4);
  });
});

describe("Production P10 corrections and trace acceptance", () => {
  const actor = "00000000-0000-4000-8000-000000000010";
  const context = { actorUserId: actor, requestId: "00000000-0000-4000-8000-000000000011" };
  const service = prisma ? new ProductionService(prisma, new AuditService(new PrismaAuditRepository(prisma)), new ArticuloService(new PrismaArticuloRepository(prisma), new PrismaArticuloUnitOfWork(prisma))) : undefined;
  async function fixture() {
    assert.ok(prisma && service);
    await prisma.user.upsert({ where: { id: actor }, update: {}, create: { id: actor, firebaseUid: `p10-${actor}`, email: `${actor}@test.invalid`, status: "ACTIVE" } });
    const order = await service.createOrder({ code: `P10-O-${randomUUID()}`, startDate: new Date("2025-01-01T00:00:00.000Z") }, context);
    const article = await new ArticuloService(new PrismaArticuloRepository(prisma), new PrismaArticuloUnitOfWork(prisma)).createArticulo({ codigo: `P10-A-${randomUUID()}`, nombre: "P10 product", clasificacion: "MATERIA_PRIMA", unidadMedida: "KG" }, context);
    const batch = await service.createBatch({ code: `P10-B-${randomUUID()}`, productionOrderId: order.id, articuloId: article.id, unit: "KG", quantity: "5.000", operationKey: `p10-b-${randomUUID()}`, requestHash: "fixture" }, context);
    const type = await service.create("measurement-types", { code: `P10-MT-${randomUUID()}`, name: "Temperature" }, context);
    const participant = await service.create("participants", { code: `P10-P-${randomUUID()}`, name: "Operator" }, context);
    return { order, article, batch, type, participant };
  }
  it("corrects every Measurement field, preserves history, and replays exact results", options, async () => {
    assert.ok(prisma && service); const f = await fixture();
    const measurement = await service.createMeasurement({ measurementTypeId: f.type.id, productionBatchId: f.batch.id, participantId: f.participant.id, value: "1.000000", unit: "C", measuredAt: new Date("2025-01-01T00:00:00.000Z"), observations: "initial" }, context);
    const nextParticipant = await service.create("participants", { code: `P10-P-${randomUUID()}`, name: "Second" }, context);
    const corrections = [
      { field: "value", newValue: "2.100000" }, { field: "unit", newValue: "F" }, { field: "measuredAt", newValue: "2025-01-02T00:00:00.000Z" },
      { field: "participantId", newValue: nextParticipant.id }, { field: "participantId", newValue: null }, { field: "observations", newValue: "updated" }, { field: "observations", newValue: null },
    ] as const;
    let first: unknown;
    for (const [index, change] of corrections.entries()) {
      const result = await service.correctMeasurement(measurement.id, { ...change, reason: "approved", operationKey: `p10-m-${randomUUID()}` }, context);
      if (index === 0) first = result;
    }
    const replayKey = `p10-replay-${randomUUID()}`; const replayInput = { field: "value", newValue: "3.000000", reason: "replay", operationKey: replayKey };
    const replay = await service.correctMeasurement(measurement.id, replayInput, context); assert.deepEqual(await service.correctMeasurement(measurement.id, replayInput, context), replay);
    await assert.rejects(service.correctMeasurement(measurement.id, { ...replayInput, newValue: "4.000000" }, context), (error: { code?: string }) => error.code === "IDEMPOTENCY_CONFLICT");
    assert.ok(first);
    const stored = await service.getMeasurement(measurement.id); assert.ok(stored); assert.equal(stored.version, 8); assert.equal(stored.corrections.length, 8);
    assert.equal(stored.corrections[0]?.previousValue, "1.000000"); assert.equal(stored.corrections.find(item => item.field === "observations")?.newValue, "updated");
    await assert.rejects(service.correctMeasurement(measurement.id, { field: "observations", newValue: null, reason: "noop", operationKey: `p10-noop-${randomUUID()}` }, context), (error: { code?: string }) => error.code === "CORRECTION_NOOP");
    await assert.rejects(service.correctMeasurement(measurement.id, { field: "participantId", newValue: actor, reason: "inactive", operationKey: `p10-inactive-${randomUUID()}` }, context), (error: { code?: string }) => ["PRODUCTION_PARTICIPANT_NOT_FOUND", "PRODUCTION_PARTICIPANT_INACTIVE"].includes(error.code ?? ""));
  });
  it("serializes concurrent Measurement corrections and rolls back audit failure", options, async () => {
    assert.ok(prisma && service); const f = await fixture();
    const measurement = await service.createMeasurement({ measurementTypeId: f.type.id, productionBatchId: f.batch.id, value: "1.000000", unit: "C", measuredAt: new Date() }, context);
    const results = await Promise.all([service.correctMeasurement(measurement.id, { field: "observations", newValue: "a", reason: "one", operationKey: `p10-con-${randomUUID()}` }, context), service.correctMeasurement(measurement.id, { field: "observations", newValue: "b", reason: "two", operationKey: `p10-con-${randomUUID()}` }, context)]);
    assert.equal(results.length, 2); const current = await service.getMeasurement(measurement.id); assert.equal(current?.version, 2); assert.deepEqual(current?.corrections.map(item => [item.fromVersion, item.toVersion]), [[0, 1], [1, 2]]);
    const failing = new ProductionService(prisma, new AuditService({ create: async () => { throw new Error("audit failure"); } }));
    const before = await service.getMeasurement(measurement.id); await assert.rejects(failing.correctMeasurement(measurement.id, { field: "unit", newValue: "F", reason: "fail", operationKey: `p10-fail-${randomUUID()}` }, { ...context, actorUserId: randomUUID() }));
    const after = await service.getMeasurement(measurement.id); assert.deepEqual(after, before);
    await assert.rejects(prisma.productionMeasurement.update({ where: { id: measurement.id }, data: { observations: "raw" } })); await assert.rejects(prisma.productionMeasurement.delete({ where: { id: measurement.id } }));
  });
  it("corrects Reception administration only and preserves generated facts", options, async () => {
    assert.ok(prisma && service); const f = await fixture();
    const producer = await service.create("producers", { code: `P10-PR-${randomUUID()}`, name: "Producer" }, context);
    const replacementProducer = await service.create("producers", { code: `P10-PR-${randomUUID()}`, name: "Replacement producer" }, context);
    const reception = await service.createReception({ productionOrderId: f.order.id, producerId: producer.id, receivedAt: new Date("2025-01-01T00:00:00.000Z"), status: "ACCEPTED", items: [{ grapeVarietyId: (await service.create("grape-varieties", { code: `P10-V-${randomUUID()}`, name: "Variety" }, context)).id, articuloId: f.article.id, quantity: "1.000", unit: "KG" }], operationKey: `p10-r-${randomUUID()}`, requestHash: "fixture" }, context);
    const receptionId = (reception.reception as { id: string }).id; const batchId = reception.batchIds[0]!; const itemBefore = await prisma.grapeReceptionItem.findUniqueOrThrow({ where: { productionBatchId: batchId } });
    const received = await service.correctReception(receptionId, { field: "receivedAt", newValue: "2025-01-01T00:00:00.000Z", reason: "same", operationKey: `p10-r-noop-${randomUUID()}` }, context).catch(error => error);
    assert.equal((received as { code?: string }).code, "CORRECTION_NOOP");
    await service.correctReception(receptionId, { field: "observations", newValue: "arrival", reason: "note", operationKey: `p10-r-1-${randomUUID()}` }, context);
    await service.correctReception(receptionId, { field: "status", newValue: "ACCEPTED_WITH_OBSERVATIONS", reason: "status", operationKey: `p10-r-2-${randomUUID()}` }, context);
    const producerCorrectionInput = { field: "producerId", newValue: replacementProducer.id, reason: "replacement", operationKey: `p10-r-3-${randomUUID()}` };
    const producerCorrection = await service.correctReception(receptionId, producerCorrectionInput, context);
    const current = await service.getReception(receptionId); const currentRow = await prisma.grapeReception.findUniqueOrThrow({ where: { id: receptionId } }); assert.equal(currentRow.version, 3); assert.equal(current?.status, "ACCEPTED_WITH_OBSERVATIONS"); assert.equal(current?.observations, "arrival");
    for (const correction of (current as any)?.corrections ?? []) {
      assert.deepEqual(Object.keys(correction).sort(), ["actorUserId", "correctedAt", "field", "fromVersion", "id", "newValue", "previousValue", "reason", "toVersion"]);
      assert.equal("requestHash" in correction, false);
      assert.equal("result" in correction, false);
    }
    await prisma.producer.update({ where: { id: replacementProducer.id }, data: { active: false } });
    assert.deepEqual(await service.correctReception(receptionId, producerCorrectionInput, context), producerCorrection);
    const replayInput = { field: "receivedAt", newValue: "2024-12-31T23:59:00.000Z", reason: "replay", operationKey: `p10-r-replay-${randomUUID()}` };
    const replay = await service.correctReception(receptionId, replayInput, context); assert.deepEqual(await service.correctReception(receptionId, replayInput, context), replay);
    await assert.rejects(service.correctReception(receptionId, { ...replayInput, newValue: "2024-12-31T23:58:00.000Z" }, context), (error: { code?: string }) => error.code === "IDEMPOTENCY_CONFLICT");
    const itemAfter = await prisma.grapeReceptionItem.findUniqueOrThrow({ where: { productionBatchId: batchId } }); assert.deepEqual(itemAfter, itemBefore);
    const trace = await service.getBatchTrace(batchId); assert.equal(trace.rootBatchId, batchId); assert.ok(trace.batches.some(batch => batch.id === batchId)); assert.ok(trace.receptions.some(row => row.id === receptionId));
    assert.equal(typeof trace.batches[0]?.createdAt, "string"); assert.equal(typeof trace.ledger[0]?.quantity, "string"); assert.equal(trace.ledger.some(entry => "requestHash" in (entry.metadata ?? {})), false);
    assert.deepEqual(trace.batches.map(row => row.id), [...trace.batches].sort((a, b) => a.id.localeCompare(b.id)).map(row => row.id)); assert.deepEqual(await service.getBatchTrace(batchId), trace);
    await assert.rejects(service.getBatchTrace(randomUUID()), (error: { code?: string }) => error.code === "BATCH_NOT_FOUND");
    await assert.rejects(service.correctReception(receptionId, { field: "observations", newValue: null, reason: "clear", operationKey: `p10-r-clear-${randomUUID()}` }, context), (error: { code?: string }) => error.code === "RECEPTION_OBSERVATIONS_REQUIRED");
    await assert.rejects(service.correctReception(receptionId, { field: "quantity", newValue: "2.000", reason: "blocked field", operationKey: `p10-r-block-${randomUUID()}` }, context), (error: { code?: string }) => error.code === "VALIDATION_ERROR");
    await assert.rejects(service.correctReception(receptionId, { field: "receivedAt", newValue: "2030-01-01T00:00:00.000Z", reason: "late", operationKey: `p10-r-late-${randomUUID()}` }, context), (error: { code?: string }) => error.code === "RECEPTION_DATE_AFTER_BATCH");
    await assert.rejects(service.correctReception(receptionId, { field: "observations", newValue: "bounded", reason: "key", operationKey: "x".repeat(101) }, context), (error: { code?: string }) => error.code === "VALIDATION_ERROR");
    await assert.rejects(prisma.grapeReception.update({ where: { id: receptionId }, data: { observations: "raw" } })); await assert.rejects(prisma.grapeReception.delete({ where: { id: receptionId } }));
    const correctionId = current?.corrections[0]?.id; if (correctionId) { await assert.rejects(prisma.grapeReceptionCorrection.update({ where: { id: correctionId }, data: { reason: "raw" } })); await assert.rejects(prisma.grapeReceptionCorrection.delete({ where: { id: correctionId } })); }
  });
  it("serializes concurrent Reception corrections into contiguous versions", options, async () => {
    assert.ok(prisma && service); const f = await fixture();
    const variety = await service.create("grape-varieties", { code: `P10-V-${randomUUID()}`, name: "Concurrent" }, context);
    const producer = await service.create("producers", { code: `P10-PR-${randomUUID()}`, name: "Concurrent producer" }, context);
    const replacementProducer = await service.create("producers", { code: `P10-PR-${randomUUID()}`, name: "Concurrent replacement" }, context);
    const reception = await service.createReception({ productionOrderId: f.order.id, producerId: producer.id, receivedAt: new Date("2025-01-01T00:00:00.000Z"), status: "ACCEPTED", items: [{ grapeVarietyId: variety.id, articuloId: f.article.id, quantity: "1.000", unit: "KG" }], operationKey: `p10-rc-${randomUUID()}`, requestHash: "fixture" }, context);
    const id = (reception.reception as { id: string }).id;
    await Promise.all([
      service.correctReception(id, { field: "observations", newValue: "first", reason: "one", operationKey: `p10-rc-1-${randomUUID()}` }, context),
      service.correctReception(id, { field: "producerId", newValue: replacementProducer.id, reason: "two", operationKey: `p10-rc-2-${randomUUID()}` }, context),
    ]);
    const row = await prisma.grapeReception.findUniqueOrThrow({ where: { id }, include: { corrections: { orderBy: { toVersion: "asc" } } } });
    assert.equal(row.version, 2); assert.deepEqual(row.corrections.map(item => [item.fromVersion, item.toVersion]), [[0, 1], [1, 2]]);
  });
  it("preserves DECIMAL(18,6) precision in history, result and idempotency hash", options, async () => {
    assert.ok(prisma && service); const f = await fixture();
    const measurement = await service.createMeasurement({ measurementTypeId: f.type.id, productionBatchId: f.batch.id, value: "9007199254.000001", unit: "KG", measuredAt: new Date() }, context);
    const input = { field: "value" as const, newValue: "9007199254.000002", reason: "precision", operationKey: `p10-precision-${randomUUID()}` };
    const result = await service.correctMeasurement(measurement.id, input, context); assert.equal(result.value, "9007199254.000002");
    assert.deepEqual(await service.correctMeasurement(measurement.id, input, context), result);
    const row = await prisma.productionMeasurement.findUniqueOrThrow({ where: { id: measurement.id }, include: { corrections: true } });
    assert.equal(row.value.toFixed(6), "9007199254.000002"); assert.equal(row.corrections[0]?.previousValue, "9007199254.000001"); assert.equal(row.corrections[0]?.newValue, "9007199254.000002");
    await assert.rejects(service.correctMeasurement(measurement.id, { ...input, newValue: "9007199254.000003" }, context), (error: { code?: string }) => error.code === "IDEMPOTENCY_CONFLICT");
  });
  it("rolls back Reception target, version, history and audit when audit fails", options, async () => {
    assert.ok(prisma && service); const f = await fixture();
    const variety = await service.create("grape-varieties", { code: `P10-V-${randomUUID()}`, name: "Rollback" }, context);
    const reception = await service.createReception({ productionOrderId: f.order.id, receivedAt: new Date("2025-01-01T00:00:00.000Z"), status: "ACCEPTED", items: [{ grapeVarietyId: variety.id, articuloId: f.article.id, quantity: "1.000", unit: "KG" }], operationKey: `p10-rb-${randomUUID()}`, requestHash: "fixture" }, context);
    const id = (reception.reception as { id: string }).id; const before = await prisma.grapeReception.findUniqueOrThrow({ where: { id } }); const count = await prisma.grapeReceptionCorrection.count({ where: { grapeReceptionId: id } });
    const failing = new ProductionService(prisma, new AuditService({ create: async () => { throw new Error("audit failure"); } }));
    await assert.rejects(failing.correctReception(id, { field: "observations", newValue: "must rollback", reason: "fail", operationKey: `p10-rb-c-${randomUUID()}` }, { ...context, actorUserId: randomUUID() }));
    const after = await prisma.grapeReception.findUniqueOrThrow({ where: { id } }); assert.equal(after.version, before.version); assert.equal(await prisma.grapeReceptionCorrection.count({ where: { grapeReceptionId: id } }), count);
  });
  it("rejects forged/orphan/noncontiguous deferred correction commits for both targets", options, async () => {
    assert.ok(prisma && service); const f = await fixture();
    const measurement = await service.createMeasurement({ measurementTypeId: f.type.id, productionBatchId: f.batch.id, value: "1.000000", unit: "C", measuredAt: new Date() }, context);
    const variety = await service.create("grape-varieties", { code: `P10-V-${randomUUID()}`, name: "Guards" }, context);
    const reception = await service.createReception({ productionOrderId: f.order.id, receivedAt: new Date("2025-01-01T00:00:00.000Z"), status: "ACCEPTED", items: [{ grapeVarietyId: variety.id, articuloId: f.article.id, quantity: "1.000", unit: "KG" }], operationKey: `p10-g-${randomUUID()}`, requestHash: "fixture" }, context);
    const receptionId = (reception.reception as { id: string }).id; const now = new Date();
    const base = { field: "observations", previousValue: null, newValue: "forged", reason: "forged", correctedAt: now, actorUserId: actor, requestHash: randomUUID(), result: {} };
    await assert.rejects(prisma.$transaction(tx => tx.productionMeasurementCorrection.create({ data: { ...base, id: randomUUID(), productionMeasurementId: measurement.id, toVersion: 2, fromVersion: 1, operationKey: `p10-forged-m-${randomUUID()}` } })));
    await assert.rejects(prisma.$transaction(tx => tx.grapeReceptionCorrection.create({ data: { ...base, id: randomUUID(), grapeReceptionId: receptionId, toVersion: 2, fromVersion: 1, operationKey: `p10-forged-r-${randomUUID()}` } })));
    await assert.rejects(prisma.productionMeasurementCorrection.create({ data: { ...base, id: randomUUID(), productionMeasurementId: randomUUID(), toVersion: 1, fromVersion: 0, operationKey: `p10-orphan-m-${randomUUID()}` } }));
    await assert.rejects(prisma.grapeReceptionCorrection.create({ data: { ...base, id: randomUUID(), grapeReceptionId: randomUUID(), toVersion: 1, fromVersion: 0, operationKey: `p10-orphan-r-${randomUUID()}` } }));
  });
  it("traces a rich split/merge/transformation/work/container/measurement/inventory graph", options, async () => {
    assert.ok(prisma && service);
    const f = await fixture(); const articles = new ArticuloService(new PrismaArticuloRepository(prisma), new PrismaArticuloUnitOfWork(prisma));
    const inventory = new InventoryService(prisma, articles); const rich = new ProductionService(prisma, new AuditService(new PrismaAuditRepository(prisma)), articles, inventory);
    const split = await rich.splitBatch({ parentBatchId: f.batch.id, children: [{ code: `P10-S1-${randomUUID()}`, quantity: "2.000" }, { code: `P10-S2-${randomUUID()}`, quantity: "2.000" }], operationKey: `p10-split-${randomUUID()}`, requestHash: "graph" }, context);
    const merged = await rich.mergeBatches({ parentBatches: split.children.map(child => ({ batchId: child.id, quantity: "1.000" })), code: `P10-M-${randomUUID()}`, articuloId: f.article.id, unit: "KG", productionOrderId: f.order.id, operationKey: `p10-merge-${randomUUID()}`, requestHash: "graph" }, context);
    const outputArticle = await articles.createArticulo({ codigo: `P10-OUT-${randomUUID()}`, nombre: "Graph output", clasificacion: "PRODUCTO_TERMINADO", unidadMedida: "KG" }, context);
    const transformed = await rich.createTransformation({ productionOrderId: f.order.id, performedAt: new Date("2025-01-03T00:00:00.000Z"), operationKey: `p10-transform-${randomUUID()}`, requestHash: "graph", inputs: [{ productionBatchId: merged.id, quantity: "1.000" }], outputs: [{ articuloId: outputArticle.id, quantity: "1.000", unit: "KG" }], losses: [{ productionBatchId: merged.id, quantity: "0.100", unit: "KG", operationKey: `p10-loss-${randomUUID()}`, requestHash: "graph" }] }, context);
    const container = await rich.createContainer({ code: `P10-C-${randomUUID()}`, capacity: "2.000", capacityUnit: "KG" }, context);
    const workedBatchId = split.children[0]!.id;
    await rich.assignBatchToContainer({ batchId: workedBatchId, destinationContainerId: container.id, quantity: "1.000", operationKey: `p10-occ-${randomUUID()}`, requestHash: "graph" }, context);
    const workType = await rich.create("work-types", { code: `P10-WT-${randomUUID()}`, name: "Graph work" }, context);
    const work = await rich.createWork({ productionOrderId: f.order.id, workTypeId: workType.id, performedAt: new Date("2025-01-04T00:00:00.000Z"), batchIds: [workedBatchId], containerIds: [container.id], participants: [{ participantId: f.participant.id, role: "operator" }] }, context);
    await rich.correctWork(work.id, { field: "observations", newValue: "corrected", reason: "graph" }, context);
    const workTransformation = await rich.createTransformation({ productionOrderId: f.order.id, performedAt: new Date("2025-01-04T01:00:00.000Z"), productionWorkId: work.id, operationKey: `p10-work-transform-${randomUUID()}`, requestHash: "graph", inputs: [{ productionBatchId: f.batch.id, quantity: "0.500" }], outputs: [{ articuloId: outputArticle.id, quantity: "0.500", unit: "KG" }] }, context);
    const workLoss = await prisma.productionLoss.create({ data: { productionOrderId: f.order.id, transformationId: workTransformation.id, productionWorkId: work.id, quantity: "0.100", unit: "KG", occurredAt: new Date("2025-01-04T01:00:00.000Z"), actorUserId: actor, operationKey: `p10-work-loss-${randomUUID()}`, requestHash: "graph" } });
    const direct = await rich.createMeasurement({ measurementTypeId: f.type.id, productionBatchId: workedBatchId, value: "1.000000", unit: "KG", measuredAt: new Date(), observations: "direct" }, context);
    const workMeasurement = await rich.createMeasurement({ measurementTypeId: f.type.id, productionWorkId: work.id, value: "2.000000", unit: "KG", measuredAt: new Date() }, context);
    const containerMeasurement = await rich.createMeasurement({ measurementTypeId: f.type.id, productionContainerId: container.id, value: "3.000000", unit: "KG", measuredAt: new Date() }, context);
    await rich.correctMeasurement(direct.id, { field: "observations", newValue: "corrected", reason: "graph", operationKey: `p10-trace-correction-${randomUUID()}` }, context);
    const warehouse = await prisma.warehouse.create({ data: { codigo: `P10-W-${randomUUID()}`, nombre: "Graph warehouse" } });
    const release = await rich.releaseBatchToInventory({ productionBatchId: transformed.outputs[0]!.productionBatchId, quantity: "1.000", warehouseId: warehouse.id, operationKey: `p10-inventory-${randomUUID()}`, lotCode: `P10-LOT-${randomUUID()}`, classification: "PRODUCTO_ENVASADO", fechaIngreso: new Date("2025-01-05T00:00:00.000Z") }, context);
    const trace = await rich.getBatchTrace(merged.id);
    assert.ok(trace.lineage.some(edge => edge.parentBatchId === f.batch.id)); assert.ok(trace.lineage.some(edge => edge.childBatchId === merged.id));
    assert.equal(new Set(trace.lineage.map(edge => edge.id)).size, trace.lineage.length); assert.ok(trace.lineage.every(edge => edge.parentBatchId !== edge.childBatchId));
    assert.ok(trace.transformations.some(row => row.id === transformed.id && row.inputs.length && row.outputs.length && row.losses.length));
    assert.ok(trace.transformations.some(row => row.id === workTransformation.id)); assert.ok(trace.losses.some(row => row.id === workLoss.id));
    assert.ok(trace.losses.some(row => transformed.losses.some(loss => loss.id === row.id))); assert.ok(trace.works.some(row => row.id === work.id)); assert.ok(trace.containers.some(row => row.id === container.id));
    assert.ok(trace.measurements.some(row => row.id === direct.id)); assert.ok(trace.measurements.some(row => row.id === workMeasurement.id)); assert.ok(trace.measurements.some(row => row.id === containerMeasurement.id));
    assert.ok(trace.inventory.lots.some(row => row.id === release.inventoryLotId)); assert.ok(trace.inventory.movements.some(row => row.inventoryLotId === release.inventoryLotId));
    assert.ok(trace.lineage.every(row => typeof row.createdAt === "string")); assert.ok(trace.measurements.every(row => typeof row.value === "string")); assert.equal(JSON.stringify(trace).includes("requestHash"), false);
    assert.equal(createTrustedIntermoduleContext(context).actorUserId, context.actorUserId);
  });
});