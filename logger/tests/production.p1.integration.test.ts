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
  const actorUserId = randomUUID();

  before(async () => {
    await prisma.user.create({
      data: { id: actorUserId, firebaseUid: `production-p1-${actorUserId}`, email: `${actorUserId}@test.invalid`, status: "ACTIVE" },
    });
  });

  after(async () => {
    await prisma.customFieldValue.deleteMany({ where: { definitionId: { in: createdDefinitionIds } } });
    await prisma.customFieldDefinition.deleteMany({ where: { id: { in: createdDefinitionIds } } });
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
});