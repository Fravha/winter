import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { AuditService } from "../src/core/audit/audit.service.js";
import { PrismaAuditRepository } from "../src/core/audit/prisma-audit.repository.js";
import { ArticuloService } from "../src/modules/articulos/articulo.service.js";
import { PrismaArticuloRepository } from "../src/modules/articulos/prisma-articulo.repository.js";
import { PrismaArticuloUnitOfWork } from "../src/modules/articulos/prisma-articulo.unit-of-work.js";
import { ProductionService } from "../src/modules/production/production.service.js";
import { ProductionReceptionService } from "../src/modules/production/production.reception.js";
import { createInitialBatchInTransaction } from "../src/modules/production/production.batch.js";
import { createTemporaryProductionDatabaseResource } from "./helpers/production-test-database.js";
const database = createTemporaryProductionDatabaseResource("P6_DATABASE_URL", connectionString => ({ connectionString, createClient: () => new PrismaClient({ adapter: new PrismaPg({ connectionString }) }) }));
const prisma = database?.createClient();
let available = false;
if (prisma) { try { await prisma.$queryRaw`SELECT 1 FROM grape_receptions LIMIT 1`; available = true; } catch { available = false; } }
if (database && !available) throw new Error("P6_DATABASE_URL was supplied but the P6 migration/database is unavailable");
const options = available ? {} : { skip: "requires P6_DATABASE_URL with P6 migration applied" };
after(async () => { if (prisma) await prisma.$disconnect(); });
describe("Production P6 PostgreSQL", () => {
  const actor = randomUUID();
  const context = { actorUserId: actor, requestId: randomUUID() };
  const service = prisma ? new ProductionService(prisma, new AuditService(new PrismaAuditRepository(prisma)), new ArticuloService(new PrismaArticuloRepository(prisma), new PrismaArticuloUnitOfWork(prisma))) : undefined;
  async function fixture() {
    assert.ok(prisma && service);
    const order = await service.createOrder({ code: `P6-F-${randomUUID()}`, startDate: new Date("2025-01-01T00:00:00.000Z") }, context);
    const variety = await service.create("grape-varieties", { code: `P6-V-${randomUUID()}`, name: "Variety" }, context);
    const articulo = await new ArticuloService(new PrismaArticuloRepository(prisma), new PrismaArticuloUnitOfWork(prisma)).createArticulo({ codigo: `P6-A-${randomUUID()}`, nombre: "Grape", clasificacion: "MATERIA_PRIMA", unidadMedida: "KG" }, context);
    return { order, variety, articulo };
  }
  it("creates one item, P3 balance/ledger, traceability and audit", options, async () => {
    assert.ok(prisma && service);
    await prisma.user.create({ data: { id: actor, firebaseUid: `p6-${actor}`, email: `${actor}@test.invalid`, status: "ACTIVE" } });
    const order = await service.createOrder({ code: `P6-${randomUUID()}`, startDate: new Date() }, context);
    const variety = await service.create("grape-varieties", { code: `P6-V-${randomUUID()}`, name: "Cabernet" }, context);
    const articulo = await new ArticuloService(new PrismaArticuloRepository(prisma), new PrismaArticuloUnitOfWork(prisma)).createArticulo({ codigo: `P6-A-${randomUUID()}`, nombre: "Uva", clasificacion: "MATERIA_PRIMA", unidadMedida: "KG" }, context);
    const result = await service.createReception({ productionOrderId: order.id, receivedAt: new Date(), status: "ACCEPTED", items: [{ grapeVarietyId: variety.id, articuloId: articulo.id, quantity: "1.234", unit: "KG" }], operationKey: `p6-${randomUUID()}`, requestHash: "request" }, context);
    assert.equal(result.items.length, 1);
    assert.equal(result.batchIds.length, 1);
    const batch = await prisma.productionBatch.findUniqueOrThrow({ where: { id: result.batchIds[0] } });
    assert.equal((await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: batch.id } })), 1);
    assert.equal((await prisma.productionBatchBalance.findUniqueOrThrow({ where: { productionBatchId: batch.id } })).available.toFixed(3), "1.234");
    assert.equal((await prisma.grapeReceptionItem.findUniqueOrThrow({ where: { productionBatchId: batch.id } })).receptionId, (result.reception as any).id);
    assert.equal(await prisma.auditLog.count({ where: { action: "GRAPE_RECEPTION_CREATED", actorUserId: actor } }), 1);
    assert.equal(await prisma.inventoryMovement.count({ where: { actorUserId: actor } }), 0);
    const listed = await service.listReceptions();
    assert.equal(typeof listed.items[0]?.receivedAt, "string");
    assert.equal(typeof listed.items[0]?.createdAt, "string");
    assert.equal(typeof listed.items[0]?.items[0]?.quantity, "string");
    const listedReception = listed.items.find(item => item.id === (result.reception as any).id);
    const loadedReception = await service.getReception((result.reception as any).id) as any;
    const { corrections: _corrections, customFields: _customFields, ...loadedReceptionSummary } = loadedReception;
    assert.deepEqual(loadedReceptionSummary, listedReception);
    const detail = loadedReception;
    assert.equal(typeof detail.items[0].id, "string");
    assert.equal(detail.items[0].productionBatchId, result.batchIds[0]);
    assert.deepEqual(detail.customFields, []);
    assert.equal(await service.getReception(randomUUID()), null);
  });
  it("replays exact idempotent result and rejects changed request", options, async () => {
    assert.ok(service);
    const { order, variety, articulo } = await fixture();
    const key = `p6-retry-${randomUUID()}`;
    const input = { productionOrderId: order.id, receivedAt: new Date(), status: "ACCEPTED" as const, items: [{ grapeVarietyId: variety.id, articuloId: articulo.id, quantity: "1.000", unit: "KG" }], operationKey: key, requestHash: "h" };
    const first = await service.createReception(input, context);
    const retry = await service.createReception(input, context);
    assert.deepEqual(retry, first);
    const retryWithDifferentClaimedHash = await service.createReception({ ...input, requestHash: "changed" }, context);
    assert.deepEqual(retryWithDifferentClaimedHash, first);
    await assert.rejects(
      service.createReception({
        ...input,
        requestHash: "h",
        items: [{ ...input.items[0], quantity: "2.000" }],
      }, context),
      (error: any) => error.code === "IDEMPOTENCY_CONFLICT",
    );
    const concurrent = await Promise.all([service.createReception({ ...input, operationKey: `${key}-concurrent` }, context), service.createReception({ ...input, operationKey: `${key}-concurrent` }, context)]);
    assert.deepEqual(concurrent[0], concurrent[1]);
    assert.equal(await prisma.grapeReceptionOperation.count({ where: { operationKey: `${key}-concurrent` } }), 1);
    assert.equal(await prisma.grapeReception.count({ where: { id: (concurrent[0].reception as any).id } }), 1);
  });
  it("creates multiple varieties with one distinct batch per item and exact decimals", options, async () => {
    assert.ok(prisma && service);
    const f = await fixture();
    const second = await service.create("grape-varieties", { code: `P6-V-${randomUUID()}`, name: "Second" }, context);
    const result = await service.createReception({ productionOrderId: f.order.id, receivedAt: new Date("2025-02-03T04:05:06.000Z"), status: "ACCEPTED_WITH_OBSERVATIONS", observations: "arrival", items: [{ grapeVarietyId: f.variety.id, articuloId: f.articulo.id, quantity: "1.234", unit: "KG" }, { grapeVarietyId: second.id, articuloId: f.articulo.id, quantity: "2.000", unit: "KG" }], operationKey: `p6-many-${randomUUID()}`, requestHash: "many" }, context);
    assert.equal(new Set(result.batchIds).size, 2);
    for (const batchId of result.batchIds) {
      const item = await prisma.grapeReceptionItem.findUniqueOrThrow({ where: { productionBatchId: batchId } });
      assert.equal(item.receptionId, (result.reception as any).id);
      assert.equal((await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: batchId } })), 1);
      assert.equal((await prisma.productionBatchBalance.findUniqueOrThrow({ where: { productionBatchId: batchId } })).available.toFixed(3), item.quantity.toFixed(3));
    }
    assert.equal(await prisma.inventoryMovement.count({ where: { actorUserId: actor } }), 0);
  });
  it("rejects missing/closed order, inactive references and invalid quantity/unit", options, async () => {
    assert.ok(service && prisma);
    const f = await fixture();
    const base = { productionOrderId: f.order.id, receivedAt: new Date(), status: "ACCEPTED" as const, items: [{ grapeVarietyId: f.variety.id, articuloId: f.articulo.id, quantity: "1.000", unit: "KG" as const }], operationKey: `p6-invalid-${randomUUID()}`, requestHash: "invalid" };
    for (const quantity of ["0", "-1", "1.2345"]) await assert.rejects(service.createReception({ ...base, items: [{ ...base.items[0], quantity }] }, context), (e: any) => e.code === "INVALID_QUANTITY");
    await assert.rejects(service.createReception({ ...base, items: [{ ...base.items[0], unit: "L" }] }, context), (e: any) => e.code === "INVALID_UNIT");
    await assert.rejects(service.createReception({ ...base, productionOrderId: randomUUID() }, context), (e: any) => e.code === "PRODUCTION_ORDER_NOT_FOUND");
    await assert.rejects(service.createReception({ ...base, producerId: randomUUID(), operationKey: `${base.operationKey}-missing-producer` }, context), (e: any) => e.code === "PRODUCER_NOT_FOUND");
    await assert.rejects(service.createReception({ ...base, items: [{ ...base.items[0], grapeVarietyId: randomUUID() }], operationKey: `${base.operationKey}-missing-variety` }, context), (e: any) => e.code === "GRAPE_VARIETY_NOT_FOUND");
    await assert.rejects(service.createReception({ ...base, items: [{ ...base.items[0], articuloId: randomUUID() }], operationKey: `${base.operationKey}-missing-articulo` }, context), (e: any) => e.code === "ARTICULO_NOT_FOUND");
    await service.closeOrder(f.order.id, context);
    await assert.rejects(service.createReception({ ...base, operationKey: `${base.operationKey}-closed` }, context), (e: any) => e.code === "PRODUCTION_ORDER_CLOSED");
  });
  it("validates producer/variety/article active state and custom fields atomically", options, async () => {
    assert.ok(prisma && service);
    const f = await fixture();
    const producer = await service.create("producers", { code: `P6-P-${randomUUID()}`, name: "Grower" }, context);
    const required = await service.createDefinition({ entityType: "GRAPE_RECEPTION", code: `required_${randomUUID().replaceAll("-", "")}`, label: "Required", dataType: "TEXT", required: true, active: true, displayOrder: 0 }, context);
    const booleanField = await service.createDefinition({ entityType: "GRAPE_RECEPTION", code: `bool_${randomUUID().replaceAll("-", "")}`, label: "Bool", dataType: "BOOLEAN", required: false, active: true, displayOrder: 1 }, context);
    const input = { productionOrderId: f.order.id, producerId: producer.id, receivedAt: new Date(), status: "ACCEPTED" as const, items: [{ grapeVarietyId: f.variety.id, articuloId: f.articulo.id, quantity: "3.210", unit: "KG" as const }], operationKey: `p6-custom-${randomUUID()}`, requestHash: "custom" };
    await assert.rejects(service.createReception(input, context), (e: any) => e.code === "CUSTOM_FIELD_REQUIRED");
    assert.equal(await prisma.grapeReception.count({ where: { productionOrderId: f.order.id } }), 0);
    const created = await service.createReception({ ...input, customFields: [{ definitionId: required.id, value: "dock-a" }, { definitionId: booleanField.id, value: true }] }, context);
    assert.equal(await prisma.customFieldValue.count({ where: { entityId: (created.reception as any).id } }), 2);
    const detail = await service.getReception((created.reception as any).id) as any;
    assert.deepEqual(detail.customFields.map((field: any) => ({ definitionId: field.definitionId, entityType: field.entityType, value: field.value })).sort((a: any, b: any) => a.definitionId.localeCompare(b.definitionId)), [
      { definitionId: booleanField.id, entityType: "GRAPE_RECEPTION", value: true },
      { definitionId: required.id, entityType: "GRAPE_RECEPTION", value: "dock-a" },
    ].sort((a, b) => a.definitionId.localeCompare(b.definitionId)));
    await service.setDefinitionActive(booleanField.id, false, context);
    await assert.rejects(service.createReception({ ...input, operationKey: `${input.operationKey}-inactive`, customFields: [{ definitionId: required.id, value: "dock-b" }, { definitionId: booleanField.id, value: true }] }, context), (e: any) => e.code === "CUSTOM_FIELD_DEFINITION_INACTIVE");
    await assert.rejects(service.createReception({ ...input, operationKey: `${input.operationKey}-wrong`, customFields: [{ definitionId: required.id, value: 99 }] }, context), (e: any) => e.code === "CUSTOM_FIELD_VALUE_INVALID");
    await service.setActive("producers", producer.id, false, context);
    const validCustom = { customFields: [{ definitionId: required.id, value: "dock-c" }] };
    await assert.rejects(service.createReception({ ...input, ...validCustom, operationKey: `${input.operationKey}-producer` }, context), (e: any) => e.code === "PRODUCER_INACTIVE");
    await service.setActive("producers", producer.id, true, context);
    await service.setActive("grape-varieties", f.variety.id, false, context);
    await assert.rejects(service.createReception({ ...input, ...validCustom, operationKey: `${input.operationKey}-variety` }, context), (e: any) => e.code === "GRAPE_VARIETY_INACTIVE");
    await service.setActive("grape-varieties", f.variety.id, true, context);
    await new ArticuloService(new PrismaArticuloRepository(prisma), new PrismaArticuloUnitOfWork(prisma)).deactivateArticulo(f.articulo.id, context);
    await assert.rejects(service.createReception({ ...input, ...validCustom, operationKey: `${input.operationKey}-article` }, context), (e: any) => e.code === "ARTICULO_INACTIVE");
    await service.setDefinitionActive(required.id, false, context);
  });
  it("rejects direct reception history updates and deletes", options, async () => {
    assert.ok(prisma && service);
    const f = await fixture();
    const receptionDefinition = await service.createDefinition({
      entityType: "GRAPE_RECEPTION",
      code: `guard_${randomUUID().replaceAll("-", "")}`,
      label: "Guarded reception field",
      dataType: "TEXT",
      required: false,
      active: true,
      displayOrder: 0,
    }, context);
    const result = await service.createReception({
      productionOrderId: f.order.id,
      receivedAt: new Date(),
      status: "ACCEPTED",
      items: [{ grapeVarietyId: f.variety.id, articuloId: f.articulo.id, quantity: "1.000", unit: "KG" }],
      customFields: [{ definitionId: receptionDefinition.id, value: "original" }],
      operationKey: `p6-guard-${randomUUID()}`,
      requestHash: "guard",
    }, context);
    const receptionId = (result.reception as any).id;
    const item = await prisma.grapeReceptionItem.findFirstOrThrow({ where: { receptionId } });
    const operation = await prisma.grapeReceptionOperation.findFirstOrThrow({ where: { receptionId } });
    const receptionCustomValue = await prisma.customFieldValue.findFirstOrThrow({ where: { entityId: receptionId } });
    await assert.rejects(prisma.grapeReception.update({ where: { id: receptionId }, data: { observations: "mutated" } }));
    await assert.rejects(prisma.grapeReceptionItem.delete({ where: { id: item.id } }));
    await assert.rejects(prisma.grapeReceptionOperation.delete({ where: { id: operation.id } }));
    await assert.rejects(prisma.customFieldValue.update({ where: { id: receptionCustomValue.id }, data: { textValue: "mutated" } }));
    await assert.rejects(prisma.customFieldValue.delete({ where: { id: receptionCustomValue.id } }));

    const producer = await service.create("producers", { code: `P6-P-${randomUUID()}`, name: "Mutable producer" }, context);
    const producerDefinition = await service.createDefinition({
      entityType: "PRODUCER",
      code: `mutable_${randomUUID().replaceAll("-", "")}`,
      label: "Mutable producer field",
      dataType: "TEXT",
      required: false,
      active: true,
      displayOrder: 0,
    }, context);
    const producerValue = await service.setValue({
      definitionId: producerDefinition.id,
      entityType: "PRODUCER",
      entityId: producer.id,
      value: "before",
    }, context);
    await prisma.customFieldValue.update({ where: { id: producerValue.id }, data: { textValue: "after" } });
    assert.equal((await prisma.customFieldValue.findUniqueOrThrow({ where: { id: producerValue.id } })).textValue, "after");
    await prisma.customFieldValue.delete({ where: { id: producerValue.id } });
    assert.equal(await prisma.customFieldValue.findUnique({ where: { id: producerValue.id } }), null);
  });
  it("rolls back all facts when the second batch or audit fails", options, async () => {
    assert.ok(prisma && service);
    const f = await fixture();
    const second = await service.create("grape-varieties", { code: `P6-V-${randomUUID()}`, name: "Second" }, context);
    const before = { receptions: await prisma.grapeReception.count(), batches: await prisma.productionBatch.count(), audits: await prisma.auditLog.count() };
    const input = { productionOrderId: f.order.id, receivedAt: new Date(), status: "ACCEPTED" as const, items: [{ grapeVarietyId: f.variety.id, articuloId: f.articulo.id, quantity: "1.000", unit: "KG" }, { grapeVarietyId: second.id, articuloId: f.articulo.id, quantity: "2.000", unit: "KG" }], operationKey: `p6-fail-${randomUUID()}`, requestHash: "fail" };
    const api = new ArticuloService(new PrismaArticuloRepository(prisma), new PrismaArticuloUnitOfWork(prisma));
    let count = 0;
    const failingBatch = new ProductionReceptionService(prisma, api, { createBatch: async (...args) => { count++; if (count === 2) throw new Error("batch failure"); return createInitialBatchInTransaction(...args); } });
    await assert.rejects(failingBatch.create(input, context));
    assert.deepEqual({ receptions: await prisma.grapeReception.count(), batches: await prisma.productionBatch.count(), audits: await prisma.auditLog.count() }, before);
    const failingAudit = new ProductionReceptionService(prisma, api, { recordAudit: async () => { throw new Error("audit failure"); } });
    await assert.rejects(failingAudit.create({ ...input, operationKey: `${input.operationKey}-audit` }, context));
    assert.equal(await prisma.grapeReceptionOperation.count({ where: { operationKey: `${input.operationKey}-audit` } }), 0);
    assert.equal(await prisma.grapeReception.count({ where: { productionOrderId: f.order.id } }), 0);
  });
  it("serializes reception against ProductionOrder close", options, async () => {
    assert.ok(prisma && service);
    const f = await fixture();
    const input = { productionOrderId: f.order.id, receivedAt: new Date(), status: "ACCEPTED" as const, items: [{ grapeVarietyId: f.variety.id, articuloId: f.articulo.id, quantity: "1.000", unit: "KG" }], operationKey: `p6-race-${randomUUID()}`, requestHash: "race" };
    const results = await Promise.allSettled([service.createReception(input, context), service.closeOrder(f.order.id, context)]);
    const order = await prisma.productionOrder.findUniqueOrThrow({ where: { id: f.order.id } });
    const receptionCount = await prisma.grapeReception.count({ where: { productionOrderId: f.order.id } });
    assert.ok(receptionCount === 0 || receptionCount === 1);
    if (receptionCount === 1) assert.equal(order.status, "CLOSED");
    const rejection = results.find(result => result.status === "rejected") as PromiseRejectedResult | undefined;
    if (receptionCount === 0) assert.equal(rejection?.reason?.code, "PRODUCTION_ORDER_CLOSED");
  });
});