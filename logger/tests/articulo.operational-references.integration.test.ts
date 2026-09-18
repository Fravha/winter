import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { ArticuloService } from "../src/modules/articulos/articulo.service.js";
import { PrismaArticuloRepository } from "../src/modules/articulos/prisma-articulo.repository.js";
import { PrismaArticuloUnitOfWork } from "../src/modules/articulos/prisma-articulo.unit-of-work.js";
import { AppError } from "../src/shared/errors/app-error.js";

const connectionString = process.env.WINTER_DATABASE_URL;
let databaseReady = false;
if (connectionString) {
  const probe = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const rows = await probe.$queryRaw<Array<{ exists: number }>>`SELECT 1 AS exists FROM information_schema.columns WHERE table_name = 'production_orders' AND column_name = 'code'`;
    databaseReady = rows.length > 0;
  } catch {
    databaseReady = false;
  } finally {
    await probe.$disconnect();
  }
}
const describeWithDatabase = databaseReady ? describe : describe.skip;

describeWithDatabase("Articulo operational references integration", () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: connectionString! }),
  });
  const repository = new PrismaArticuloRepository(prisma);
  const service = new ArticuloService(
    repository,
    new PrismaArticuloUnitOfWork(prisma),
  );
  const actorUserId = randomUUID();
  const context = { actorUserId, requestId: randomUUID() };

  before(async () => {
    await prisma.user.create({
      data: {
        id: actorUserId,
        firebaseUid: `articulo-integration-${actorUserId}`,
        email: `${actorUserId}@integration.test`,
        status: "ACTIVE",
      },
    });
  });

  after(async () => {
    await prisma.auditLog.deleteMany({ where: { actorUserId } });
    await prisma.user.delete({ where: { id: actorUserId } });
    await prisma.$disconnect();
  });

  for (const consumer of ["inventory", "compras", "production"] as const) {
    it(`locks operational fields for a persisted ${consumer} reference`, async () => {
      const suffix = randomUUID();
      const articulo = await service.createArticulo({
        codigo: `INTEGRATION-${suffix}`,
        nombre: "Nombre original",
        clasificacion: "MATERIA_PRIMA",
        unidadMedida: "KG",
      }, context);

      let warehouseId: string | undefined;
      let purchaseId: string | undefined;
      let productionOrderId: string | undefined;
      let productionWorkId: string | undefined;

      try {
        if (consumer === "inventory") {
          const warehouse = await prisma.warehouse.create({
            data: { codigo: `WH-${suffix}`, nombre: "Integration warehouse" },
          });
          warehouseId = warehouse.id;
          await prisma.inventoryMovement.create({
            data: {
              type: "INBOUND",
              source: "integration-test",
              articuloId: articulo.id,
              warehouseId,
              quantity: "1",
              unit: "KG",
              stockBefore: "0",
              resultingStock: "1",
            },
          });
        } else if (consumer === "compras") {
          const purchase = await prisma.purchase.create({
            data: {
              id: randomUUID(),
              reference: `PUR-${suffix}`,
              supplierName: "Integration supplier",
              total: "1",
              purchasedAt: new Date(),
            },
          });
          purchaseId = purchase.id;
          await prisma.purchaseLine.create({
            data: {
              purchaseId,
              articuloId: articulo.id,
              quantity: "1",
              unit: "KG",
            },
          });
        } else {
          const order = await prisma.productionOrder.create({
            data: { code: `PROD-${suffix}`, startDate: new Date() },
          });
          productionOrderId = order.id;
          const work = await prisma.productionWork.create({
            data: { productionOrderId },
          });
          productionWorkId = work.id;
          await prisma.productionWorkInput.create({
            data: {
              productionWorkId,
              articuloId: articulo.id,
              quantity: "1",
              unit: "KG",
            },
          });
        }

        await assert.rejects(
          service.updateArticulo(
            articulo.id,
            { clasificacion: "INSUMO_ENOLOGICO" },
            context,
          ),
          isImmutableOperationalFieldsError,
        );
        await assert.rejects(
          service.updateArticulo(
            articulo.id,
            { unidadMedida: "G" },
            context,
          ),
          isImmutableOperationalFieldsError,
        );

        const updated = await service.updateArticulo(
          articulo.id,
          { nombre: `Nombre actualizado por ${consumer}` },
          context,
        );
        assert.equal(updated.nombre, `Nombre actualizado por ${consumer}`);
      } finally {
        await prisma.auditLog.deleteMany({
          where: { resourceType: "articulo", resourceId: articulo.id },
        });
        await prisma.inventoryMovement.deleteMany({
          where: { articuloId: articulo.id },
        });
        await prisma.purchaseLine.deleteMany({
          where: { articuloId: articulo.id },
        });
        await prisma.productionWorkInput.deleteMany({
          where: { articuloId: articulo.id },
        });
        if (productionWorkId) {
          await prisma.productionWork.delete({
            where: { id: productionWorkId },
          });
        }
        if (productionOrderId) {
          await prisma.productionOrder.delete({
            where: { id: productionOrderId },
          });
        }
        if (purchaseId) {
          await prisma.purchase.delete({ where: { id: purchaseId } });
        }
        if (warehouseId) {
          await prisma.warehouse.delete({ where: { id: warehouseId } });
        }
        await prisma.articulo.delete({ where: { id: articulo.id } });
      }
    });
  }
});

function isImmutableOperationalFieldsError(error: unknown) {
  return error instanceof AppError
    && error.code === "ARTICULO_OPERATIONAL_FIELDS_IMMUTABLE"
    && error.statusCode === 409;
}