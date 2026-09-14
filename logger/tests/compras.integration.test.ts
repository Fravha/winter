import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { SharedUnitOfWork } from "../src/core/database/shared-unit-of-work.js";
import { ArticuloService } from "../src/modules/articulos/articulo.service.js";
import { PrismaArticuloRepository } from "../src/modules/articulos/prisma-articulo.repository.js";
import { PrismaArticuloUnitOfWork } from "../src/modules/articulos/prisma-articulo.unit-of-work.js";
import { CompraService } from "../src/modules/compras/compra.service.js";
import { InventoryService } from "../src/modules/inventory/inventory.service.js";
import { createTrustedIntermoduleContext } from "../src/modules/inventory/inventory.model.js";
import { AppError } from "../src/shared/errors/app-error.js";

const connectionString = process.env.WINTER_DATABASE_URL;
let comprasTablesAvailable = false;
if (connectionString) {
  const probe = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  try {
    await probe.$queryRaw`SELECT 1 FROM compras LIMIT 1`;
    comprasTablesAvailable = true;
  } catch {
    comprasTablesAvailable = false;
  } finally {
    await probe.$disconnect();
  }
}

const describeWithDatabase = comprasTablesAvailable ? describe : describe.skip;

describeWithDatabase("Compras transactional integration", () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: connectionString! }),
  });
  const articuloRepository = new PrismaArticuloRepository(prisma);
  const articuloService = new ArticuloService(
    articuloRepository,
    new PrismaArticuloUnitOfWork(prisma),
  );
  const inventory = new InventoryService(prisma, articuloService);
  const compras = new CompraService(prisma, articuloService, inventory);
  const actorUserId = randomUUID();
  const actor = { actorUserId, requestId: randomUUID() };
  const createdArticuloIds: string[] = [];
  const createdCompraIds: string[] = [];
  const directInventoryKeys: string[] = [];
  let warehouseId: string;

  before(async () => {
    await prisma.user.create({
      data: {
        id: actorUserId,
        firebaseUid: `compras-integration-${actorUserId}`,
        email: `${actorUserId}@integration.test`,
        status: "ACTIVE",
      },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        codigo: `COMPRAS-${randomUUID()}`,
        nombre: "Compras integration warehouse",
      },
    });
    warehouseId = warehouse.id;
  });

  after(async () => {
    for (const compraId of createdCompraIds) {
      await prisma.compraInventoryMovementReference.deleteMany({ where: { compraId } });
      const items = await prisma.compraItem.findMany({ where: { compraId } });
      const keys = items.map((item) => `purchase-receive:${compraId}:${item.id}`);
      await prisma.inventoryIdempotency.deleteMany({ where: { key: { in: keys } } });
      for (const item of items) {
        const movements = await prisma.inventoryMovement.findMany({
          where: { articuloId: item.articuloId, warehouseId },
          select: { id: true },
        });
        await prisma.inventoryMovement.deleteMany({
          where: { id: { in: movements.map((movement) => movement.id) } },
        });
        await prisma.inventoryStock.deleteMany({
          where: { articuloId: item.articuloId, warehouseId },
        });
      }
      await prisma.compraItem.deleteMany({ where: { compraId } });
      await prisma.compra.delete({ where: { id: compraId } });
    }
    await prisma.auditLog.deleteMany({ where: { actorUserId } });
    await prisma.inventoryIdempotency.deleteMany({
      where: { key: { in: directInventoryKeys } },
    });
    for (const articuloId of createdArticuloIds) {
      await prisma.inventoryMovement.deleteMany({
        where: { articuloId, warehouseId },
      });
      await prisma.inventoryStock.deleteMany({
        where: { articuloId, warehouseId },
      });
    }
    await prisma.articulo.deleteMany({ where: { id: { in: createdArticuloIds } } });
    await prisma.warehouse.delete({ where: { id: warehouseId } });
    await prisma.user.delete({ where: { id: actorUserId } });
    await prisma.$disconnect();
  });

  async function createArticulo(unit: "KG" | "UNIDAD") {
    const articulo = await articuloService.createArticulo({
      codigo: `COMPRAS-${randomUUID()}`,
      nombre: "Integration article",
      clasificacion: "MATERIA_PRIMA",
      unidadMedida: unit,
    }, actor);
    createdArticuloIds.push(articulo.id);
    return articulo;
  }

  async function createCompra(items: readonly {
    articuloId: string;
    requestedQuantity: string;
    unit: "KG" | "UNIDAD";
  }[]) {
    const compra = await compras.create({
      supplierName: "Integration supplier",
      items,
    }, actor);
    createdCompraIds.push(compra.id);
    return compra;
  }

  it("receives multiple items, creates stock and normalized movement references", async () => {
    const first = await createArticulo("KG");
    const second = await createArticulo("UNIDAD");
    const compra = await createCompra([
      { articuloId: first.id, requestedQuantity: "2.500", unit: "KG" },
      { articuloId: second.id, requestedQuantity: "3", unit: "UNIDAD" },
    ]);

    const received = await compras.receive(compra.id, { warehouseId }, actor);
    assert.equal(received.status, "RECEIVED");
    assert.equal(received.items.length, 2);
    const refs = await prisma.compraInventoryMovementReference.findMany({
      where: { compraId: compra.id },
    });
    assert.equal(refs.length, 2);
    assert.equal(refs.every((ref) => ref.compraId === compra.id), true);
    const idempotency = await prisma.inventoryIdempotency.findMany({
      where: { key: { startsWith: `purchase-receive:${compra.id}:` } },
    });
    assert.equal(idempotency.length, 2);
    const movements = await prisma.inventoryMovement.findMany({
      where: { id: { in: refs.map((ref) => ref.inventoryMovementId) } },
    });
    assert.equal(movements.length, 2);
    const stocks = await prisma.inventoryStock.findMany({
      where: { warehouseId, articuloId: { in: [first.id, second.id] } },
      select: { articuloId: true, quantity: true },
    });
    assert.deepEqual(
      new Map(stocks.map((row) => [row.articuloId, row.quantity.toNumber()])),
      new Map([[first.id, 2.5], [second.id, 3]]),
    );
  });

  it("rolls back item-N writes after item 1 when idempotency conflicts", async () => {
    const first = await createArticulo("KG");
    const second = await createArticulo("KG");
    const compra = await createCompra([
      { articuloId: first.id, requestedQuantity: "1", unit: "KG" },
      { articuloId: second.id, requestedQuantity: "2", unit: "KG" },
    ]);
    const conflictingKey = `purchase-receive:${compra.id}:${compra.items[1]!.id}`;
    await prisma.inventoryIdempotency.create({
      data: {
        key: conflictingKey,
        operation: "OTHER_OPERATION",
        requestFingerprint: "deliberate-conflict",
        response: {},
      },
    });

    await assert.rejects(
      compras.receive(compra.id, { warehouseId }, actor),
      (error: unknown) => error instanceof AppError && error.code === "IDEMPOTENCY_CONFLICT",
    );
    const persisted = await compras.get(compra.id);
    assert.equal(persisted.status, "REGISTERED");
    assert.equal(await prisma.inventoryMovement.count({ where: { warehouseId, articuloId: { in: [first.id, second.id] } } }), 0);
    assert.equal(await prisma.inventoryStock.count({ where: { warehouseId, articuloId: { in: [first.id, second.id] } } }), 0);
    assert.equal(await prisma.inventoryIdempotency.count({
      where: { key: `purchase-receive:${compra.id}:${compra.items[0]!.id}` },
    }), 0);
    assert.equal(await prisma.inventoryIdempotency.count({ where: { key: conflictingKey } }), 1);
    assert.equal(await prisma.compraInventoryMovementReference.count({ where: { compraId: compra.id } }), 0);
    assert.equal(await prisma.auditLog.count({ where: { resourceType: "Compra", resourceId: compra.id, action: "COMPRA_RECEIVED" } }), 0);
  });

  it("handles existing and new entries atomically in trusted Inventory batches", async () => {
    const first = await createArticulo("KG");
    const second = await createArticulo("KG");
    const third = await createArticulo("KG");
    const uow = new SharedUnitOfWork(prisma);
    const trusted = createTrustedIntermoduleContext(actor);
    const prefix = `inventory-batch-${randomUUID()}`;
    const seedKey = `${prefix}:seed`;
    const newKey = `${prefix}:new`;
    directInventoryKeys.push(seedKey, newKey);

    const seeded = await uow.execute((transaction) => inventory.registerInbounds({
      warehouseId,
      entries: [{
        articuloId: first.id,
        quantity: "1",
        unit: "KG",
        idempotencyKey: seedKey,
      }],
    }, trusted, transaction));
    assert.equal(seeded.length, 1);

    const mixed = await uow.execute((transaction) => inventory.registerInbounds({
      warehouseId,
      entries: [
        {
          articuloId: first.id,
          quantity: "1",
          unit: "KG",
          idempotencyKey: seedKey,
        },
        {
          articuloId: second.id,
          quantity: "2",
          unit: "KG",
          idempotencyKey: newKey,
        },
      ],
    }, trusted, transaction));
    assert.deepEqual(
      mixed.map((result) => result.movementId),
      [seeded[0]!.movementId, mixed[1]!.movementId],
    );
    assert.notEqual(mixed[1]!.movementId, seeded[0]!.movementId);
    assert.equal(await prisma.inventoryMovement.count({ where: { warehouseId, articuloId: first.id } }), 1);
    assert.equal(await prisma.inventoryMovement.count({ where: { warehouseId, articuloId: second.id } }), 1);
    assert.equal((await prisma.inventoryStock.findFirstOrThrow({
      where: { warehouseId, articuloId: first.id },
    })).quantity.toString(), "1");
    assert.equal((await prisma.inventoryStock.findFirstOrThrow({
      where: { warehouseId, articuloId: second.id },
    })).quantity.toString(), "2");

    const allExisting = await uow.execute((transaction) => inventory.registerInbounds({
      warehouseId,
      entries: [
        {
          articuloId: first.id,
          quantity: "1",
          unit: "KG",
          idempotencyKey: seedKey,
        },
        {
          articuloId: second.id,
          quantity: "2",
          unit: "KG",
          idempotencyKey: newKey,
        },
      ],
    }, trusted, transaction));
    assert.deepEqual(
      allExisting.map((result) => result.movementId),
      mixed.map((result) => result.movementId),
    );
    assert.equal(await prisma.inventoryMovement.count({
      where: { warehouseId, articuloId: { in: [first.id, second.id] } },
    }), 2);

    const thirdItemKey = `${prefix}:third`;
    directInventoryKeys.push(thirdItemKey);
    await assert.rejects(
      uow.execute((transaction) => inventory.registerInbounds({
        warehouseId,
        entries: [
          {
            articuloId: third.id,
            quantity: "3",
            unit: "KG",
            idempotencyKey: thirdItemKey,
          },
          {
            articuloId: first.id,
            quantity: "9",
            unit: "KG",
            idempotencyKey: seedKey,
          },
        ],
      }, trusted, transaction)),
      (error: unknown) => error instanceof AppError && error.code === "IDEMPOTENCY_CONFLICT",
    );
    assert.equal(await prisma.inventoryMovement.count({ where: { warehouseId, articuloId: third.id } }), 0);
    assert.equal(await prisma.inventoryStock.count({ where: { warehouseId, articuloId: third.id } }), 0);
    assert.equal(await prisma.inventoryIdempotency.count({ where: { key: thirdItemKey } }), 0);
    assert.equal(await prisma.inventoryMovement.count({
      where: { warehouseId, articuloId: first.id },
    }), 1);
    assert.equal(await prisma.inventoryIdempotency.count({ where: { key: seedKey } }), 1);
  });

  it("keeps deterministic idempotency and rejects a repeated receive", async () => {
    const articulo = await createArticulo("KG");
    const compra = await createCompra([
      { articuloId: articulo.id, requestedQuantity: "1", unit: "KG" },
    ]);
    await compras.receive(compra.id, { warehouseId }, actor);
    await assert.rejects(
      compras.receive(compra.id, { warehouseId }, actor),
      (error: unknown) => error instanceof AppError && error.code === "COMPRA_NOT_RECEIVABLE",
    );
    const keys = await prisma.inventoryIdempotency.findMany({
      where: { key: { startsWith: `purchase-receive:${compra.id}:` } },
      select: { key: true },
    });
    assert.deepEqual(keys.map((row) => row.key), [`purchase-receive:${compra.id}:${compra.items[0]!.id}`]);
  });

  it("allows only one concurrent conditional receive claim", async () => {
    const articulo = await createArticulo("KG");
    const compra = await createCompra([
      { articuloId: articulo.id, requestedQuantity: "1", unit: "KG" },
    ]);
    const attempts = await Promise.allSettled([
      compras.receive(compra.id, { warehouseId }, actor),
      compras.receive(compra.id, { warehouseId }, actor),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    const rejected = attempts.find((attempt) => attempt.status === "rejected");
    assert.ok(rejected && rejected.reason instanceof AppError);
    assert.equal((rejected as PromiseRejectedResult).reason.code, "COMPRA_NOT_RECEIVABLE");
    assert.equal((await compras.get(compra.id)).status, "RECEIVED");
  });

  it("allows one winner when receive and cancel race", async () => {
    const articulo = await createArticulo("KG");
    const compra = await createCompra([
      { articuloId: articulo.id, requestedQuantity: "1", unit: "KG" },
    ]);
    const attempts = await Promise.allSettled([
      compras.receive(compra.id, { warehouseId }, actor),
      compras.cancel(compra.id, { reason: "Race cancellation" }, actor),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
    const finalCompra = await compras.get(compra.id);
    assert.ok(finalCompra.status === "RECEIVED" || finalCompra.status === "CANCELLED");
    const movementCount = await prisma.inventoryMovement.count({
      where: { warehouseId, articuloId: articulo.id },
    });
    assert.equal(movementCount, finalCompra.status === "RECEIVED" ? 1 : 0);
  });

  it("stores cancellation reason only in audit metadata and conditionally transitions", async () => {
    const articulo = await createArticulo("KG");
    const compra = await createCompra([
      { articuloId: articulo.id, requestedQuantity: "1", unit: "KG" },
    ]);
    const cancelled = await compras.cancel(compra.id, { reason: "Supplier withdrew" }, actor);
    assert.equal(cancelled.status, "CANCELLED");
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { resourceType: "Compra", resourceId: compra.id, action: "COMPRA_CANCELLED" },
    });
    assert.equal((audit.metadata as { cancellationReason: string }).cancellationReason, "Supplier withdrew");
    assert.equal(cancelled.observations, null);
    await assert.rejects(
      compras.cancel(compra.id, { reason: "again" }, actor),
      (error: unknown) => error instanceof AppError && error.code === "COMPRA_NOT_CANCELLABLE",
    );
  });

  it("allows receive with a compras actor without inventory:inbound", async () => {
    const articulo = await createArticulo("KG");
    const compra = await createCompra([
      { articuloId: articulo.id, requestedQuantity: "1", unit: "KG" },
    ]);
    const noInventoryPermission = { actorUserId, requestId: randomUUID() };
    const received = await compras.receive(compra.id, { warehouseId }, noInventoryPermission);
    assert.equal(received.status, "RECEIVED");
  });
});