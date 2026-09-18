import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { AuditService } from "../src/core/audit/audit.service.js";
import { PrismaAuditRepository } from "../src/core/audit/prisma-audit.repository.js";
import { ProductionService } from "../src/modules/production/production.service.js";
import { BatchLineageService } from "../src/modules/production/production.batch.js";
import { Prisma } from "../src/generated/prisma/client.js";

const connectionString = process.env.P3_DATABASE_URL ?? process.env.WINTER_DATABASE_URL;
let available = false;
if (connectionString) {
  const probe = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await probe.$queryRaw`SELECT 1 FROM production_batch_operations LIMIT 1`;
    available = true;
  } catch {
    available = false;
  } finally {
    await probe.$disconnect();
  }
}
const integrationOptions = available ? {} : { skip: "requires P3_DATABASE_URL with the P3 migration applied" };
if (process.env.P3_DATABASE_URL && !available) throw new Error("P3_DATABASE_URL was supplied but the P3 migration/database is unavailable");

describe("Production P3 PostgreSQL", () => {
  const prisma = connectionString ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) }) : undefined;
  const actorUserId = randomUUID();
  const service = prisma ? new ProductionService(prisma, new AuditService(new PrismaAuditRepository(prisma))) : undefined;
  const context = { actorUserId, requestId: randomUUID() };
  let orderId = "";
  let secondOrderId = "";
  let batchId = "";

  before(async () => {
    if (!available || !prisma || !service) return;
    await prisma.user.create({ data: { id: actorUserId, firebaseUid: `p3-${actorUserId}`, email: `${actorUserId}@test.invalid`, status: "ACTIVE" } });
    const order = await service.createOrder({ code: `P3-${randomUUID()}`, startDate: new Date() }, context);
    const second = await service.createOrder({ code: `P3-SECOND-${randomUUID()}`, startDate: new Date() }, context);
    orderId = order.id;
    secondOrderId = second.id;
  });

  after(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it("creates a Decimal(18,3) batch and reconstructs its balance", integrationOptions, async () => {
    assert.ok(service);
    const created = await service.createBatch({ code: `B-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "KG", quantity: "10.125", operationKey: `create-${randomUUID()}`, requestHash: "create-v1" }, context);
    batchId = created.id;
    assert.equal(created.balance.generated, "10.125");
    assert.equal(created.balance.available, "10.125");
    assert.equal((await service.getBatchBalance(batchId)).available, "10.125");
    await prisma?.productionBatchBalance.update({ where: { productionBatchId: batchId }, data: { available: new Prisma.Decimal("99.999"), ledgerVersion: 0 } });
    assert.equal((await service.getBatchBalance(batchId)).available, "10.125");
  });

  it("supports partial consumption, retains zero history and rejects insufficient quantities atomically", integrationOptions, async () => {
    assert.ok(service && prisma);
    const consumed = await service.consumeBatch({ batchId, quantity: "2.125", unit: "KG", operationKey: `consume-${randomUUID()}`, requestHash: "consume-v1" }, context);
    assert.equal(consumed.available, "8.000");
    await assert.rejects(service.consumeBatch({ batchId, quantity: "8.001", unit: "KG", operationKey: `consume-${randomUUID()}`, requestHash: "too-much" }, context), (error: any) => error.code === "INSUFFICIENT_BATCH_QUANTITY");
    const afterRejected = await service.getBatchBalance(batchId);
    assert.equal(afterRejected.available, "8.000");
    const final = await service.consumeBatch({ batchId, quantity: "8.000", unit: "KG", operationKey: `consume-${randomUUID()}`, requestHash: "consume-v2" }, context);
    assert.equal(final.available, "0.000");
    assert.equal((await prisma.productionBatch.findUnique({ where: { id: batchId } }))?.id, batchId);
  });

  it("serializes same-key retries and rejects changed hashes/types", integrationOptions, async () => {
    assert.ok(service);
    const fresh = await service.createBatch({ code: `IDEMP-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "L", quantity: "3.000", operationKey: `create-${randomUUID()}`, requestHash: "create" }, context);
    const key = `same-${randomUUID()}`;
    const input = { batchId: fresh.id, quantity: "1.000", unit: "L", operationKey: key, requestHash: "same-request" };
    const results = await Promise.all([service.consumeBatch(input, context), service.consumeBatch(input, context)]);
    assert.deepEqual(results[0], results[1]);
    assert.equal((await service.getBatchBalance(fresh.id)).available, "2.000");
    await assert.rejects(service.consumeBatch({ ...input, requestHash: "changed" }, context), (error: any) => error.code === "IDEMPOTENCY_CONFLICT");
    await assert.rejects(service.createBatch({ code: `OTHER-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "L", quantity: "1.000", operationKey: key, requestHash: "same-request" }, context), (error: any) => error.code === "IDEMPOTENCY_CONFLICT");
  });

  it("serializes concurrent same-key creates and maps duplicate child/output codes", integrationOptions, async () => {
    assert.ok(service);
    const operationKey = `same-create-${randomUUID()}`;
    const createInput = { code: `SAME-CREATE-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "KG", quantity: "1.000", operationKey, requestHash: "same-create-v1" };
    const created = await Promise.all([service.createBatch(createInput, context), service.createBatch(createInput, context)]);
    assert.equal(created[0]!.id, created[1]!.id);
    const parent = await service.createBatch({ code: `DUP-PARENT-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "KG", quantity: "2.000", operationKey: `create-${randomUUID()}`, requestHash: "dup-parent" }, context);
    const childCode = `DUP-CHILD-${randomUUID()}`;
    await assert.rejects(service.splitBatch({ parentBatchId: parent.id, children: [{ code: childCode, quantity: "1.000" }, { code: childCode, quantity: "1.000" }], operationKey: `dup-split-${randomUUID()}`, requestHash: "dup-split" }, context), (error: any) => error.code === "PRODUCTION_CODE_ALREADY_EXISTS");
    await service.splitBatch({ parentBatchId: parent.id, children: [{ code: childCode, quantity: "1.000" }], operationKey: `dup-split-ok-${randomUUID()}`, requestHash: "dup-split-ok" }, context);
    await assert.rejects(service.createBatch({ code: childCode, productionOrderId: orderId, articuloId: parent.articuloId, unit: "KG", quantity: "1.000", operationKey: `dup-code-${randomUUID()}`, requestHash: "dup-code" }, context), (error: any) => error.code === "PRODUCTION_CODE_ALREADY_EXISTS");
    const secondParent = await service.createBatch({ code: `DUP-PARENT-2-${randomUUID()}`, productionOrderId: orderId, articuloId: parent.articuloId, unit: "KG", quantity: "1.000", operationKey: `create-${randomUUID()}`, requestHash: "dup-parent-2" }, context);
    await assert.rejects(service.splitBatch({ parentBatchId: secondParent.id, children: [{ code: childCode, quantity: "1.000" }], operationKey: `dup-output-${randomUUID()}`, requestHash: "dup-output" }, context), (error: any) => error.code === "PRODUCTION_CODE_ALREADY_EXISTS");
  });

  it("prevents concurrent consumers from oversubscribing", integrationOptions, async () => {
    assert.ok(service);
    const fresh = await service.createBatch({ code: `RACE-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "KG", quantity: "1.000", operationKey: `create-${randomUUID()}`, requestHash: "race" }, context);
    const results = await Promise.allSettled([
      service.consumeBatch({ batchId: fresh.id, quantity: "0.750", unit: "KG", operationKey: `race-${randomUUID()}`, requestHash: "a" }, context),
      service.consumeBatch({ batchId: fresh.id, quantity: "0.750", unit: "KG", operationKey: `race-${randomUUID()}`, requestHash: "b" }, context),
    ]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(results.filter(result => result.status === "rejected").length, 1);
    assert.equal((await service.getBatchBalance(fresh.id)).available, "0.250");
  });

  it("does not let a concurrent rebuild overwrite consumption", integrationOptions, async () => {
    assert.ok(service && prisma);
    const fresh = await service.createBatch({ code: `REBUILD-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "KG", quantity: "2.000", operationKey: `create-${randomUUID()}`, requestHash: "rebuild" }, context);
    const results = await Promise.all([
      service.getBatchBalance(fresh.id),
      service.consumeBatch({ batchId: fresh.id, quantity: "1.000", unit: "KG", operationKey: `rebuild-consume-${randomUUID()}`, requestHash: "rebuild-consume" }, context),
    ]);
    const balance = await service.getBatch(fresh.id);
    const ledgerCount = await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: fresh.id } });
    assert.equal(balance.balance.available, "1.000");
    assert.equal(balance.balance.ledgerVersion, ledgerCount);
    assert.ok(results.length === 2);
  });

  it("splits exactly and merges distinct parents from different production orders", integrationOptions, async () => {
    assert.ok(service);
    const first = await service.createBatch({ code: `SPLIT-${randomUUID()}`, productionOrderId: orderId, articuloId: "00000000-0000-4000-8000-000000000111", unit: "KG", quantity: "9.000", operationKey: `create-${randomUUID()}`, requestHash: "split" }, context);
    const split = await service.splitBatch({ parentBatchId: first.id, children: [{ code: `CHILD-A-${randomUUID()}`, quantity: "4.000" }, { code: `CHILD-B-${randomUUID()}`, quantity: "5.000" }], operationKey: `split-${randomUUID()}`, requestHash: "split-v1" }, context);
    assert.equal(split.parent.available, "0.000");
    assert.deepEqual(split.children.map(child => child.balance.available), ["4.000", "5.000"]);
    const second = await service.createBatch({ code: `MERGE-${randomUUID()}`, productionOrderId: secondOrderId, articuloId: "00000000-0000-4000-8000-000000000111", unit: "KG", quantity: "3.000", operationKey: `create-${randomUUID()}`, requestHash: "merge" }, context);
    const merged = await service.mergeBatches({ parentBatches: [{ batchId: split.children[0]!.id, quantity: "2.000" }, { batchId: second.id, quantity: "3.000" }], code: `MERGED-${randomUUID()}`, productionOrderId: orderId, articuloId: "00000000-0000-4000-8000-000000000111", unit: "KG", operationKey: `merge-${randomUUID()}`, requestHash: "merge-v1" }, context);
    assert.equal(merged.balance.generated, "5.000");
    assert.equal((await service.getBatchLineage(merged.id)).length, 2);
  });

  it("rejects unit mismatches, duplicate merge parents and invalid quantities", integrationOptions, async () => {
    assert.ok(service);
    await assert.rejects(service.consumeBatch({ batchId, quantity: "0.001", unit: "L", operationKey: `bad-${randomUUID()}`, requestHash: "bad" }, context), (error: any) => error.code === "INVALID_BATCH_TRANSFORMATION");
    await assert.rejects(service.consumeBatch({ batchId, quantity: "0", unit: "KG", operationKey: `bad-${randomUUID()}`, requestHash: "bad" }, context), (error: any) => error.code === "INVALID_BATCH_TRANSFORMATION");
    await assert.rejects(service.mergeBatches({ parentBatches: [{ batchId, quantity: "1.000" }, { batchId, quantity: "1.000" }], code: `BAD-MERGE-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "KG", operationKey: `bad-merge-${randomUUID()}`, requestHash: "bad" }, context), (error: any) => error.code === "INVALID_BATCH_TRANSFORMATION");
  });

  it("rejects opposing lineage edges and protects append-only facts", integrationOptions, async () => {
    assert.ok(service && prisma);
    const a = await service.createBatch({ code: `CYCLE-A-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "KG", quantity: "1.000", operationKey: `create-${randomUUID()}`, requestHash: "cycle-a" }, context);
    const b = await service.createBatch({ code: `CYCLE-B-${randomUUID()}`, productionOrderId: orderId, articuloId: a.articuloId, unit: "KG", quantity: "1.000", operationKey: `create-${randomUUID()}`, requestHash: "cycle-b" }, context);
    const edges = await Promise.allSettled([
      new BatchLineageService(prisma).create(a.id, b.id, new Prisma.Decimal("1.000"), "KG", `edge-${randomUUID()}`),
      new BatchLineageService(prisma).create(b.id, a.id, new Prisma.Decimal("1.000"), "KG", `edge-${randomUUID()}`),
    ]);
    assert.equal(edges.filter(edge => edge.status === "fulfilled").length, 1);
    assert.equal(edges.filter(edge => edge.status === "rejected" && (edge.reason as any).code === "INVALID_BATCH_TRANSFORMATION").length, 1);
    const persistedEdges = await prisma.productionBatchLineage.findMany({ where: { OR: [{ parentBatchId: a.id, childBatchId: b.id }, { parentBatchId: b.id, childBatchId: a.id }] } });
    assert.equal(persistedEdges.length, 1);
    const entry = await prisma.productionBatchLedgerEntry.findFirstOrThrow({ where: { productionBatchId: a.id } });
    await assert.rejects(prisma.productionBatchLedgerEntry.update({ where: { id: entry.id }, data: { quantity: new Prisma.Decimal("0.500") } }));
    await assert.rejects(prisma.productionBatchLedgerEntry.delete({ where: { id: entry.id } }));
  });
});