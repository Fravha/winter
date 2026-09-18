import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { AuditService } from "../src/core/audit/audit.service.js";
import { PrismaAuditRepository } from "../src/core/audit/prisma-audit.repository.js";
import { ProductionService } from "../src/modules/production/production.service.js";
import { after, before, describe, it } from "node:test";

const connectionString = process.env.WINTER_DATABASE_URL;
let available = false;
if (connectionString) {
  const probe = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await probe.$queryRaw`SELECT 1 FROM production_producers LIMIT 1`;
    available = true;
  } catch {
    available = false;
  } finally {
    await probe.$disconnect();
  }
}

(available ? describe : describe.skip)("Production P1 PostgreSQL integration (skipped without WINTER_DATABASE_URL/schema)", () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString! }) });
  const audit = new AuditService(new PrismaAuditRepository(prisma));
  const service = new ProductionService(prisma, audit);
  const createdProducerIds: string[] = [];
  const createdDefinitionIds: string[] = [];
  const createdWorkTypeIds: string[] = [];
  const createdMeasurementTypeIds: string[] = [];
  const actorUserId = randomUUID();

  before(async () => {
    await prisma.user.create({
      data: { id: actorUserId, firebaseUid: `production-p1-${actorUserId}`, email: `${actorUserId}@test.invalid`, status: "ACTIVE" },
    });
  });

  after(async () => {
    await prisma.customFieldValue.deleteMany({ where: { definitionId: { in: createdDefinitionIds } } });
    await prisma.customFieldDefinition.deleteMany({ where: { id: { in: createdDefinitionIds } } });
    await prisma.workType.deleteMany({ where: { id: { in: createdWorkTypeIds } } });
    await prisma.measurementType.deleteMany({ where: { id: { in: createdMeasurementTypeIds } } });
    await prisma.producer.deleteMany({ where: { id: { in: createdProducerIds } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId } });
    await prisma.user.delete({ where: { id: actorUserId } });
    await prisma.$disconnect();
  });

  it("applies uniqueness, foreign key and exactly-one-value constraints", async () => {
    const producer = await prisma.producer.create({ data: { code: `P1-${randomUUID()}`, name: "P1 integration" } });
    createdProducerIds.push(producer.id);
    const definition = await prisma.customFieldDefinition.create({
      data: { entityType: "PRODUCER", code: `FIELD-${randomUUID()}`, label: "Field", dataType: "TEXT", createdByUserId: actorUserId },
    });
    createdDefinitionIds.push(definition.id);
    await assert.rejects(() => prisma.customFieldValue.create({
      data: { definitionId: definition.id, entityType: "PRODUCER", entityId: producer.id },
    }));
    await assert.rejects(() => prisma.customFieldValue.create({
      data: { definitionId: definition.id, entityType: "PRODUCER", entityId: producer.id, textValue: "a", integerValue: 1 },
    }));
    await prisma.customFieldValue.create({ data: { definitionId: definition.id, entityType: "PRODUCER", entityId: producer.id, textValue: "a" } });
    await assert.rejects(() => prisma.customFieldValue.create({ data: { definitionId: definition.id, entityType: "PRODUCER", entityId: producer.id, textValue: "b" } }));
  });

  it("rolls back catalog write when transactional audit fails", async () => {
    const code = `ROLLBACK-${randomUUID()}`;
    await assert.rejects(() => service.create("producers", { code, name: "Must rollback" }, { actorUserId: randomUUID(), requestId: randomUUID() }));
    assert.equal(await prisma.producer.count({ where: { code } }), 0);
  });

  it("persists, uniquely identifies and logically deactivates work and measurement types", async () => {
    const workCode = `WORK-${randomUUID()}`;
    const measurementCode = `MEASUREMENT-${randomUUID()}`;
    const context = { actorUserId, requestId: randomUUID() };
    const work = await service.create("work-types", { code: workCode, name: "Work type" }, context);
    const measurement = await service.create("measurement-types", { code: measurementCode, name: "Measurement type" }, context);
    createdWorkTypeIds.push(work.id);
    createdMeasurementTypeIds.push(measurement.id);

    await assert.rejects(() => service.create("work-types", { code: workCode, name: "Duplicate" }, context));
    await assert.rejects(() => service.create("measurement-types", { code: measurementCode, name: "Duplicate" }, context));

    const renamedWork = await service.update("work-types", work.id, { name: "Renamed work type" }, context);
    const renamedMeasurement = await service.update("measurement-types", measurement.id, { name: "Renamed measurement type" }, context);
    assert.equal(renamedWork.code, workCode);
    assert.equal(renamedMeasurement.code, measurementCode);

    await service.setActive("work-types", work.id, false, context);
    await service.setActive("measurement-types", measurement.id, false, context);
    assert.equal((await prisma.workType.findUniqueOrThrow({ where: { id: work.id } })).active, false);
    assert.equal((await prisma.measurementType.findUniqueOrThrow({ where: { id: measurement.id } })).active, false);
  });

  it("rolls back work and measurement type writes when transactional audit fails", async () => {
    for (const kind of ["work-types", "measurement-types"] as const) {
      const code = `ROLLBACK-${kind}-${randomUUID()}`;
      await assert.rejects(() => service.create(kind, { code, name: "Must rollback" }, {
        actorUserId: randomUUID(),
        requestId: randomUUID(),
      }));
      const count = kind === "work-types"
        ? await prisma.workType.count({ where: { code } })
        : await prisma.measurementType.count({ where: { code } });
      assert.equal(count, 0);
    }
  });
});