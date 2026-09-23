import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { AuditService } from "../src/core/audit/audit.service.js";
import { PrismaAuditRepository } from "../src/core/audit/prisma-audit.repository.js";
import { ArticuloService } from "../src/modules/articulos/articulo.service.js";
import { PrismaArticuloRepository } from "../src/modules/articulos/prisma-articulo.repository.js";
import { PrismaArticuloUnitOfWork } from "../src/modules/articulos/prisma-articulo.unit-of-work.js";
import { InventoryService } from "../src/modules/inventory/inventory.service.js";
import { ProductionService } from "../src/modules/production/production.service.js";
import { ProductionReleaseService } from "../src/modules/production/production.release.js";
import { canonicalContainerAssignmentRequest } from "../src/modules/production/production.container.js";
import { createTrustedIntermoduleContext } from "../src/modules/inventory/inventory.model.js";
import { createTemporaryProductionDatabaseResource } from "./helpers/production-test-database.js";

const database = createTemporaryProductionDatabaseResource("P9_DATABASE_URL", connectionString => ({ connectionString, createClient: () => new PrismaClient({ adapter: new PrismaPg({ connectionString }) }) }));
const prisma = database?.createClient();
let available = false;
if (prisma) { try { await prisma.$queryRaw`SELECT 1 FROM inventory_lots LIMIT 1`; available = true; } catch { available = false; } }
if (database && !available) throw new Error("P9_DATABASE_URL was supplied but the P9 migration/database is unavailable");
const options = available ? {} : { skip: "requires P9_DATABASE_URL with P9 migration applied" };
const stable = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(stable).join(",")}]` : `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;

describe("Production P9 release to inventory", () => {
  const actor = randomUUID();
  const context = { actorUserId: actor, requestId: randomUUID() };
  const articles = prisma ? new ArticuloService(new PrismaArticuloRepository(prisma), new PrismaArticuloUnitOfWork(prisma)) : undefined;
  const inventory = prisma && articles ? new InventoryService(prisma, articles) : undefined;
  const service = prisma && articles && inventory ? new ProductionService(prisma, new AuditService(new PrismaAuditRepository(prisma)), articles, inventory) : undefined;
  before(async () => { if (prisma) await prisma.user.create({ data: { id: actor, firebaseUid: `p9-${actor}`, email: `${actor}@test.invalid`, status: "ACTIVE" } }); });
  after(async () => { await prisma?.$disconnect(); });

  async function fixture(quantity = "10.000", closed = false) {
    assert.ok(prisma && service && articles);
    const order = await service.createOrder({ code: `P9-O-${randomUUID()}`, startDate: new Date() }, context);
    const article = await articles.createArticulo({ codigo: `P9-A-${randomUUID()}`, nombre: "Output", clasificacion: "PRODUCTO_TERMINADO", unidadMedida: "KG" }, context);
    const batch = await service.createBatch({ code: `P9-B-${randomUUID()}`, productionOrderId: order.id, articuloId: article.id, unit: "KG", quantity, operationKey: `p9-create-${randomUUID()}`, requestHash: "fixture" }, context);
    const warehouse = await prisma.warehouse.create({ data: { codigo: `P9-W-${randomUUID()}`, nombre: "P9" } });
    if (closed) await service.closeOrder(order.id, context);
    return { order, article, batch, warehouse };
  }
  const command = (f: Awaited<ReturnType<typeof fixture>>, overrides: Record<string, unknown> = {}) => ({
    productionBatchId: f.batch.id, quantity: "10.000", warehouseId: f.warehouse.id, operationKey: `p9-release-${randomUUID()}`,
    lotCode: `LOT-${randomUUID()}`, classification: "PRODUCTO_ENVASADO" as const, fechaIngreso: new Date("2026-01-02T03:04:05.000Z"), ...overrides,
  });

  it("releases totally and conserves production plus inventory quantity", options, async () => {
    assert.ok(prisma && service);
    const f = await fixture();
    const result = await service.releaseBatchToInventory(command(f), context);
    assert.equal(result.remainingProductionQuantity, "0.000");
    const stock = await prisma.inventoryStock.findFirstOrThrow({ where: { warehouseId: f.warehouse.id, articuloId: f.article.id } });
    assert.equal(stock.quantity.toFixed(3), "10.000");
    assert.equal(stock.unit, "KG");
    const movement = await prisma.inventoryMovement.findFirstOrThrow({ where: { inventoryLotId: result.inventoryLotId } });
    assert.equal(movement.type, "INBOUND"); assert.equal(movement.source, "PRODUCTION_OUTPUT");
    assert.equal(movement.articuloId, f.article.id); assert.equal(movement.warehouseId, f.warehouse.id);
    assert.equal(movement.unit, "KG"); assert.equal(movement.quantity.toFixed(3), "10.000");
    assert.equal(movement.resultingStock.toFixed(3), "10.000");
    const ledger = await prisma.productionBatchLedgerEntry.findFirstOrThrow({ where: { productionBatchId: f.batch.id, entryType: "TRANSFERRED_TO_INVENTORY" } });
    assert.equal(ledger.quantity.toFixed(3), "10.000");
    assert.equal((ledger.metadata as any).inventoryLotId, result.inventoryLotId);
    assert.equal((ledger.metadata as any).inventoryMovementId, result.inventoryMovementId);
    const balance = await prisma.productionBatchBalance.findUniqueOrThrow({ where: { productionBatchId: f.batch.id } });
    assert.equal(balance.available.toFixed(3), "0.000");
    assert.equal(Number(balance.available) + Number(stock.quantity), 10);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "PRODUCTION_BATCH_RELEASED_TO_INVENTORY", resourceId: f.batch.id }, orderBy: { createdAt: "desc" } });
    assert.equal((audit.metadata as any).operationKey, (await prisma.productionBatchOperation.findUniqueOrThrow({ where: { operationKey: (ledger.metadata as any).operationKey ?? "" } })).operationKey);
  });
  it("supports partial and remainder releases, rejects over/zero/negative and missing batches", options, async () => {
    assert.ok(service && prisma);
    const f = await fixture();
    const first = command(f, { quantity: "4.000", operationKey: `p9-${randomUUID()}` });
    const second = { ...first, quantity: "6.000", operationKey: `p9-${randomUUID()}`, lotCode: `LOT-${randomUUID()}` };
    assert.equal((await service.releaseBatchToInventory(first, context)).remainingProductionQuantity, "6.000");
    assert.equal((await service.releaseBatchToInventory(second, context)).remainingProductionQuantity, "0.000");
    await assert.rejects(service.releaseBatchToInventory(command(f, { quantity: "1.000" }), context), (e: any) => e.code === "INSUFFICIENT_BATCH_QUANTITY");
    await assert.rejects(service.releaseBatchToInventory(command(f, { quantity: "0" }), context), (e: any) => e.code === "INVALID_BATCH_TRANSFORMATION");
    await assert.rejects(service.releaseBatchToInventory(command(f, { quantity: "-1.000" }), context), (e: any) => e.code === "INVALID_BATCH_TRANSFORMATION");
    await assert.rejects(service.releaseBatchToInventory(command(f, { productionBatchId: randomUUID() }), context), (e: any) => e.code === "BATCH_NOT_FOUND");
  });
  it("validates warehouse, article/unit, classification and lot origin/reuse", options, async () => {
    assert.ok(prisma && service && articles);
    const f = await fixture();
    const inactive = await prisma.warehouse.create({ data: { codigo: `P9-W-${randomUUID()}`, nombre: "Inactive", activo: false } });
    await assert.rejects(service.releaseBatchToInventory(command(f, { warehouseId: inactive.id }), context), (e: any) => e.code === "WAREHOUSE_INACTIVE");
    await assert.rejects(service.releaseBatchToInventory(command(f, { warehouseId: randomUUID() }), context), (e: any) => e.code === "NOT_FOUND");
    await assert.rejects(service.releaseBatchToInventory(command(f, { classification: "PRODUCTO_TERMINADO" }), context), (e: any) => e.code === "INVALID_LOT_CLASSIFICATION");
    await articles.deactivateArticulo(f.article.id, context);
    await assert.rejects(service.releaseBatchToInventory(command(f, { quantity: "1.000", operationKey: `p9-${randomUUID()}` }), context), (e: any) => e.code === "ARTICULO_INVALID");
  });
  it("replays idempotently and conflicts changed payloads", options, async () => {
    assert.ok(service && prisma);
    const f = await fixture();
    const input = command(f, { quantity: "2.000", operationKey: `p9-replay-${randomUUID()}` });
    const first = await service.releaseBatchToInventory(input, context);
    assert.deepEqual(await service.releaseBatchToInventory(input, context), first);
    await assert.rejects(service.releaseBatchToInventory({ ...input, quantity: "3.000" }, context), (e: any) => e.code === "IDEMPOTENCY_CONFLICT");
    await assert.rejects(service.releaseBatchToInventory({ ...input, fechaIngreso: new Date("2027-01-01T00:00:00.000Z") }, context), (e: any) => e.code === "IDEMPOTENCY_CONFLICT");
    await assert.rejects(service.releaseBatchToInventory({ ...input, observations: "different" }, context), (e: any) => e.code === "IDEMPOTENCY_CONFLICT");
    const whitespace = { ...input, operationKey: `p9-whitespace-${randomUUID()}`, lotCode: "  NORMALIZED  ", observations: "  note  " };
    const normalized = await service.releaseBatchToInventory(whitespace, context);
    assert.deepEqual(await service.releaseBatchToInventory({ ...whitespace, lotCode: "NORMALIZED", observations: "note" }, context), normalized);
    assert.equal(await prisma.inventoryMovement.count({ where: { inventoryLotId: first.inventoryLotId } }), 1);
  });
  it("enforces the trusted Inventory primitive contract and its own date idempotency", options, async () => {
    assert.ok(prisma && inventory && service);
    const f = await fixture("2.000");
    const trusted = createTrustedIntermoduleContext(context);
    const base = { warehouseId: f.warehouse.id, articuloId: f.article.id, unit: "KG", quantity: "1.000", lotCode: `P9-DIRECT-${randomUUID()}`, classification: "PRODUCTO_ENVASADO" as const, fechaIngreso: new Date("2026-01-01T00:00:00.000Z"), originProductionBatchId: f.batch.id, idempotencyKey: `p9-direct-${randomUUID()}` };
    await assert.rejects(prisma.$transaction(tx => inventory.releaseProductionOutput({ ...base, classification: "PRODUCTO_TERMINADO" } as any, trusted, tx)), (e: any) => e.code === "INVALID_LOT_CLASSIFICATION");
    await prisma.$transaction(tx => inventory.releaseProductionOutput(base, trusted, tx));
    await assert.rejects(prisma.$transaction(tx => inventory.releaseProductionOutput({ ...base, fechaIngreso: new Date("2026-02-01T00:00:00.000Z") }, trusted, tx)), (e: any) => e.code === "IDEMPOTENCY_CONFLICT");
  });
  it("serializes concurrent lot claims and same-origin stock updates", options, async () => {
    assert.ok(prisma && inventory && service);
    const f = await fixture("4.000");
    const second = await service.createBatch({ code: `P9-B-${randomUUID()}`, productionOrderId: f.order.id, articuloId: f.article.id, unit: "KG", quantity: "1.000", operationKey: `p9-create-${randomUUID()}`, requestHash: "fixture" }, context);
    const trusted = createTrustedIntermoduleContext(context);
    const base = { warehouseId: f.warehouse.id, articuloId: f.article.id, unit: "KG", quantity: "1.000", lotCode: `P9-RACE-${randomUUID()}`, classification: "PRODUCTO_ENVASADO" as const, fechaIngreso: new Date("2026-01-01T00:00:00.000Z") };
    const claims = await Promise.allSettled([f.batch, second].map((batch, index) => prisma.$transaction(tx => inventory.releaseProductionOutput({
      ...base,
      lotCode: index === 0 ? base.lotCode : base.lotCode.toLowerCase(),
      originProductionBatchId: batch.id,
      idempotencyKey: `p9-race-${index}-${randomUUID()}`,
    }, trusted, tx))));
    assert.equal(claims.filter(x => x.status === "fulfilled").length, 1);
    assert.equal(await prisma.inventoryLot.count({ where: { articuloId: f.article.id, lotCode: { equals: base.lotCode, mode: "insensitive" } } }), 1);
    assert.equal(await prisma.inventoryMovement.count({ where: { articuloId: f.article.id, lot: { lotCode: { equals: base.lotCode, mode: "insensitive" } } } }), 1);
    const sameLot = { ...base, originProductionBatchId: f.batch.id, quantity: "1.000" };
    await Promise.all([0, 1].map(index => prisma.$transaction(tx => inventory.releaseProductionOutput({ ...sameLot, idempotencyKey: `p9-stock-race-${index}-${randomUUID()}` }, trusted, tx))));
    const lot = await prisma.inventoryLot.findFirstOrThrow({ where: { articuloId: f.article.id, lotCode: base.lotCode } });
    const stock = await prisma.inventoryStock.findFirstOrThrow({ where: { warehouseId: f.warehouse.id, articuloId: f.article.id, inventoryLotId: lot.id } });
    assert.equal(stock.quantity.toFixed(3), "3.000");
    assert.equal(await prisma.inventoryMovement.count({ where: { inventoryLotId: lot.id } }), 3);
  });
  it("reuses mixed-case lot codes only for the same origin batch", options, async () => {
    assert.ok(prisma && inventory && service);
    const f = await fixture("3.000");
    const trusted = createTrustedIntermoduleContext(context);
    const lotCode = `P9-MIXED-${randomUUID()}`;
    const base = {
      warehouseId: f.warehouse.id,
      articuloId: f.article.id,
      unit: "KG",
      quantity: "1.000",
      lotCode,
      classification: "PRODUCTO_ENVASADO" as const,
      fechaIngreso: new Date("2026-01-01T00:00:00.000Z"),
      originProductionBatchId: f.batch.id,
    };
    const first = await prisma.$transaction(tx => inventory.releaseProductionOutput({ ...base, idempotencyKey: `p9-mixed-${randomUUID()}` }, trusted, tx));
    const replayedLot = await prisma.$transaction(tx => inventory.releaseProductionOutput({ ...base, lotCode: lotCode.toLowerCase(), idempotencyKey: `p9-mixed-${randomUUID()}` }, trusted, tx));
    assert.equal(replayedLot.inventoryLotId, first.inventoryLotId);
    const otherBatch = await service.createBatch({ code: `P9-B-${randomUUID()}`, productionOrderId: f.order.id, articuloId: f.article.id, unit: "KG", quantity: "1.000", operationKey: `p9-create-${randomUUID()}`, requestHash: "fixture" }, context);
    await assert.rejects(
      prisma.$transaction(tx => inventory.releaseProductionOutput({ ...base, lotCode: lotCode.toLowerCase(), originProductionBatchId: otherBatch.id, idempotencyKey: `p9-mixed-${randomUUID()}` }, trusted, tx)),
      (error: any) => error.code === "LOT_ORIGIN_CONFLICT",
    );
  });
  it("honors open container allocations and leaves rejected releases side-effect free", options, async () => {
    assert.ok(service && prisma);
    const f = await fixture("10.000");
    const container = await service.createContainer({ code: `P9-C-${randomUUID()}`, capacity: "6.000", capacityUnit: "KG" }, context);
    const assignment = { batchId: f.batch.id, destinationContainerId: container.id, quantity: "6.000", operationKey: `p9-container-${randomUUID()}` };
    await service.assignBatchToContainer({ ...assignment, requestHash: createHash("sha256").update(stable(canonicalContainerAssignmentRequest(assignment))).digest("hex") }, context);
    const before = { lots: await prisma.inventoryLot.count(), movements: await prisma.inventoryMovement.count(), stocks: await prisma.inventoryStock.count(), idempotency: await prisma.inventoryIdempotency.count() };
    const first = await service.releaseBatchToInventory(command(f, { quantity: "4.000" }), context);
    assert.equal(first.remainingProductionQuantity, "6.000");
    await assert.rejects(service.releaseBatchToInventory(command(f, { quantity: "1.000" }), context), (e: any) => e.code === "INSUFFICIENT_BATCH_QUANTITY");
    assert.equal(await prisma.inventoryLot.count(), before.lots + 1);
    assert.equal(await prisma.inventoryMovement.count(), before.movements + 1);
    assert.equal(await prisma.inventoryStock.count(), before.stocks + 1);
    assert.equal(await prisma.inventoryIdempotency.count(), before.idempotency + 1);
    const full = await fixture("5.000");
    const fullContainer = await service.createContainer({ code: `P9-C-${randomUUID()}`, capacity: "5.000", capacityUnit: "KG" }, context);
    const fullAssignment = { batchId: full.batch.id, destinationContainerId: fullContainer.id, quantity: "5.000", operationKey: `p9-container-${randomUUID()}` };
    await service.assignBatchToContainer({ ...fullAssignment, requestHash: createHash("sha256").update(stable(canonicalContainerAssignmentRequest(fullAssignment))).digest("hex") }, context);
    const counts = await prisma.inventoryMovement.count();
    await assert.rejects(service.releaseBatchToInventory(command(full, { quantity: "1.000" }), context), (e: any) => e.code === "INSUFFICIENT_BATCH_QUANTITY");
    assert.equal(await prisma.inventoryMovement.count(), counts);
  });
  it("traces and reuses lots only within the originating batch", options, async () => {
    assert.ok(service && prisma);
    const f = await fixture("5.000");
    const first = command(f, { quantity: "2.000", lotCode: "P9-SAME-LOT", operationKey: `p9-lot-${randomUUID()}` });
    const second = { ...first, quantity: "3.000", operationKey: `p9-lot-${randomUUID()}` };
    const one = await service.releaseBatchToInventory(first, context);
    const two = await service.releaseBatchToInventory(second, context);
    assert.equal(one.inventoryLotId, two.inventoryLotId);
    const lot = await prisma.inventoryLot.findUniqueOrThrow({ where: { id: one.inventoryLotId } });
    assert.equal(lot.originProductionBatchId, f.batch.id);
    const stock = await prisma.inventoryStock.findFirstOrThrow({ where: { inventoryLotId: one.inventoryLotId } });
    assert.equal(stock.quantity.toFixed(3), "5.000");
    const secondBatch = await service.createBatch({ code: `P9-B-${randomUUID()}`, productionOrderId: f.order.id, articuloId: f.article.id, unit: "KG", quantity: "1.000", operationKey: `p9-create-${randomUUID()}`, requestHash: "fixture" }, context);
    await assert.rejects(service.releaseBatchToInventory({ ...first, productionBatchId: secondBatch.id, quantity: "1.000", operationKey: `p9-lot-conflict-${randomUUID()}` }, context), (e: any) => e.code === "LOT_ORIGIN_CONFLICT");
  });
  it("allows OPEN and CLOSED orders and serializes concurrent releases", options, async () => {
    assert.ok(service && prisma);
    const open = await fixture("2.000");
    const closed = await fixture("2.000", true);
    assert.equal((await service.releaseBatchToInventory(command(open, { quantity: "2.000" }), context)).remainingProductionQuantity, "0.000");
    assert.equal((await service.releaseBatchToInventory(command(closed, { quantity: "2.000" }), context)).remainingProductionQuantity, "0.000");
    const concurrent = await fixture("1.000");
    const calls = [
      service.releaseBatchToInventory(command(concurrent, { quantity: "1.000" }), context),
      service.releaseBatchToInventory(command(concurrent, { quantity: "1.000", operationKey: `p9-${randomUUID()}`, lotCode: `LOT-${randomUUID()}` }), context),
    ];
    const results = await Promise.allSettled(calls);
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal((await prisma.productionBatchBalance.findUniqueOrThrow({ where: { productionBatchId: concurrent.batch.id } })).available.toFixed(3), "0.000");
  });
  it("linearizes close versus release without corrupting either aggregate", options, async () => {
    assert.ok(service && prisma);
    const f = await fixture("1.000");
    const [release, close] = await Promise.allSettled([
      service.releaseBatchToInventory(command(f, { quantity: "1.000", operationKey: `p9-close-r-${randomUUID()}` }), context),
      service.closeOrder(f.order.id, context),
    ]);
    assert.equal(release.status, "fulfilled");
    assert.equal(close.status, "fulfilled");
    assert.equal((await prisma.productionBatchBalance.findUniqueOrThrow({ where: { productionBatchId: f.batch.id } })).available.toFixed(3), "0.000");
    assert.equal((await prisma.productionOrder.findUniqueOrThrow({ where: { id: f.order.id } })).status, "CLOSED");
  });
  it("rolls back every write when Inventory or the ledger fails", options, async () => {
    assert.ok(service && prisma && articles);
    const f = await fixture("3.000");
    const counts = async () => ({
      lots: await prisma.inventoryLot.count(), movements: await prisma.inventoryMovement.count(),
      stocks: await prisma.inventoryStock.count(), inventoryIdempotency: await prisma.inventoryIdempotency.count(),
      ledger: await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: f.batch.id } }),
      operations: await prisma.productionBatchOperation.count(), audits: await prisma.auditLog.count(),
      balance: (await prisma.productionBatchBalance.findUniqueOrThrow({ where: { productionBatchId: f.batch.id } })).available.toFixed(3),
    });
    const beforeInventory = await counts();
    const failingInventory = { releaseProductionOutput: async () => { throw new Error("injected inventory failure"); } };
    const broken = new ProductionReleaseService(prisma, failingInventory as any, (tx) => new AuditService(new PrismaAuditRepository(tx)));
    await assert.rejects(broken.release(command(f, { quantity: "1.000" }), context), /injected inventory failure/);
    assert.deepEqual(await counts(), beforeInventory);

    const ledgerKeyInput = command(f, { quantity: "1.000", operationKey: `p9-ledger-conflict-${randomUUID()}` });
    await prisma.productionBatchLedgerEntry.create({ data: { productionBatchId: f.batch.id, entryType: "LOSS", quantity: "0.001", unit: "KG", operationKey: `${ledgerKeyInput.operationKey}:ledger`, actorUserId: actor, occurredAt: new Date() } });
    const beforeLedger = await counts();
    await assert.rejects(service.releaseBatchToInventory(ledgerKeyInput, context), (e: any) => e.code === "IDEMPOTENCY_CONFLICT");
    assert.deepEqual(await counts(), beforeLedger);
  });
  it("rolls back Inventory, ledger and operation when audit factory fails", options, async () => {
    assert.ok(prisma && articles);
    const f = await fixture("2.000");
    const failingAudit = () => ({ record: async () => { throw new Error("injected audit failure"); } }) as unknown as AuditService;
    const direct = new ProductionReleaseService(prisma, inventory!, failingAudit);
    const before = {
      lots: await prisma.inventoryLot.count(), movements: await prisma.inventoryMovement.count(),
      stocks: await prisma.inventoryStock.count(), inventoryIdempotency: await prisma.inventoryIdempotency.count(),
      ledger: await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: f.batch.id } }),
      operation: await prisma.productionBatchOperation.count(), audit: await prisma.auditLog.count(),
    };
    await assert.rejects(direct.release(command(f, { quantity: "1.000" }), context), /injected audit failure/);
    assert.deepEqual({
      lots: await prisma.inventoryLot.count(), movements: await prisma.inventoryMovement.count(),
      stocks: await prisma.inventoryStock.count(), inventoryIdempotency: await prisma.inventoryIdempotency.count(),
      ledger: await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: f.batch.id } }),
      operation: await prisma.productionBatchOperation.count(), audit: await prisma.auditLog.count(),
    }, before);
  });
});