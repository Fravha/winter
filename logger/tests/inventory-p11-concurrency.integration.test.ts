import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { ArticuloService } from "../src/modules/articulos/articulo.service.js";
import { PrismaArticuloRepository } from "../src/modules/articulos/prisma-articulo.repository.js";
import { PrismaArticuloUnitOfWork } from "../src/modules/articulos/prisma-articulo.unit-of-work.js";
import { InventoryService } from "../src/modules/inventory/inventory.service.js";
import { getTemporaryProductionDatabaseUrl } from "./helpers/production-test-database.js";

const connectionString = getTemporaryProductionDatabaseUrl("P11_INVENTORY_DATABASE_URL");
const describeWithDatabase = connectionString ? describe : describe.skip;

describeWithDatabase("P11 Inventory general movement concurrency", () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString! }) });
  const articuloService = new ArticuloService(
    new PrismaArticuloRepository(prisma),
    new PrismaArticuloUnitOfWork(prisma),
  );
  const inventory = new InventoryService(prisma, articuloService);
  const actorUserId = randomUUID();
  const permissions = [
    "inventory:inbound",
    "inventory:outbound",
    "inventory:adjust",
    "inventory:transfer",
  ] as const;
  const context = { actorUserId, permissions };
  const articuloIds: string[] = [];
  const warehouseIds: string[] = [];

  before(async () => {
    await prisma.user.create({
      data: {
        id: actorUserId,
        firebaseUid: `p11-inventory-${actorUserId}`,
        email: `${actorUserId}@p11.test`,
        status: "ACTIVE",
      },
    });
  });

  after(async () => {
    await prisma.auditLog.deleteMany({ where: { actorUserId } });
    await prisma.inventoryIdempotency.deleteMany({
      where: { key: { startsWith: "p11-inventory-" } },
    });
    await prisma.inventoryMovement.deleteMany({ where: { actorUserId } });
    await prisma.inventoryStock.deleteMany({ where: { warehouseId: { in: warehouseIds } } });
    await prisma.warehouse.deleteMany({ where: { id: { in: warehouseIds } } });
    await prisma.articulo.deleteMany({ where: { id: { in: articuloIds } } });
    await prisma.user.delete({ where: { id: actorUserId } });
    await prisma.$disconnect();
  });

  async function fixture() {
    const articulo = await articuloService.createArticulo({
      codigo: `P11-${randomUUID()}`,
      nombre: "P11 concurrency article",
      clasificacion: "MATERIA_PRIMA",
      unidadMedida: "KG",
    }, { actorUserId });
    articuloIds.push(articulo.id);
    const source = await prisma.warehouse.create({
      data: { codigo: `P11-S-${randomUUID()}`, nombre: "P11 source" },
    });
    const destination = await prisma.warehouse.create({
      data: { codigo: `P11-D-${randomUUID()}`, nombre: "P11 destination" },
    });
    warehouseIds.push(source.id, destination.id);
    return { articuloId: articulo.id, sourceWarehouseId: source.id, destinationWarehouseId: destination.id };
  }

  async function stock(warehouseId: string, articuloId: string) {
    const result = await inventory.getStock({ warehouseId, articuloId });
    return result.quantity;
  }

  async function assertUniquePosition(warehouseId: string, articuloId: string) {
    assert.equal(
      await prisma.inventoryStock.count({ where: { warehouseId, articuloId, inventoryLotId: null } }),
      1,
    );
  }

  async function seedInbound(
    articuloId: string,
    warehouseId: string,
    quantity: string,
    key: string,
  ) {
    await inventory.registerInbound({
      articuloId,
      warehouseId,
      quantity,
      unit: "KG",
      source: "P11_SEED",
      idempotencyKey: key,
    }, context);
  }

  it("serializes concurrent inbound writes without duplicate positions or lost updates", async () => {
    const { articuloId, sourceWarehouseId } = await fixture();
    await Promise.all([
      inventory.registerInbound({ articuloId, warehouseId: sourceWarehouseId, quantity: "1", unit: "KG", source: "P11", idempotencyKey: `p11-inventory-inbound-a-${randomUUID()}` }, context),
      inventory.registerInbound({ articuloId, warehouseId: sourceWarehouseId, quantity: "1", unit: "KG", source: "P11", idempotencyKey: `p11-inventory-inbound-b-${randomUUID()}` }, context),
    ]);
    assert.equal(await stock(sourceWarehouseId, articuloId), "2.000");
    assert.equal(await prisma.inventoryStock.count({ where: { warehouseId: sourceWarehouseId, articuloId, inventoryLotId: null } }), 1);
    assert.equal(await prisma.inventoryMovement.count({ where: { warehouseId: sourceWarehouseId, articuloId, type: "INBOUND" } }), 2);
  });

  it("serializes concurrent outbound writes and preserves exact remaining stock", async () => {
    const { articuloId, sourceWarehouseId } = await fixture();
    await seedInbound(articuloId, sourceWarehouseId, "10", `p11-inventory-outbound-seed-${randomUUID()}`);
    await Promise.all([
      inventory.registerOutbound({ articuloId, warehouseId: sourceWarehouseId, quantity: "1", unit: "KG", source: "P11", idempotencyKey: `p11-inventory-outbound-a-${randomUUID()}` }, context),
      inventory.registerOutbound({ articuloId, warehouseId: sourceWarehouseId, quantity: "1", unit: "KG", source: "P11", idempotencyKey: `p11-inventory-outbound-b-${randomUUID()}` }, context),
    ]);
    assert.equal(await stock(sourceWarehouseId, articuloId), "8.000");
    await assertUniquePosition(sourceWarehouseId, articuloId);
    assert.equal(await prisma.inventoryMovement.count({ where: { warehouseId: sourceWarehouseId, articuloId, type: "OUTBOUND" } }), 2);
    const row = await prisma.inventoryStock.findFirstOrThrow({ where: { warehouseId: sourceWarehouseId, articuloId, inventoryLotId: null } });
    assert.ok(Number(row.quantity) >= 0);
  });

  it("serializes concurrent adjustments on the same stock position", async () => {
    const { articuloId, sourceWarehouseId } = await fixture();
    await Promise.all([
      inventory.registerAdjustment({ articuloId, warehouseId: sourceWarehouseId, quantity: "1", unit: "KG", source: "P11", direction: "INCREASE", idempotencyKey: `p11-inventory-adjust-a-${randomUUID()}` }, context),
      inventory.registerAdjustment({ articuloId, warehouseId: sourceWarehouseId, quantity: "1", unit: "KG", source: "P11", direction: "INCREASE", idempotencyKey: `p11-inventory-adjust-b-${randomUUID()}` }, context),
    ]);
    assert.equal(await stock(sourceWarehouseId, articuloId), "2.000");
    await assertUniquePosition(sourceWarehouseId, articuloId);
    assert.equal(await prisma.inventoryMovement.count({ where: { warehouseId: sourceWarehouseId, articuloId, type: "ADJUSTMENT" } }), 2);
  });

  it("serializes concurrent transfers and conserves total quantity", async () => {
    const { articuloId, sourceWarehouseId, destinationWarehouseId } = await fixture();
    await seedInbound(articuloId, sourceWarehouseId, "10", `p11-inventory-transfer-seed-${randomUUID()}`);
    await Promise.all([
      inventory.registerTransfer({ articuloId, sourceWarehouseId, destinationWarehouseId, quantity: "1", unit: "KG", source: "P11", idempotencyKey: `p11-inventory-transfer-a-${randomUUID()}` }, context),
      inventory.registerTransfer({ articuloId, sourceWarehouseId, destinationWarehouseId, quantity: "1", unit: "KG", source: "P11", idempotencyKey: `p11-inventory-transfer-b-${randomUUID()}` }, context),
    ]);
    assert.equal(await stock(sourceWarehouseId, articuloId), "8.000");
    assert.equal(await stock(destinationWarehouseId, articuloId), "2.000");
    await assertUniquePosition(sourceWarehouseId, articuloId);
    await assertUniquePosition(destinationWarehouseId, articuloId);
    assert.equal(await prisma.inventoryMovement.count({ where: { articuloId, type: "TRANSFER" } }), 2);
    assert.equal(Number(await stock(sourceWarehouseId, articuloId)) + Number(await stock(destinationWarehouseId, articuloId)), 10);
  });

  it("completes opposing transfers without leaking a PostgreSQL deadlock", async () => {
    const { articuloId, sourceWarehouseId, destinationWarehouseId } = await fixture();
    await seedInbound(articuloId, sourceWarehouseId, "10", `p11-inventory-opposing-seed-a-${randomUUID()}`);
    await seedInbound(articuloId, destinationWarehouseId, "10", `p11-inventory-opposing-seed-b-${randomUUID()}`);
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION p11_transfer_contention_barrier()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        PERFORM pg_sleep(0.75);
        RETURN NEW;
      END;
      $$;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER p11_transfer_contention_trigger
      BEFORE UPDATE ON inventory_stocks
      FOR EACH ROW EXECUTE FUNCTION p11_transfer_contention_barrier();
    `);
    try {
      await Promise.all([
        inventory.registerTransfer({ articuloId, sourceWarehouseId, destinationWarehouseId, quantity: "1", unit: "KG", source: "P11", idempotencyKey: `p11-inventory-opposing-a-${randomUUID()}` }, context),
        inventory.registerTransfer({ articuloId, sourceWarehouseId: destinationWarehouseId, destinationWarehouseId: sourceWarehouseId, quantity: "1", unit: "KG", source: "P11", idempotencyKey: `p11-inventory-opposing-b-${randomUUID()}` }, context),
      ]);
    } finally {
      await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS p11_transfer_contention_trigger ON inventory_stocks");
      await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS p11_transfer_contention_barrier()");
    }
    assert.equal(await stock(sourceWarehouseId, articuloId), "10.000");
    assert.equal(await stock(destinationWarehouseId, articuloId), "10.000");
    await assertUniquePosition(sourceWarehouseId, articuloId);
    await assertUniquePosition(destinationWarehouseId, articuloId);
    assert.equal(await prisma.inventoryMovement.count({ where: { articuloId, type: "TRANSFER" } }), 2);
  });
});