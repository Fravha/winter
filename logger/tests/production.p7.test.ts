import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { AuditService } from "../src/core/audit/audit.service.js";
import { PrismaAuditRepository } from "../src/core/audit/prisma-audit.repository.js";
import { ArticuloService } from "../src/modules/articulos/articulo.service.js";
import { PrismaArticuloRepository } from "../src/modules/articulos/prisma-articulo.repository.js";
import { PrismaArticuloUnitOfWork } from "../src/modules/articulos/prisma-articulo.unit-of-work.js";
import { ProductionService } from "../src/modules/production/production.service.js";
import { ProductionMeasurementService } from "../src/modules/production/production.measurement.js";
import { createTemporaryProductionDatabaseResource } from "./helpers/production-test-database.js";

const database = createTemporaryProductionDatabaseResource("P7_DATABASE_URL", connectionString => ({ connectionString, createClient: () => new PrismaClient({ adapter: new PrismaPg({ connectionString }) }) }));
const prisma = database?.createClient();
let available = false;
if (prisma) { try { await prisma.$queryRaw`SELECT 1 FROM production_measurements LIMIT 1`; available = true; } catch { available = false; } }
if (database && !available) throw new Error("P7_DATABASE_URL was supplied but the P7 migration/database is unavailable");
const options = available ? {} : { skip: "requires P7_DATABASE_URL with P7 migration applied" };
const actor = randomUUID();
const context = { actorUserId: actor, requestId: randomUUID() };

describe("Production P7 PostgreSQL", () => {
  before(async () => { if (prisma) await prisma.user.create({ data: { id: actor, firebaseUid: `p7-${actor}`, email: `${actor}@test.invalid`, status: "ACTIVE" } }); });
  after(async () => { await prisma?.$disconnect(); });
  async function fixture() {
    assert.ok(prisma);
    const audit = new AuditService(new PrismaAuditRepository(prisma));
    const articulos = new ArticuloService(new PrismaArticuloRepository(prisma), new PrismaArticuloUnitOfWork(prisma));
    const production = new ProductionService(prisma, audit, articulos);
    const order = await production.createOrder({ code: `P7-${randomUUID()}`, startDate: new Date() }, context);
    const type = await production.create("measurement-types", { code: `P7-MT-${randomUUID()}`, name: "Measure" }, context);
    const workType = await production.create("work-types", { code: `P7-WT-${randomUUID()}`, name: "Work" }, context);
    const participant = await production.create("participants", { code: `P7-P-${randomUUID()}`, name: "Operator" }, context);
    const articulo = await articulos.createArticulo({ codigo: `P7-A-${randomUUID()}`, nombre: "Raw", clasificacion: "MATERIA_PRIMA", unidadMedida: "KG" }, context);
    const batch = await production.createBatch({ code: `P7-B-${randomUUID()}`, productionOrderId: order.id, articuloId: articulo.id, unit: "KG", quantity: "4.000", operationKey: `p7-${randomUUID()}`, requestHash: "p7" }, context);
    const container = await production.createContainer({ code: `P7-C-${randomUUID()}`, capacity: "4.000", capacityUnit: "KG" }, context);
    const work = await production.createWork({ productionOrderId: order.id, workTypeId: workType.id, performedAt: new Date("2024-01-01T00:00:00Z"), batchIds: [batch.id], containerIds: [container.id], participants: [{ participantId: participant.id }] }, context);
    return { production, service: new ProductionMeasurementService(prisma), type, participant, articulo, batch, container, work };
  }
  it("creates every approved context combination and serializes exact values", options, async () => {
    assert.ok(prisma); const f = await fixture(); const at = new Date("2024-01-02T03:04:05.000Z");
    const create = (x: any, value = "0") => f.service.create({ measurementTypeId: f.type.id, value, unit: " unknown ", measuredAt: at, ...x }, context);
    for (const x of [{ productionBatchId: f.batch.id }, { productionContainerId: f.container.id }, { productionWorkId: f.work.id }, { productionBatchId: f.batch.id, productionContainerId: f.container.id }, { productionWorkId: f.work.id, productionBatchId: f.batch.id }, { productionWorkId: f.work.id, productionContainerId: f.container.id }, { productionWorkId: f.work.id, productionBatchId: f.batch.id, productionContainerId: f.container.id }]) await create(x, "-0.000001");
    const row = await f.service.create({ measurementTypeId: f.type.id, productionBatchId: f.batch.id, value: "12.345678", unit: " unknown ", measuredAt: at, observations: " note " }, context);
    assert.equal(row.value, "12.345678"); assert.equal(row.unit, "unknown"); assert.notEqual(row.createdAt, row.measuredAt);
    assert.equal((await prisma.productionMeasurement.findUniqueOrThrow({ where: { id: row.id } })).observations, "note");
    assert.equal(await prisma.auditLog.count({ where: { action: "PRODUCTION_MEASUREMENT_CREATED", resourceId: row.id, actorUserId: actor, requestId: context.requestId } }), 1);
    const listed = await f.service.list({ page: 1, pageSize: 100, measurementTypeId: f.type.id, productionBatchId: f.batch.id, measuredAtFrom: at, measuredAtTo: at });
    assert.ok(listed.items.length >= 2); assert.ok(listed.items.some(item => item.value === "12.345678")); assert.equal((await f.service.get(row.id))?.value, "12.345678"); assert.equal(await f.service.get(randomUUID()), null);
  });
  it("rejects invalid references, context, type, participant and decimal/unit input", options, async () => {
    assert.ok(prisma); const f = await fixture(); const base = { measurementTypeId: f.type.id, productionBatchId: f.batch.id, value: "1", unit: "KG", measuredAt: new Date() };
    await assert.rejects(f.service.create({ ...base, productionBatchId: undefined, value: "1" }, context), (e: any) => e.code === "MEASUREMENT_CONTEXT_REQUIRED");
    for (const value of ["1.1234567", "1234567890123", "abc"]) await assert.rejects(f.service.create({ ...base, value }, context), (e: any) => e.code === "MEASUREMENT_VALUE_INVALID");
    await assert.rejects(f.service.create({ ...base, unit: " ", }, context), (e: any) => e.code === "MEASUREMENT_UNIT_REQUIRED");
    await assert.rejects(f.service.create({ ...base, measurementTypeId: randomUUID() }, context), (e: any) => e.code === "MEASUREMENT_TYPE_NOT_FOUND");
    await assert.rejects(f.service.create({ ...base, participantId: randomUUID() }, context), (e: any) => e.code === "PRODUCTION_PARTICIPANT_NOT_FOUND");
    await f.production.setActive("participants", f.participant.id, false, context);
    await assert.rejects(f.service.create({ ...base, participantId: f.participant.id }, context), (e: any) => e.code === "PRODUCTION_PARTICIPANT_INACTIVE");
    await f.production.setActive("participants", f.participant.id, true, context);
    await assert.rejects(f.service.create({ ...base, productionBatchId: randomUUID() }, context), (e: any) => e.code === "PRODUCTION_BATCH_NOT_FOUND");
    await assert.rejects(f.service.create({ ...base, productionContainerId: randomUUID() }, context), (e: any) => e.code === "CONTAINER_NOT_FOUND");
    await assert.rejects(f.service.create({ ...base, productionWorkId: randomUUID() }, context), (e: any) => e.code === "PRODUCTION_WORK_NOT_FOUND");
    const otherBatch = await f.production.createBatch({ code: `P7-B-${randomUUID()}`, productionOrderId: (await prisma.productionWork.findUniqueOrThrow({ where: { id: f.work.id } })).productionOrderId, articuloId: f.articulo.id, unit: "KG", quantity: "1.000", operationKey: `p7-${randomUUID()}`, requestHash: "p7" }, context);
    await assert.rejects(f.service.create({ ...base, productionWorkId: f.work.id, productionBatchId: otherBatch.id }, context), (e: any) => e.code === "MEASUREMENT_CONTEXT_INCOHERENT");
    const otherContainer = await f.production.createContainer({ code: `P7-C-${randomUUID()}`, capacity: "1.000", capacityUnit: "KG" }, context);
    await assert.rejects(f.service.create({ ...base, productionWorkId: f.work.id, productionContainerId: otherContainer.id }, context), (e: any) => e.code === "MEASUREMENT_CONTEXT_INCOHERENT");
    await f.production.setActive("measurement-types", f.type.id, false, context);
    await assert.rejects(f.service.create(base, context), (e: any) => e.code === "MEASUREMENT_TYPE_INACTIVE");
  });
  it("enforces database checks and append-only history", options, async () => {
    assert.ok(prisma); const f = await fixture(); const row = await f.service.create({ measurementTypeId: f.type.id, productionBatchId: f.batch.id, value: "1", unit: "KG", measuredAt: new Date() }, context);
    await assert.rejects(prisma.$executeRaw`UPDATE production_measurements SET unit = 'x' WHERE id = ${row.id}`, /append-only/i);
    await assert.rejects(prisma.$executeRaw`DELETE FROM production_measurements WHERE id = ${row.id}`, /append-only/i);
    await assert.rejects(prisma.$executeRaw`INSERT INTO production_measurements (measurement_type_id,value,unit,measured_at,actor_user_id) VALUES (${f.type.id},1,'KG',NOW(),${actor})`, /context/i);
    await assert.rejects(prisma.$executeRaw`INSERT INTO production_measurements (measurement_type_id,production_batch_id,value,unit,measured_at,actor_user_id) VALUES (${f.type.id},${f.batch.id},1,' ',NOW(),${actor})`, /unit/i);
    const before = { ledger: await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: f.batch.id } }), balance: (await prisma.productionBatchBalance.findUniqueOrThrow({ where: { productionBatchId: f.batch.id } })).available.toString(), occupancy: await prisma.productionContainerOccupancy.count({ where: { containerId: f.container.id } }), movement: await prisma.productionBatchContainerMovement.count({ where: { destinationContainerId: f.container.id } }), works: await prisma.productionWork.count({ where: { id: f.work.id } }), inventory: await prisma.inventoryMovement.count({ where: { actorUserId: actor } }) };
    await f.service.create({ measurementTypeId: f.type.id, productionBatchId: f.batch.id, productionContainerId: f.container.id, productionWorkId: f.work.id, value: "-1", unit: "L", measuredAt: new Date() }, context);
    assert.deepEqual({ ledger: await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: f.batch.id } }), balance: (await prisma.productionBatchBalance.findUniqueOrThrow({ where: { productionBatchId: f.batch.id } })).available.toString(), occupancy: await prisma.productionContainerOccupancy.count({ where: { containerId: f.container.id } }), movement: await prisma.productionBatchContainerMovement.count({ where: { destinationContainerId: f.container.id } }), works: await prisma.productionWork.count({ where: { id: f.work.id } }), inventory: await prisma.inventoryMovement.count({ where: { actorUserId: actor } }) }, before);
  });
  it("rolls back the measurement when injected audit fails", options, async () => {
    assert.ok(prisma); const f = await fixture();
    const before = await prisma.productionMeasurement.count();
    const failing = new ProductionMeasurementService(prisma, (() => ({ record: async () => { throw new Error("audit failure"); } })) as any);
    await assert.rejects(failing.create({ measurementTypeId: f.type.id, productionBatchId: f.batch.id, value: "1", unit: "KG", measuredAt: new Date() }, context), /audit failure/);
    assert.equal(await prisma.productionMeasurement.count(), before);
  });
  it("linearizes measurement creation with measurement-type and participant deactivation", options, async () => {
    assert.ok(prisma); const f = await fixture();
    const typeRace = f.service.create({ measurementTypeId: f.type.id, productionBatchId: f.batch.id, value: "1", unit: "KG", measuredAt: new Date() }, context);
    const typeDeactivate = f.production.setActive("measurement-types", f.type.id, false, context);
    const typeResults = await Promise.allSettled([typeRace, typeDeactivate]);
    assert.equal(typeResults[1]?.status, "fulfilled");
    assert.ok(typeResults[0]?.status === "fulfilled" || (typeResults[0]?.reason as any)?.code === "MEASUREMENT_TYPE_INACTIVE");
    const type = await prisma.measurementType.findUniqueOrThrow({ where: { id: f.type.id } });
    assert.equal(type.active, false);
    assert.equal(
      await prisma.productionMeasurement.count({ where: { measurementTypeId: f.type.id } }),
      typeResults[0]?.status === "fulfilled" ? 1 : 0,
    );

    const participantRace = f.service.create({ measurementTypeId: (await f.production.create("measurement-types", { code: `P7-MT-${randomUUID()}`, name: "Race" }, context)).id, productionBatchId: f.batch.id, participantId: f.participant.id, value: "1", unit: "KG", measuredAt: new Date() }, context);
    const participantDeactivate = f.production.setActive("participants", f.participant.id, false, context);
    const participantResults = await Promise.allSettled([participantRace, participantDeactivate]);
    assert.equal(participantResults[1]?.status, "fulfilled");
    assert.ok(participantResults[0]?.status === "fulfilled" || (participantResults[0]?.reason as any)?.code === "PRODUCTION_PARTICIPANT_INACTIVE");
    const participant = await prisma.productionParticipant.findUniqueOrThrow({ where: { id: f.participant.id } });
    assert.equal(participant.active, false);
    assert.equal(
      await prisma.productionMeasurement.count({ where: { participantId: f.participant.id } }),
      participantResults[0]?.status === "fulfilled" ? 1 : 0,
    );
  });
  it("does not deadlock against a concurrent container assignment", options, async () => {
    assert.ok(prisma); const f = await fixture();
    const results = await Promise.allSettled([
      f.service.create({
        measurementTypeId: f.type.id,
        productionBatchId: f.batch.id,
        productionContainerId: f.container.id,
        value: "1.250000",
        unit: "KG",
        measuredAt: new Date(),
      }, context),
      f.production.assignBatchToContainer({
        batchId: f.batch.id,
        destinationContainerId: f.container.id,
        quantity: "1.000",
        operationKey: `p7-container-${randomUUID()}`,
        requestHash: "p7-container-race",
      }, context),
    ]);
    assert.deepEqual(results.map(result => result.status), ["fulfilled", "fulfilled"]);
  });
});