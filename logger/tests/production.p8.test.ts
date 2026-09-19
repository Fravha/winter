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
import { ProductionTransformationService } from "../src/modules/production/production.transformation.js";
import { createTemporaryProductionDatabaseResource } from "./helpers/production-test-database.js";

const database = createTemporaryProductionDatabaseResource("P8_DATABASE_URL", connectionString => ({ connectionString, createClient: () => new PrismaClient({ adapter: new PrismaPg({ connectionString }) }) }));
const prisma = database?.createClient();
let available = false;
if (prisma) { try { await prisma.$queryRaw`SELECT 1 FROM transformations LIMIT 1`; available = true; } catch { available = false; } }
if (database && !available) throw new Error("P8_DATABASE_URL was supplied but the P8 migration/database is unavailable");
const options = available ? {} : { skip: "requires P8_DATABASE_URL with P8 migration applied" };

describe("Production P8 PostgreSQL", () => {
  const actor = randomUUID();
  const context = { actorUserId: actor, requestId: randomUUID() };
  const articles = prisma ? new ArticuloService(new PrismaArticuloRepository(prisma), new PrismaArticuloUnitOfWork(prisma)) : undefined;
  const service = prisma && articles ? new ProductionService(prisma, new AuditService(new PrismaAuditRepository(prisma)), articles) : undefined;
  before(async () => { if (prisma) await prisma.user.create({ data: { id: actor, firebaseUid: `p8-${actor}`, email: `${actor}@test.invalid`, status: "ACTIVE" } }); });
  after(async () => { await prisma?.$disconnect(); });

  async function fixture(quantity = "20.000") {
    assert.ok(prisma && service && articles);
    const order = await service.createOrder({ code: `P8-O-${randomUUID()}`, startDate: new Date() }, context);
    const raw = await articles.createArticulo({ codigo: `P8-A-${randomUUID()}`, nombre: "Raw", clasificacion: "MATERIA_PRIMA", unidadMedida: "KG" }, context);
    const output = await articles.createArticulo({ codigo: `P8-A-${randomUUID()}`, nombre: "Output", clasificacion: "PRODUCTO_PROCESO", unidadMedida: "KG" }, context);
    const input = await service.createBatch({ code: `P8-B-${randomUUID()}`, productionOrderId: order.id, articuloId: raw.id, unit: "KG", quantity, operationKey: `p8-b-${randomUUID()}`, requestHash: "fixture" }, context);
    return { order, raw, output, input };
  }
  const command = (f: Awaited<ReturnType<typeof fixture>>, overrides: Record<string, unknown> = {}) => ({
    productionOrderId: f.order.id, performedAt: new Date("2026-01-02T03:04:05Z"), operationKey: `p8-${randomUUID()}`, requestHash: "canonical",
    inputs: [{ productionBatchId: f.input.id, quantity: "2.000" }], outputs: [{ articuloId: f.output.id, quantity: "1.000", unit: "KG" }], ...overrides,
  });

  it("covers 1->1, 1->many, many->1, many->many, partial/full consumption, remanent, lineage and inventory isolation", options, async () => {
    assert.ok(prisma && service && articles);
    const f = await fixture("40.000");
    const one = await service.createTransformation(command(f), context);
    assert.equal(one.inputs.length, 1); assert.equal(one.outputs.length, 1);
    const oneBalance = await prisma.productionBatchBalance.findUniqueOrThrow({ where: { productionBatchId: f.input.id } });
    assert.equal(oneBalance.available.toFixed(3), "38.000");
    const manyOut = await service.createTransformation(command(f, { inputs: [{ productionBatchId: f.input.id, quantity: "2.000" }], outputs: [{ articuloId: f.output.id, quantity: "1.000", unit: "KG" }, { articuloId: f.output.id, quantity: "1.000", unit: "KG" }] }), context);
    assert.equal(manyOut.outputs.length, 2);
    const second = await fixture("10.000");
    const secondArticle = await articles.createArticulo({ codigo: `P8-A-${randomUUID()}`, nombre: "Second", clasificacion: "MATERIA_PRIMA", unidadMedida: "KG" }, context);
    const secondBatch = await service.createBatch({ code: `P8-B-${randomUUID()}`, productionOrderId: second.order.id, articuloId: secondArticle.id, unit: "KG", quantity: "5.000", operationKey: `p8-b-${randomUUID()}`, requestHash: "fixture" }, context);
    const manyIn = await service.createTransformation(command(second, { inputs: [{ productionBatchId: second.input.id, quantity: "2.000" }, { productionBatchId: secondBatch.id, quantity: "2.000" }] }), context);
    assert.equal(manyIn.inputs.length, 2); assert.equal(manyIn.outputs.length, 1);
    const manyBoth = await service.createTransformation(command(second, { inputs: [{ productionBatchId: second.input.id, quantity: "1.000" }, { productionBatchId: secondBatch.id, quantity: "1.000" }], outputs: [{ articuloId: second.output.id, quantity: "0.500", unit: "KG" }, { articuloId: second.output.id, quantity: "0.500", unit: "KG" }] }), context);
    assert.equal(manyBoth.inputs.length, 2); assert.equal(manyBoth.outputs.length, 2);
    const lineages = await prisma.productionBatchLineage.findMany({ where: { childBatchId: { in: manyBoth.outputs.map(x => x.productionBatchId) } } });
    assert.equal(lineages.length, 4);
    assert.equal(await prisma.inventoryMovement.count({ where: { actorUserId: actor } }), 0);
  });

  it("records known, unknown and multiple explicit losses without negative balances", options, async () => {
    assert.ok(prisma && service);
    const f = await fixture("10.000");
    const result = await service.createTransformation(command(f, { losses: [{ productionBatchId: f.input.id, quantity: "1.000", unit: "KG" }, { quantity: "0.500", unit: "KG" }, { quantity: "0.250", unit: "KG" }] }), context);
    assert.equal(result.losses.length, 3);
    assert.equal(await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: f.input.id, entryType: "LOSS" } }), 1);
    assert.equal((await prisma.productionBatchBalance.findUniqueOrThrow({ where: { productionBatchId: f.input.id } })).available.toFixed(3), "7.000");
    assert.equal(await prisma.inventoryMovement.count({ where: { actorUserId: actor } }), 0);
  });

  it("rejects insufficient/missing batches, closed contexts, incompatible work, invalid/inactive articles and units", options, async () => {
    assert.ok(prisma && service && articles);
    const f = await fixture("1.000");
    await assert.rejects(service.createTransformation(command(f, { inputs: [{ productionBatchId: f.input.id, quantity: "2.000" }] }), context), (e: any) => e.code === "INSUFFICIENT_BATCH_QUANTITY");
    await assert.rejects(service.createTransformation(command(f, { inputs: [{ productionBatchId: randomUUID(), quantity: "1.000" }] }), context), (e: any) => e.code === "BATCH_NOT_FOUND");
    await service.closeOrder(f.order.id, context);
    await assert.rejects(service.createTransformation(command(f), context), (e: any) => e.code === "PRODUCTION_ORDER_CLOSED");
    const g = await fixture();
    const tOrder = await service.createTransformationOrder({ code: `P8-T-${randomUUID()}`, productionOrderId: g.order.id, periodStart: new Date() }, context);
    await service.closeTransformationOrder(tOrder.id, context);
    await assert.rejects(service.createTransformation(command(g, { transformationOrderId: tOrder.id }), context), (e: any) => e.code === "TRANSFORMATION_ORDER_CLOSED");
    const other = await fixture();
    const wt = await service.create("work-types", { code: `P8-W-${randomUUID()}`, name: "Work" }, context);
    const work = await service.createWork({ productionOrderId: other.order.id, workTypeId: wt.id, performedAt: new Date() }, context);
    await assert.rejects(service.createTransformation(command(g, { productionWorkId: work.id }), context), (e: any) => e.code === "PRODUCTION_WORK_MISMATCH");
    await assert.rejects(service.createTransformation(command(g, { outputs: [{ articuloId: randomUUID(), quantity: "1.000", unit: "KG" }] }), context), (e: any) => e.code === "ARTICULO_INVALID");
    await articles.deactivateArticulo(g.output.id, context);
    await assert.rejects(service.createTransformation(command(g), context), (e: any) => e.code === "ARTICULO_INVALID");
    await assert.rejects(service.createTransformation(command(g, { outputs: [{ articuloId: g.raw.id, quantity: "1.000", unit: "L" }] }), context), (e: any) => e.code === "UNIT_INCOMPATIBLE");
  });

  it("replays idempotently, rejects conflicts, serializes concurrent consumption and preserves rollback", options, async () => {
    assert.ok(prisma && service && articles);
    const f = await fixture("5.000");
    const input = command(f);
    const first = await service.createTransformation(input, context);
    assert.deepEqual(await service.createTransformation(input, context), first);
    assert.deepEqual(await service.createTransformation({ ...input, requestHash: "caller-spoofed" }, context), first);
    await assert.rejects(service.createTransformation({ ...input, requestHash: "changed", inputs: [{ productionBatchId: f.input.id, quantity: "3.000" }] }, context), (e: any) => e.code === "IDEMPOTENCY_CONFLICT");
    const race = await fixture("2.000");
    const [a, b] = await Promise.allSettled([
      service.createTransformation(command(race, { operationKey: `p8-race-total-${randomUUID()}`, inputs: [{ productionBatchId: race.input.id, quantity: "2.000" }] }), context),
      service.createTransformation(command(race, { operationKey: `p8-race-partial-${randomUUID()}`, inputs: [{ productionBatchId: race.input.id, quantity: "1.000" }] }), context),
    ]);
    assert.ok([a, b].some(x => x.status === "fulfilled"));
    assert.ok([a, b].some(x => x.status === "rejected" && ["INSUFFICIENT_BATCH_QUANTITY", "PRODUCTION_CONCURRENCY_CONFLICT"].includes((x as PromiseRejectedResult).reason.code)));
    const lockFixture = await fixture("4.000");
    const sibling = await service.createBatch({ code: `P8-B-${randomUUID()}`, productionOrderId: lockFixture.order.id, articuloId: lockFixture.raw.id, unit: "KG", quantity: "4.000", operationKey: `p8-b-${randomUUID()}`, requestHash: "fixture" }, context);
    const lockCommands = [
      command(lockFixture, { operationKey: `p8-lock-a-${randomUUID()}`, inputs: [{ productionBatchId: lockFixture.input.id, quantity: "1.000" }, { productionBatchId: sibling.id, quantity: "1.000" }] }),
      command(lockFixture, { operationKey: `p8-lock-b-${randomUUID()}`, inputs: [{ productionBatchId: sibling.id, quantity: "1.000" }, { productionBatchId: lockFixture.input.id, quantity: "1.000" }] }),
    ];
    const lockResults = await Promise.allSettled(lockCommands.map(item => service.createTransformation(item, context)));
    assert.ok(lockResults.every(result => result.status === "fulfilled"));
    const before = await prisma.transformation.count();
    const failing = new ProductionTransformationService(prisma, articles, () => ({ record: async () => { throw new Error("audit failure"); } } as any));
    await assert.rejects(failing.create(command(f), context), /audit failure/);
    assert.equal(await prisma.transformation.count(), before);
    assert.ok((await prisma.productionBatchBalance.findUniqueOrThrow({ where: { productionBatchId: f.input.id } })).available.gte(0));
  });

  it("rejects duplicate and cross-order references and preserves null lineage allocations", options, async () => {
    assert.ok(prisma && service);
    const f = await fixture("8.000");
    const other = await fixture("8.000");
    await assert.rejects(service.createTransformation(command(f, { inputs: [{ productionBatchId: f.input.id, quantity: "1.000" }, { productionBatchId: f.input.id, quantity: "1.000" }] }), context), (e: any) => e.code === "DUPLICATE_INPUT_BATCH");
    await assert.rejects(service.createTransformation(command(f, { inputs: [{ productionBatchId: other.input.id, quantity: "1.000" }] }), context), (e: any) => e.code === "BATCH_ORDER_MISMATCH");
    await assert.rejects(service.createTransformation(command(f, { losses: [{ productionBatchId: other.input.id, quantity: "1.000", unit: "KG" }] }), context), (e: any) => e.code === "BATCH_ORDER_MISMATCH");
    await assert.rejects(service.createTransformation(command(f, { losses: [{ productionBatchId: f.input.id, quantity: "1.000", unit: "L" }] }), context), (e: any) => e.code === "UNIT_INCOMPATIBLE");
    const result = await service.createTransformation(command(f, { inputs: [{ productionBatchId: f.input.id, quantity: "1.000" }], outputs: [{ articuloId: f.output.id, quantity: "1.000", unit: "KG" }, { articuloId: f.output.id, quantity: "1.000", unit: "KG" }] }), context);
    const lineage = await prisma.productionBatchLineage.findMany({ where: { childBatchId: { in: result.outputs.map(item => item.productionBatchId) } } });
    assert.equal(lineage.length, 2);
    assert.ok(lineage.every(edge => edge.quantity === null && edge.unit === null));
    const generated = await prisma.productionBatchLedgerEntry.findMany({ where: { productionBatchId: { in: result.outputs.map(item => item.productionBatchId) }, entryType: "GENERATED" } });
    assert.equal(generated.length, 2);
    assert.ok(generated.every(entry => entry.transformationId === result.id));
  });

  it("linearizes transformation creation with order closures", options, async () => {
    assert.ok(prisma && service);
    const orderFixture = await fixture();
    const orderCommand = command(orderFixture);
    const orderRace = await Promise.allSettled([
      service.createTransformation(orderCommand, context),
      service.closeOrder(orderFixture.order.id, context),
    ]);
    assert.equal(orderRace[1]?.status, "fulfilled");
    assert.ok(
      orderRace[0]?.status === "fulfilled"
      || (orderRace[0]?.reason as any)?.code === "PRODUCTION_ORDER_CLOSED",
    );
    assert.equal(
      await prisma.transformation.count({ where: { operationKey: orderCommand.operationKey } }),
      orderRace[0]?.status === "fulfilled" ? 1 : 0,
    );

    const transformationOrderFixture = await fixture();
    const transformationOrder = await service.createTransformationOrder({
      code: `P8-T-${randomUUID()}`,
      productionOrderId: transformationOrderFixture.order.id,
      periodStart: new Date(),
    }, context);
    const transformationOrderCommand = command(transformationOrderFixture, {
      transformationOrderId: transformationOrder.id,
    });
    const transformationOrderRace = await Promise.allSettled([
      service.createTransformation(transformationOrderCommand, context),
      service.closeTransformationOrder(transformationOrder.id, context),
    ]);
    assert.equal(transformationOrderRace[1]?.status, "fulfilled");
    assert.ok(
      transformationOrderRace[0]?.status === "fulfilled"
      || (transformationOrderRace[0]?.reason as any)?.code === "TRANSFORMATION_ORDER_CLOSED",
    );
    assert.equal(
      await prisma.transformation.count({ where: { operationKey: transformationOrderCommand.operationKey } }),
      transformationOrderRace[0]?.status === "fulfilled" ? 1 : 0,
    );
  });

  it("enforces append-only P8 guards and rolls back every atomic side effect", options, async () => {
    assert.ok(prisma && service && articles);
    const f = await fixture("8.000");
    const result = await service.createTransformation(command(f), context);
    const lossResult = await service.createTransformation(command(f, { losses: [{ quantity: "0.100", unit: "KG" }] }), context);
    const inputRow = await prisma.transformationInput.findFirstOrThrow({ where: { transformationId: result.id } });
    const outputRow = await prisma.transformationOutput.findFirstOrThrow({ where: { transformationId: result.id } });
    const lossRow = await prisma.productionLoss.findFirstOrThrow({ where: { transformationId: lossResult.id } });
    for (const operation of [
      prisma.transformation.update({ where: { id: result.id }, data: { observations: "tampered" } }),
      prisma.transformationInput.delete({ where: { id: inputRow.id } }),
      prisma.transformationOutput.delete({ where: { id: outputRow.id } }),
      prisma.productionLoss.update({ where: { id: lossRow.id }, data: { observations: "tampered" } }),
      prisma.productionLoss.delete({ where: { id: lossRow.id } }),
    ]) await assert.rejects(operation, /append-only/i);
    const before = await Promise.all([
      prisma.transformation.count(), prisma.transformationInput.count(), prisma.transformationOutput.count(), prisma.productionLoss.count(),
      prisma.productionBatchLedgerEntry.count(), prisma.productionBatchBalance.count(), prisma.productionBatchLineage.count(),
      prisma.productionBatchOperation.count(), prisma.auditLog.count(), prisma.productionBatch.count(),
    ]);
    const failing = new ProductionTransformationService(prisma, articles, () => ({ record: async () => { throw new Error("audit failure"); } } as any));
    await assert.rejects(failing.create(command(f, { losses: [{ quantity: "0.100", unit: "KG" }] }), context), /audit failure/);
    const after = await Promise.all([
      prisma.transformation.count(), prisma.transformationInput.count(), prisma.transformationOutput.count(), prisma.productionLoss.count(),
      prisma.productionBatchLedgerEntry.count(), prisma.productionBatchBalance.count(), prisma.productionBatchLineage.count(),
      prisma.productionBatchOperation.count(), prisma.auditLog.count(), prisma.productionBatch.count(),
    ]);
    assert.deepEqual(after, before);
  });
});