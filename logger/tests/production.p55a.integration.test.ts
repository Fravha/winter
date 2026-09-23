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
import { InventoryService } from "../src/modules/inventory/inventory.service.js";
import { ProductionService } from "../src/modules/production/production.service.js";
import {
  canonicalProductionWorkInputRequest,
  canonicalProductionWorkInputReversalRequest,
} from "../src/modules/production/production.work.js";
import { getTemporaryProductionDatabaseUrl } from "./helpers/production-test-database.js";

const url = getTemporaryProductionDatabaseUrl("P55A_DATABASE_URL");
const run = url ? describe : describe.skip;

run("P5.5A production work-input PostgreSQL integration", () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const articles = new ArticuloService(new PrismaArticuloRepository(prisma), new PrismaArticuloUnitOfWork(prisma));
  const inventory = new InventoryService(prisma, articles);
  const service = new ProductionService(prisma, new AuditService(new PrismaAuditRepository(prisma)), articles, inventory);
  const actor = randomUUID();
  const requestId = `p55a-request-${randomUUID()}`;
  const context = { actorUserId: actor, requestId };
  const inventoryContext = { ...context, permissions: ["inventory:negative_stock_authorize"] };
  let articleId = "";
  let warehouseId = "";
  let workId = "";
  let orderId = "";
  let workTypeId = "";
  const operationKeys: string[] = [];

  before(async () => {
    await prisma.user.create({ data: { id: actor, firebaseUid: `p55a-${actor}`, email: `${actor}@p55a.test`, status: "ACTIVE" } });
    const article = await articles.createArticulo({ codigo: `P55A-${randomUUID()}`, nombre: "Bentonita", clasificacion: "MATERIA_PRIMA", unidadMedida: "KG" }, context);
    articleId = article.id;
    const warehouse = await prisma.warehouse.create({ data: { codigo: `P55A-${randomUUID()}`, nombre: "P55A warehouse" } });
    warehouseId = warehouse.id;
    const order = await service.createOrder({ code: `P55A-${randomUUID()}`, startDate: new Date() }, context);
    orderId = order.id;
    const type = await service.create("work-types", { code: `P55A-${randomUUID()}`, name: "Clarificación" }, context);
    workTypeId = type.id;
    const work = await service.createWork({ productionOrderId: order.id, workTypeId: type.id, performedAt: new Date() }, context);
    workId = work.id;
    await inventory.registerInbound({ articuloId: articleId, warehouseId, quantity: "10.000", unit: "KG", source: "P55A_SEED", idempotencyKey: `p55a-seed-${randomUUID()}` }, inventoryContext);
  });

  after(async () => {
    await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS p55a_fail_input ON production_work_inputs");
    await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS p55a_fail_input_fn()");
    await prisma.auditLog.deleteMany({ where: { actorUserId: actor } });
    if (workId) {
      await prisma.$executeRawUnsafe("ALTER TABLE production_work_inputs DISABLE TRIGGER production_work_inputs_append_only");
      try {
        await prisma.productionWorkInput.deleteMany({ where: { productionWorkId: workId } });
      } finally {
        await prisma.$executeRawUnsafe("ALTER TABLE production_work_inputs ENABLE TRIGGER production_work_inputs_append_only");
      }
      await prisma.productionWork.delete({ where: { id: workId } });
    }
    if (warehouseId) await prisma.inventoryMovement.deleteMany({ where: { warehouseId } });
    if (warehouseId) await prisma.inventoryStock.deleteMany({ where: { warehouseId } });
    if (warehouseId) await prisma.warehouse.deleteMany({ where: { id: warehouseId } });
    if (workTypeId) await prisma.workType.delete({ where: { id: workTypeId } });
    if (orderId) await prisma.productionOrder.delete({ where: { id: orderId } });
    if (articleId) await prisma.articulo.delete({ where: { id: articleId } });
    await prisma.user.delete({ where: { id: actor } });
    await prisma.$disconnect();
  });

  function input(key = `p55a-input-${randomUUID()}`, quantity = "2.000") {
    operationKeys.push(key);
    return { articuloId: articleId, warehouseId, quantity, unit: "KG" as const, operationKey: key, requestHash: "incorrect" };
  }
  async function validInput(key: string, quantity = "2.000", authorizeNegativeStock = false, negativeStockReason?: string) {
    const data = input(key, quantity);
    if (authorizeNegativeStock) {
      data.authorizeNegativeStock = true;
      data.negativeStockReason = negativeStockReason;
    }
    const { createHash } = await import("node:crypto");
    const stable = (value: unknown): string => value === null || typeof value !== "object"
      ? JSON.stringify(value)
      : Array.isArray(value) ? `[${value.map(stable).join(",")}]`
        : `{${Object.keys(value as object).sort().map(k => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(",")}}`;
    data.requestHash = createHash("sha256").update(stable(canonicalProductionWorkInputRequest(data))).digest("hex");
    return data;
  }

  it("consumes Scenario B stock and structurally links the production movement", async () => {
    const data = await validInput(`p55a-scenario-b-${randomUUID()}`);
    const result = await service.createWorkInput(workId, data, context);
    const row = await prisma.productionWorkInput.findUniqueOrThrow({ where: { id: result.id } });
    const movement = await prisma.inventoryMovement.findUniqueOrThrow({ where: { id: row.inventoryMovementId! } });
    const stock = await prisma.inventoryStock.findFirstOrThrow({ where: { warehouseId, articuloId: articleId, inventoryLotId: null } });
    assert.equal(stock.quantity.toString(), "8.000");
    assert.equal(movement.source, "PRODUCTION_CONSUMPTION");
    assert.equal(movement.type, "OUTBOUND");
    assert.equal(movement.actorUserId, actor);
    assert.equal(row.inventoryMovementId, movement.id);
    assert.equal((await prisma.auditLog.count({ where: { actorUserId: actor, resourceId: row.id } })), 1);
  });

  it("replays exact create and conflicts on a changed payload without a second effect", async () => {
    const key = `p55a-replay-${randomUUID()}`;
    const first = await service.createWorkInput(workId, await validInput(key), context);
    const before = await prisma.inventoryMovement.count({ where: { warehouseId, source: "PRODUCTION_CONSUMPTION" } });
    assert.equal((await service.createWorkInput(workId, await validInput(key), context)).id, first.id);
    await assert.rejects(service.createWorkInput(workId, await validInput(key, "3.000"), context), (e: any) => e.code === "IDEMPOTENCY_CONFLICT");
    assert.equal(await prisma.inventoryMovement.count({ where: { warehouseId, source: "PRODUCTION_CONSUMPTION" } }), before);
  });

  it("rolls back an insufficient-stock failure and a failure after inventory changes", async () => {
    const stockBefore = await prisma.inventoryStock.findFirstOrThrow({ where: { warehouseId, articuloId: articleId, inventoryLotId: null } });
    const movementBefore = await prisma.inventoryMovement.count({ where: { warehouseId } });
    await assert.rejects(service.createWorkInput(workId, await validInput(`p55a-short-${randomUUID()}`, "999.000"), context));
    assert.equal((await prisma.inventoryStock.findFirstOrThrow({ where: { id: stockBefore.id } })).quantity.toString(), stockBefore.quantity.toString());
    assert.equal(await prisma.inventoryMovement.count({ where: { warehouseId } }), movementBefore);

    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION p55a_fail_input_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'P55A injected completion failure'; END; $$`);
    await prisma.$executeRawUnsafe("CREATE TRIGGER p55a_fail_input BEFORE INSERT ON production_work_inputs FOR EACH ROW EXECUTE FUNCTION p55a_fail_input_fn()");
    try {
      await assert.rejects(service.createWorkInput(workId, await validInput(`p55a-trigger-${randomUUID()}`), context));
    } finally {
      await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS p55a_fail_input ON production_work_inputs");
    }
    assert.equal(await prisma.inventoryMovement.count({ where: { warehouseId } }), movementBefore);
    assert.equal((await prisma.inventoryStock.findFirstOrThrow({ where: { id: stockBefore.id } })).quantity.toString(), stockBefore.quantity.toString());
  });

  it("requires negative-stock authorization and permits it only with the dedicated permission", async () => {
    const noAuth = await validInput(`p55a-negative-no-auth-${randomUUID()}`, "999.000", true, "approved");
    await assert.rejects(service.createWorkInput(workId, noAuth, context), (e: any) => e.code === "AUTH_FORBIDDEN");
    const permitted = await validInput(`p55a-negative-permitted-${randomUUID()}`, "999.000", true, "approved");
    const result = await service.createWorkInput(workId, permitted, inventoryContext);
    assert.equal(result.status, "ACTIVE");
    const reversal = { reason: "restore stock after authorization test", operationKey: `p55a-negative-restore-${randomUUID()}`, requestHash: "" };
    const { createHash } = await import("node:crypto");
    const stable = (value: unknown): string => value === null || typeof value !== "object"
      ? JSON.stringify(value)
      : Array.isArray(value) ? `[${value.map(stable).join(",")}]`
        : `{${Object.keys(value as object).sort().map(k => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`).join(",")}}`;
    reversal.requestHash = createHash("sha256").update(stable(canonicalProductionWorkInputReversalRequest(reversal))).digest("hex");
    await service.reverseWorkInput(workId, result.id, reversal, inventoryContext);
  });

  it("reverses once, restores stock, preserves the original, and replays exactly", async () => {
    const stockBefore = (await prisma.inventoryStock.findFirstOrThrow({ where: { warehouseId, articuloId: articleId, inventoryLotId: null } })).quantity.toString();
    const create = await service.createWorkInput(workId, await validInput(`p55a-reversal-create-${randomUUID()}`, "1.000"), context);
    const original = await prisma.productionWorkInput.findUniqueOrThrow({ where: { id: create.id } });
    const key = `p55a-reversal-${randomUUID()}`;
    const reversal = { reason: "corregir", operationKey: key, requestHash: "" };
    const { createHash } = await import("node:crypto");
    reversal.requestHash = createHash("sha256").update(JSON.stringify({ reason: reversal.reason })).digest("hex");
    const result = await service.reverseWorkInput(workId, create.id, reversal, context);
    const row = await prisma.productionWorkInput.findUniqueOrThrow({ where: { id: create.id } });
    const movement = await prisma.inventoryMovement.findUniqueOrThrow({ where: { id: row.reversalInventoryMovementId! } });
    assert.equal(row.inventoryMovementId, original.inventoryMovementId);
    assert.equal(movement.source, "PRODUCTION_CONSUMPTION_REVERSAL");
    assert.equal(movement.type, "INBOUND");
    assert.equal((await prisma.inventoryStock.findFirstOrThrow({ where: { warehouseId, articuloId: articleId, inventoryLotId: null } })).quantity.toString(), stockBefore);
    assert.equal((await service.reverseWorkInput(workId, create.id, reversal, context)).id, result.id);
    await assert.rejects(service.reverseWorkInput(workId, create.id, { ...reversal, operationKey: `${key}-other`, requestHash: reversal.requestHash }, context), (e: any) => e.code === "PRODUCTION_WORK_INPUT_ALREADY_REVERSED");
  });
});