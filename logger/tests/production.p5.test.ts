import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { AuditService } from "../src/core/audit/audit.service.js";
import { PrismaAuditRepository } from "../src/core/audit/prisma-audit.repository.js";
import { ProductionService } from "../src/modules/production/production.service.js";
import { ProductionWorkService } from "../src/modules/production/production.work.js";

const connectionString = process.env.P5_DATABASE_URL;
let available = false;
if (connectionString) {
  const probe = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try { await probe.$queryRaw`SELECT 1 FROM production_work_corrections LIMIT 1`; available = true; } catch { available = false; } finally { await probe.$disconnect(); }
}
if (process.env.P5_DATABASE_URL && !available) throw new Error("P5_DATABASE_URL was supplied but the P5 migration/database is unavailable");
const options = available ? {} : { skip: "requires P5_DATABASE_URL with the P5 migration applied" };

describe("Production P5 PostgreSQL", () => {
  const prisma = connectionString ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) }) : undefined;
  const actorUserId = randomUUID();
  const context = { actorUserId, requestId: randomUUID() };
  const service = prisma ? new ProductionService(prisma, new AuditService(new PrismaAuditRepository(prisma))) : undefined;
  const ids: { orders: string[]; transformations: string[]; workTypes: string[]; participants: string[]; batches: string[]; containers: string[]; works: string[] } = { orders: [], transformations: [], workTypes: [], participants: [], batches: [], containers: [], works: [] };

  before(async () => {
    if (!available || !prisma) return;
    await prisma.user.create({ data: { id: actorUserId, firebaseUid: `p5-${actorUserId}`, email: `${actorUserId}@test.invalid`, status: "ACTIVE" } });
  });
  after(async () => { if (prisma) await prisma.$disconnect(); });

  async function fixture() {
    assert.ok(service);
    const order = await service.createOrder({ code: `P5-${randomUUID()}`, startDate: new Date() }, context); ids.orders.push(order.id);
    const type = await service.create("work-types", { code: `P5-WT-${randomUUID()}`, name: "Harvest" }, context); ids.workTypes.push(type.id);
    const participant = await service.create("participants", { code: `P5-P-${randomUUID()}`, name: "Operator" }, context); ids.participants.push(participant.id);
    const batch = await service.createBatch({ code: `P5-B-${randomUUID()}`, productionOrderId: order.id, articuloId: randomUUID(), unit: "KG", quantity: "4.000", operationKey: `p5-b-${randomUUID()}`, requestHash: "p5" }, context); ids.batches.push(batch.id);
    const container = await service.createContainer({ code: `P5-C-${randomUUID()}`, capacity: "4.000", capacityUnit: "KG" }, context); ids.containers.push(container.id);
    return { order, type, participant, batch, container };
  }

  it("creates valid work with multiple relations and preserves performedAt separately", options, async () => {
    assert.ok(service && prisma);
    const f = await fixture();
    const secondBatch = await service.createBatch({ code: `P5-B-${randomUUID()}`, productionOrderId: f.order.id, articuloId: randomUUID(), unit: "KG", quantity: "2.000", operationKey: `p5-b-${randomUUID()}`, requestHash: "p5" }, context); ids.batches.push(secondBatch.id);
    const secondContainer = await service.createContainer({ code: `P5-C-${randomUUID()}`, capacity: "2.000", capacityUnit: "KG" }, context); ids.containers.push(secondContainer.id);
    const secondParticipant = await service.create("participants", { code: `P5-P-${randomUUID()}`, name: "Supervisor" }, context); ids.participants.push(secondParticipant.id);
    const performedAt = new Date("2024-01-02T03:04:05.000Z");
    const work = await service.createWork({ productionOrderId: f.order.id, workTypeId: f.type.id, performedAt, observations: "shift", batchIds: [f.batch.id, secondBatch.id], containerIds: [f.container.id, secondContainer.id], participants: [{ participantId: f.participant.id, role: "operator" }, { participantId: secondParticipant.id, role: "supervisor" }] }, context);
    ids.works.push(work.id);
    assert.equal(work.performedAt, performedAt.toISOString());
    assert.notEqual(work.createdAt, work.performedAt);
    assert.deepEqual(work.batchIds.sort(), [f.batch.id, secondBatch.id].sort());
    assert.deepEqual(work.containerIds.sort(), [f.container.id, secondContainer.id].sort());
    assert.deepEqual(work.participants.map(x => x.role).sort(), ["operator", "supervisor"]);
    assert.equal(await prisma.auditLog.count({ where: { actorUserId, action: "PRODUCTION_WORK_CREATED", resourceId: work.id } }), 1);
  });

  it("rejects closed and invalid references without mutating unrelated state", options, async () => {
    assert.ok(service && prisma);
    const f = await fixture();
    const other = await service.createOrder({ code: `P5-OTHER-${randomUUID()}`, startDate: new Date() }, context); ids.orders.push(other.id);
    const wrong = await service.createTransformationOrder({ code: `P5-T-${randomUUID()}`, productionOrderId: other.id, periodStart: new Date() }, context); ids.transformations.push(wrong.id);
    const closed = await service.createTransformationOrder({ code: `P5-T-${randomUUID()}`, productionOrderId: f.order.id, periodStart: new Date() }, context); ids.transformations.push(closed.id);
    await service.closeTransformationOrder(closed.id, context);
    await assert.rejects(service.createWork({ productionOrderId: f.order.id, transformationOrderId: wrong.id, workTypeId: f.type.id, performedAt: new Date() }, context), (e: any) => e.code === "TRANSFORMATION_ORDER_MISMATCH");
    await assert.rejects(service.createWork({ productionOrderId: f.order.id, transformationOrderId: closed.id, workTypeId: f.type.id, performedAt: new Date() }, context), (e: any) => e.code === "TRANSFORMATION_ORDER_CLOSED");
    await service.closeOrder(f.order.id, context);
    await assert.rejects(service.createWork({ productionOrderId: f.order.id, workTypeId: f.type.id, performedAt: new Date() }, context), (e: any) => e.code === "PRODUCTION_ORDER_CLOSED");
    assert.equal(await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: f.batch.id } }), 1);
    assert.equal(await prisma.productionContainerOccupancy.count({ where: { containerId: f.container.id } }), 0);
    assert.equal(await prisma.inventoryMovement.count({ where: { actorUserId } }), 0);
  });

  it("rejects missing/inactive work types, batches, containers and participants", options, async () => {
    assert.ok(service);
    const f = await fixture();
    await assert.rejects(service.createWork({ productionOrderId: f.order.id, workTypeId: randomUUID(), performedAt: new Date() }, context), (e: any) => e.code === "WORK_TYPE_NOT_FOUND");
    await service.setActive("work-types", f.type.id, false, context);
    await assert.rejects(service.createWork({ productionOrderId: f.order.id, workTypeId: f.type.id, performedAt: new Date() }, context), (e: any) => e.code === "WORK_TYPE_INACTIVE");
    await assert.rejects(service.createWork({ productionOrderId: f.order.id, workTypeId: (await service.create("work-types", { code: `P5-WT-${randomUUID()}`, name: "Other" }, context)).id, performedAt: new Date(), batchIds: [randomUUID()], containerIds: [randomUUID()], participants: [{ participantId: randomUUID() }] }, context), (e: any) => ["PRODUCTION_BATCH_NOT_FOUND", "CONTAINER_NOT_FOUND", "PRODUCTION_PARTICIPANT_INACTIVE"].includes(e.code));
    await service.setActive("participants", f.participant.id, false, context);
    const activeType = await service.create("work-types", { code: `P5-WT-${randomUUID()}`, name: "Active" }, context);
    await assert.rejects(service.createWork({ productionOrderId: f.order.id, workTypeId: activeType.id, performedAt: new Date(), participants: [{ participantId: f.participant.id }] }, context), (e: any) => e.code === "PRODUCTION_PARTICIPANT_INACTIVE");
  });

  it("rejects duplicate relations and conflicting participant roles", options, async () => {
    assert.ok(service);
    const f = await fixture();
    await assert.rejects(service.createWork({ productionOrderId: f.order.id, workTypeId: f.type.id, performedAt: new Date(), batchIds: [f.batch.id, f.batch.id] }, context), (e: any) => e.code === "INVALID_PRODUCTION_WORK");
    await assert.rejects(service.createWork({ productionOrderId: f.order.id, workTypeId: f.type.id, performedAt: new Date(), participants: [{ participantId: f.participant.id, role: "a" }, { participantId: f.participant.id, role: "b" }] }, context), (e: any) => e.code === "INVALID_PRODUCTION_WORK");
  });

  it("corrects every permitted field with exact history and preserves joins", options, async () => {
    assert.ok(service && prisma);
    const f = await fixture();
    const work = await service.createWork({ productionOrderId: f.order.id, workTypeId: f.type.id, performedAt: new Date("2024-01-01T00:00:00.000Z"), observations: "old", batchIds: [f.batch.id], containerIds: [f.container.id], participants: [{ participantId: f.participant.id, role: "operator" }] }, context); ids.works.push(work.id);
    const newType = await service.create("work-types", { code: `P5-WT-${randomUUID()}`, name: "New" }, context); ids.workTypes.push(newType.id);
    const transformation = await service.createTransformationOrder({ code: `P5-T-${randomUUID()}`, productionOrderId: f.order.id, periodStart: new Date() }, context); ids.transformations.push(transformation.id);
    const corrections = [
      { field: "performedAt" as const, newValue: "2024-02-02T00:00:00.000Z" },
      { field: "workTypeId" as const, newValue: newType.id },
      { field: "transformationOrderId" as const, newValue: transformation.id },
      { field: "observations" as const, newValue: "new" },
    ];
    for (const correction of corrections) await service.correctWork(work.id, { ...correction, reason: "approved correction" }, context);
    const result = await service.getWork(work.id);
    assert.equal(result.observations, "new"); assert.equal(result.workTypeId, newType.id); assert.equal(result.transformationOrderId, transformation.id); assert.equal(result.performedAt, "2024-02-02T00:00:00.000Z");
    assert.equal(result.corrections.length, 4);
    assert.deepEqual(result.corrections.map(x => [x.fromVersion, x.toVersion]), [[0, 1], [1, 2], [2, 3], [3, 4]]);
    assert.deepEqual(result.corrections[0]?.previousValue, "2024-01-01T00:00:00.000Z");
    assert.deepEqual(result.corrections[0]?.newValue, "2024-02-02T00:00:00.000Z");
    assert.equal(result.corrections.every(x => x.actorUserId === actorUserId && x.reason === "approved correction"), true);
    assert.deepEqual(result.batchIds, [f.batch.id]); assert.deepEqual(result.containerIds, [f.container.id]); assert.deepEqual(result.participants, [{ participantId: f.participant.id, role: "operator" }]);
    await assert.rejects(service.correctWork(work.id, { field: "observations", newValue: null, reason: " " }, context), (e: any) => e.code === "INVALID_PRODUCTION_WORK");
    await assert.rejects(service.correctWork(work.id, { field: "workTypeId", newValue: randomUUID(), reason: "bad" }, context), (e: any) => e.code === "WORK_TYPE_NOT_FOUND");
  });

  it("rejects physical deletion of work history and rolls back failed audits", options, async () => {
    assert.ok(service && prisma);
    const f = await fixture();
    const failing = new ProductionWorkService(prisma, {} as AuditService, () => new AuditService({ create: async () => { throw new Error("audit failure"); } }));
    const before = await prisma.productionWork.count();
    await assert.rejects(failing.create({ productionOrderId: f.order.id, workTypeId: f.type.id, performedAt: new Date() }, context));
    assert.equal(await prisma.productionWork.count(), before);
    const work = await service.createWork({ productionOrderId: f.order.id, workTypeId: f.type.id, performedAt: new Date(), observations: "before", participants: [{ participantId: f.participant.id, role: "operator" }] }, context); ids.works.push(work.id);
    const correctionCount = await prisma.productionWorkCorrection.count({ where: { productionWorkId: work.id } });
    const versionBeforeCorrection = (await service.getWork(work.id)).version;
    await assert.rejects(new ProductionWorkService(prisma, {} as AuditService, () => new AuditService({ create: async () => { throw new Error("audit failure"); } })).correct(work.id, { field: "observations", newValue: "after", reason: "correction" }, context));
    assert.equal((await service.getWork(work.id)).observations, "before");
    assert.equal((await service.getWork(work.id)).version, versionBeforeCorrection);
    assert.equal(await prisma.productionWorkCorrection.count({ where: { productionWorkId: work.id } }), correctionCount);
    await assert.rejects(prisma.productionWork.delete({ where: { id: work.id } }));
    await assert.rejects(prisma.productionWorkParticipant.deleteMany({ where: { productionWorkId: work.id } }));
  });

  it("serializes concurrent corrections without losing history", options, async () => {
    assert.ok(service);
    const f = await fixture();
    const work = await service.createWork({ productionOrderId: f.order.id, workTypeId: f.type.id, performedAt: new Date(), observations: "initial" }, context); ids.works.push(work.id);
    const results = await Promise.all([service.correctWork(work.id, { field: "observations", newValue: "a", reason: "r1" }, context), service.correctWork(work.id, { field: "observations", newValue: "b", reason: "r2" }, context)]);
    assert.equal(results.length, 2);
    const after = await service.getWork(work.id);
    const chain = [...after.corrections].sort((a, b) => a.toVersion - b.toVersion);
    assert.deepEqual(chain.map(x => [x.fromVersion, x.toVersion]), [[0, 1], [1, 2]]);
    assert.deepEqual(chain[1]?.previousValue, chain[0]?.newValue);
    assert.equal(after.version, 2);
    assert.equal(after.observations, chain[1]?.newValue);
    assert.equal(new Set(after.corrections.map(x => x.toVersion)).size, 2);
  });

  it("enforces correction authorization for every direct business update", options, async () => {
    assert.ok(service && prisma);
    const f = await fixture();
    const work = await service.createWork({ productionOrderId: f.order.id, workTypeId: f.type.id, performedAt: new Date("2024-03-01T00:00:00.000Z"), observations: "guard", participants: [{ participantId: f.participant.id }] }, context); ids.works.push(work.id);
    for (const data of [
      { performedAt: new Date("2024-03-02T00:00:00.000Z") },
      { workTypeId: f.type.id },
      { transformationOrderId: null },
      { observations: "direct" },
      { productionOrderId: (await service.createOrder({ code: `P5-GUARD-${randomUUID()}`, startDate: new Date() }, context)).id },
      { createdByUserId: randomUUID() },
      { createdAt: new Date("2020-01-01T00:00:00.000Z") },
      { version: { increment: 1 } },
    ]) {
      await assert.rejects(prisma.productionWork.update({ where: { id: work.id }, data }));
    }
    await assert.rejects(prisma.$transaction(async tx => {
      const fake = await tx.productionWorkCorrection.create({ data: { productionWorkId: work.id, field: "observations", previousValue: "wrong", newValue: "fake", reason: "fake", correctedAt: new Date(), actorUserId, fromVersion: 0, toVersion: 1 } });
      await tx.$executeRaw`SELECT set_config('app.production_work_correction_id', ${fake.id}, true)`;
      await tx.productionWork.update({ where: { id: work.id }, data: { observations: "not-fake", version: { increment: 1 } } });
    }));
  });

  it("rejects orphan and reused version corrections", options, async () => {
    assert.ok(service && prisma);
    const f = await fixture();
    const work = await service.createWork({ productionOrderId: f.order.id, workTypeId: f.type.id, performedAt: new Date(), observations: "one" }, context); ids.works.push(work.id);
    const before = await prisma.productionWorkCorrection.count({ where: { productionWorkId: work.id } });
    await assert.rejects(prisma.$transaction(async tx => {
      await tx.productionWorkCorrection.create({ data: { productionWorkId: work.id, field: "observations", previousValue: "one", newValue: "two", reason: "orphan", correctedAt: new Date(), actorUserId, fromVersion: 0, toVersion: 1 } });
    }));
    assert.equal(await prisma.productionWorkCorrection.count({ where: { productionWorkId: work.id } }), before);
    await service.correctWork(work.id, { field: "observations", newValue: "two", reason: "first" }, context);
    await assert.rejects(prisma.$transaction(async tx => {
      await tx.productionWorkCorrection.create({ data: { productionWorkId: work.id, field: "observations", previousValue: "one", newValue: "two", reason: "reused", correctedAt: new Date(), actorUserId, fromVersion: 0, toVersion: 1 } });
    }));
    const after = await service.getWork(work.id);
    assert.equal(after.version, 1);
    assert.equal(after.corrections.length, 1);
  });

  it("serializes work creation against production-order close", options, async () => {
    assert.ok(service && prisma);
    const f = await fixture();
    const results = await Promise.allSettled([
      service.createWork({ productionOrderId: f.order.id, workTypeId: f.type.id, performedAt: new Date(), participants: [{ participantId: f.participant.id }] }, context),
      service.closeOrder(f.order.id, context),
    ]);
    const created = results.find(x => x.status === "fulfilled" && (x.value as any).productionOrderId === f.order.id) as PromiseFulfilledResult<any> | undefined;
    const rejected = results.find(x => x.status === "rejected") as PromiseRejectedResult | undefined;
    const order = await prisma.productionOrder.findUniqueOrThrow({ where: { id: f.order.id } });
    const works = await prisma.productionWork.count({ where: { productionOrderId: f.order.id } });
    assert.ok(works <= 1);
    if (created) {
      ids.works.push(created.value.id);
      assert.equal(created.value.productionOrderId, f.order.id);
      assert.ok(order.status === "OPEN" || order.status === "CLOSED");
    } else {
      assert.equal(order.status, "CLOSED");
      assert.equal(rejected?.reason?.code, "PRODUCTION_ORDER_CLOSED");
      assert.equal(works, 0);
    }
  });

  it("serializes linked work creation against transformation close", options, async () => {
    assert.ok(service && prisma);
    const f = await fixture();
    const transformation = await service.createTransformationOrder({ code: `P5-RACE-T-${randomUUID()}`, productionOrderId: f.order.id, periodStart: new Date() }, context); ids.transformations.push(transformation.id);
    const results = await Promise.allSettled([
      service.createWork({ productionOrderId: f.order.id, transformationOrderId: transformation.id, workTypeId: f.type.id, performedAt: new Date() }, context),
      service.closeTransformationOrder(transformation.id, context),
    ]);
    const created = results.find(x => x.status === "fulfilled" && (x.value as any).transformationOrderId === transformation.id) as PromiseFulfilledResult<any> | undefined;
    const rejected = results.find(x => x.status === "rejected") as PromiseRejectedResult | undefined;
    const current = await prisma.transformationOrder.findUniqueOrThrow({ where: { id: transformation.id } });
    const works = await prisma.productionWork.count({ where: { transformationOrderId: transformation.id } });
    assert.ok(works <= 1);
    if (created) { ids.works.push(created.value.id); assert.equal(created.value.transformationOrderId, transformation.id); assert.ok(current.status === "OPEN" || current.status === "CLOSED"); }
    else { assert.equal(current.status, "CLOSED"); assert.equal(rejected?.reason?.code, "TRANSFORMATION_ORDER_CLOSED"); assert.equal(works, 0); }
  });

  it("serializes work creation against WorkType deactivation", options, async () => {
    assert.ok(service && prisma);
    const f = await fixture();
    const results = await Promise.allSettled([
      service.createWork({ productionOrderId: f.order.id, workTypeId: f.type.id, performedAt: new Date() }, context),
      service.setActive("work-types", f.type.id, false, context),
    ]);
    const created = results.find(x => x.status === "fulfilled" && (x.value as any).workTypeId === f.type.id) as PromiseFulfilledResult<any> | undefined;
    const rejected = results.find(x => x.status === "rejected") as PromiseRejectedResult | undefined;
    const type = await prisma.workType.findUniqueOrThrow({ where: { id: f.type.id } });
    const works = await prisma.productionWork.count({ where: { workTypeId: f.type.id } });
    assert.ok(works <= 1);
    if (created) { ids.works.push(created.value.id); assert.equal(created.value.workTypeId, f.type.id); assert.equal(type.active, false); }
    else { assert.equal(type.active, false); assert.equal(rejected?.reason?.code, "WORK_TYPE_INACTIVE"); assert.equal(works, 0); }
  });

  it("serializes participant-linked creation against participant deactivation", options, async () => {
    assert.ok(service && prisma);
    const f = await fixture();
    const results = await Promise.allSettled([
      service.createWork({ productionOrderId: f.order.id, workTypeId: f.type.id, performedAt: new Date(), participants: [{ participantId: f.participant.id, role: "operator" }] }, context),
      service.setActive("participants", f.participant.id, false, context),
    ]);
    const created = results.find(x => x.status === "fulfilled" && (x.value as any).participants?.some((p: any) => p.participantId === f.participant.id)) as PromiseFulfilledResult<any> | undefined;
    const rejected = results.find(x => x.status === "rejected") as PromiseRejectedResult | undefined;
    const participant = await prisma.productionParticipant.findUniqueOrThrow({ where: { id: f.participant.id } });
    const works = await prisma.productionWorkParticipant.count({ where: { productionParticipantId: f.participant.id } });
    assert.ok(works <= 1);
    if (created) { ids.works.push(created.value.id); assert.equal(participant.active, false); }
    else { assert.equal(participant.active, false); assert.equal(rejected?.reason?.code, "PRODUCTION_PARTICIPANT_INACTIVE"); assert.equal(works, 0); }
  });
});