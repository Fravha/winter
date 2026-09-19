import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client.js";
import { AuditService } from "../src/core/audit/audit.service.js";
import { PrismaAuditRepository } from "../src/core/audit/prisma-audit.repository.js";
import { ArticuloService } from "../src/modules/articulos/articulo.service.js";
import { PrismaArticuloRepository } from "../src/modules/articulos/prisma-articulo.repository.js";
import { PrismaArticuloUnitOfWork } from "../src/modules/articulos/prisma-articulo.unit-of-work.js";
import { AttachmentService } from "../src/modules/attachments/attachment.service.js";
import type { AttachmentStorageProvider } from "../src/modules/attachments/attachment.storage.js";
import { InventoryService } from "../src/modules/inventory/inventory.service.js";
import { ProductionService } from "../src/modules/production/production.service.js";
import { getTemporaryProductionDatabaseUrl } from "./helpers/production-test-database.js";

const databaseUrl = getTemporaryProductionDatabaseUrl("P11_E2E_DATABASE_URL");

class FakeStorage implements AttachmentStorageProvider {
  readonly objects = new Map<string, Buffer>();
  readonly signed = new Map<string, number>();

  async upload(key: string, content: Buffer) {
    this.objects.set(key, Buffer.from(content));
  }
  async createSignedDownloadUrl(key: string, expiresInSeconds: number) {
    assert.equal(this.objects.has(key), true);
    this.signed.set(key, expiresInSeconds);
    return `https://signed.invalid/${encodeURIComponent(key)}`;
  }
  async exists(key: string) {
    return this.objects.has(key);
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
}

const decimal = (value: string | Prisma.Decimal) => new Prisma.Decimal(value);
const sum = (values: Array<string | Prisma.Decimal>) => values.reduce((total, value) => total.plus(decimal(value)), decimal("0"));

test("P11 cross-module E2E preserves domain, quantities, trace, audit and attachments", { skip: !databaseUrl }, async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
  const actorUserId = randomUUID();
  const context = { actorUserId, requestId: randomUUID() };
  const audit = new AuditService(new PrismaAuditRepository(prisma));
  const articulos = new ArticuloService(new PrismaArticuloRepository(prisma), new PrismaArticuloUnitOfWork(prisma));
  const inventory = new InventoryService(prisma, articulos);
  const production = new ProductionService(prisma, audit, articulos, inventory);
  const storage = new FakeStorage();
  const attachments = new AttachmentService(prisma, storage);

  try {
    await prisma.user.create({
      data: { id: actorUserId, firebaseUid: `p11-e2e-${actorUserId}`, email: `${actorUserId}@test.invalid`, status: "ACTIVE" },
    });

    const rawArticle = await articulos.createArticulo({
      codigo: `P11-RAW-${randomUUID()}`, nombre: "Uva recibida", clasificacion: "MATERIA_PRIMA", unidadMedida: "KG",
    }, context);
    const outputArticle = await articulos.createArticulo({
      codigo: `P11-OUT-${randomUUID()}`, nombre: "Mosto en proceso", clasificacion: "PRODUCTO_PROCESO", unidadMedida: "KG",
    }, context);
    const order = await production.createOrder({ code: `P11-O-${randomUUID()}`, startDate: new Date("2026-01-02T03:04:05.000Z") }, context);
    const transformationOrder = await production.createTransformationOrder({
      code: `P11-T-${randomUUID()}`, productionOrderId: order.id, periodStart: new Date("2026-01-02T03:04:05.000Z"),
    }, context);
    const producer = await production.create("producers", { code: `P11-P-${randomUUID()}`, name: "Productor E2E" }, context);
    const variety = await production.create("grape-varieties", { code: `P11-V-${randomUUID()}`, name: "Variedad E2E" }, context);
    const participant = await production.create("participants", { code: `P11-PART-${randomUUID()}`, name: "Operador E2E" }, context);
    const workType = await production.create("work-types", { code: `P11-WT-${randomUUID()}`, name: "Prensado" }, context);
    const measurementType = await production.create("measurement-types", { code: `P11-MT-${randomUUID()}`, name: "Brix" }, context);

    const reception = await production.createReception({
      productionOrderId: order.id,
      producerId: producer.id,
      receivedAt: new Date("2026-01-02T04:00:00.000Z"),
      status: "ACCEPTED",
      items: [{ grapeVarietyId: variety.id, articuloId: rawArticle.id, quantity: "10.000", unit: "KG" }],
      operationKey: `p11-reception-${randomUUID()}`,
      requestHash: "p11-reception-v1",
    }, context);
    assert.equal(reception.batchIds.length, 1);
    const inputBatchId = reception.batchIds[0]!;
    assert.equal((await production.getBatchBalance(inputBatchId)).available, "10.000");
    assert.equal(await prisma.auditLog.count({ where: { action: "GRAPE_RECEPTION_CREATED", resourceId: (reception.reception as any).id } }), 1);

    const sourceContainer = await production.createContainer({ code: `P11-C-${randomUUID()}`, capacity: "5.000", capacityUnit: "KG" }, context);
    const destinationContainer = await production.createContainer({ code: `P11-C-${randomUUID()}`, capacity: "5.000", capacityUnit: "KG" }, context);
    const work = await production.createWork({
      productionOrderId: order.id,
      transformationOrderId: transformationOrder.id,
      workTypeId: workType.id,
      performedAt: new Date("2026-01-02T05:00:00.000Z"),
      batchIds: [inputBatchId],
      containerIds: [sourceContainer.id, destinationContainer.id],
      participants: [{ participantId: participant.id, role: "operador" }],
      observations: "E2E principal",
    }, context);
    await production.assignBatchToContainer({
      batchId: inputBatchId, destinationContainerId: sourceContainer.id, quantity: "2.000",
      operationKey: `p11-assign-${randomUUID()}`, requestHash: "assign",
    }, context);
    const partialMoveInput = {
      batchId: inputBatchId, sourceContainerId: sourceContainer.id, destinationContainerId: destinationContainer.id,
      quantity: "1.000", childCode: `P11-CHILD-${randomUUID()}`,
      operationKey: `p11-partial-${randomUUID()}`, requestHash: "partial",
    };
    const partialMove = await production.transferBatchPartiallyBetweenContainers(partialMoveInput, context);
    assert.deepEqual(await production.transferBatchPartiallyBetweenContainers(partialMoveInput, context), partialMove);
    await assert.rejects(
      production.transferBatchPartiallyBetweenContainers({ ...partialMoveInput, requestHash: "changed" }, context),
      (error: any) => error.code === "IDEMPOTENCY_CONFLICT",
    );
    assert.equal(partialMove.child.balance.available, "1.000");

    const totalBatch = await production.createBatch({
      code: `P11-TOTAL-${randomUUID()}`, productionOrderId: order.id, articuloId: rawArticle.id,
      unit: "KG", quantity: "2.000", operationKey: `p11-total-create-${randomUUID()}`, requestHash: "total-create",
    }, context);
    const totalSource = await production.createContainer({ code: `P11-C-${randomUUID()}`, capacity: "2.000", capacityUnit: "KG" }, context);
    const totalDestination = await production.createContainer({ code: `P11-C-${randomUUID()}`, capacity: "2.000", capacityUnit: "KG" }, context);
    await production.assignBatchToContainer({
      batchId: totalBatch.id, destinationContainerId: totalSource.id, quantity: "2.000",
      operationKey: `p11-total-assign-${randomUUID()}`, requestHash: "total-assign",
    }, context);
    const totalMoveInput = {
      batchId: totalBatch.id, sourceContainerId: totalSource.id, destinationContainerId: totalDestination.id,
      operationKey: `p11-total-${randomUUID()}`, requestHash: "total",
    };
    const totalMove = await production.transferBatchBetweenContainers(totalMoveInput, context);
    assert.deepEqual(await production.transferBatchBetweenContainers(totalMoveInput, context), totalMove);
    await assert.rejects(
      production.transferBatchBetweenContainers({ ...totalMoveInput, requestHash: "changed" }, context),
      (error: any) => error.code === "IDEMPOTENCY_CONFLICT",
    );

    const measurement = await production.createMeasurement({
      productionBatchId: inputBatchId,
      productionContainerId: destinationContainer.id,
      productionWorkId: work.id,
      measurementTypeId: measurementType.id,
      participantId: participant.id,
      value: "22.500",
      unit: "%",
      measuredAt: new Date("2026-01-02T06:00:00.000Z"),
      observations: "medición inicial",
    }, context);
    const corrected = await production.correctMeasurement(measurement.id, {
      field: "value", newValue: "23.100", reason: "calibración aprobada", operationKey: `p11-correction-${randomUUID()}`,
    }, context);
    assert.equal(corrected.value, "23.100000");
    const measurementAfterCorrection = await production.getMeasurement(measurement.id);
    assert.equal(measurementAfterCorrection?.corrections.length, 1);
    assert.equal(measurementAfterCorrection?.version, 1);
    assert.equal(measurementAfterCorrection?.corrections[0]?.previousValue, "22.500000");

    const transformation = await production.createTransformation({
      productionOrderId: order.id,
      transformationOrderId: transformationOrder.id,
      productionWorkId: work.id,
      performedAt: new Date("2026-01-02T07:00:00.000Z"),
      operationKey: `p11-transformation-${randomUUID()}`,
      requestHash: "p11-transformation-v1",
      inputs: [{ productionBatchId: inputBatchId, quantity: "2.000" }],
      outputs: [{ articuloId: outputArticle.id, quantity: "1.000", unit: "KG" }],
      losses: [{ productionBatchId: inputBatchId, quantity: "0.500", unit: "KG" }],
      observations: "transformación E2E",
    }, context);
    assert.equal(transformation.inputs.length, 1);
    assert.equal(transformation.outputs.length, 1);
    assert.equal(transformation.losses.length, 1);
    const outputBatchId = transformation.outputs[0]!.productionBatchId;
    const inputBalance = await production.getBatchBalance(inputBatchId);
    assert.equal(inputBalance.available, "6.500");
    const outputBalance = await production.getBatchBalance(outputBatchId);
    assert.equal(outputBalance.available, "1.000");
    const inputLedger = await prisma.productionBatchLedgerEntry.findMany({ where: { productionBatchId: inputBatchId } });
    assert.equal((await prisma.productionBatchLineage.count({ where: { childBatchId: outputBatchId, parentBatchId: inputBatchId } })), 1);

    const warehouse = await prisma.warehouse.create({ data: { codigo: `P11-W-${randomUUID()}`, nombre: "Almacén E2E" } });
    const release = await production.releaseBatchToInventory({
      productionBatchId: outputBatchId, quantity: "0.500", warehouseId: warehouse.id,
      lotCode: `P11-LOT-${randomUUID()}`, classification: "PRODUCTO_ENVASADO",
      fechaIngreso: new Date("2026-01-02T08:00:00.000Z"), operationKey: `p11-release-${randomUUID()}`,
    }, context);
    assert.equal(release.remainingProductionQuantity, "0.500");
    const lot = await prisma.inventoryLot.findUniqueOrThrow({ where: { id: release.inventoryLotId } });
    const movement = await prisma.inventoryMovement.findUniqueOrThrow({ where: { id: release.inventoryMovementId } });
    const stock = await prisma.inventoryStock.findFirstOrThrow({ where: { inventoryLotId: lot.id } });
    assert.equal(lot.originProductionBatchId, outputBatchId);
    assert.equal(movement.source, "PRODUCTION_OUTPUT");
    assert.equal(movement.quantity.toFixed(3), "0.500");
    assert.equal(stock.quantity.toFixed(3), "0.500");
    assert.equal(Number((await production.getBatchBalance(outputBatchId)).available) + Number(stock.quantity), 1);

    const assertConservation = async (
      batchId: string,
      expected: { generated: string; consumed: string; separated: string; lost: string; transferredToInventory: string; available: string },
    ) => {
      const detail = await production.getBatch(batchId);
      assert.ok(detail);
      const balance = detail.balance;
      for (const value of Object.values(expected)) assert.equal(decimal(value).gte(0), true);
      assert.equal(balance.generated, expected.generated);
      assert.equal(balance.consumed, expected.consumed);
      assert.equal(balance.separated, expected.separated);
      assert.equal(balance.lost, expected.lost);
      assert.equal(balance.transferredToInventory, expected.transferredToInventory);
      assert.equal(balance.available, expected.available);
      assert.equal(
        decimal(balance.generated).toFixed(3),
        sum([balance.available, balance.consumed, balance.separated, balance.lost, balance.transferredToInventory]).toFixed(3),
      );
    };
    await assertConservation(inputBatchId, {
      generated: "10.000", consumed: "2.000", separated: "1.000", lost: "0.500", transferredToInventory: "0.000", available: "6.500",
    });
    await assertConservation(partialMove.child.id, {
      generated: "1.000", consumed: "0.000", separated: "0.000", lost: "0.000", transferredToInventory: "0.000", available: "1.000",
    });
    await assertConservation(outputBatchId, {
      generated: "1.000", consumed: "0.000", separated: "0.000", lost: "0.000", transferredToInventory: "0.500", available: "0.500",
    });
    const stocksAtPosition = await prisma.inventoryStock.findMany({
      where: { warehouseId: warehouse.id, articuloId: outputArticle.id, inventoryLotId: lot.id },
    });
    assert.equal(stocksAtPosition.length, 1);
    assert.equal(await prisma.inventoryMovement.count({ where: { inventoryLotId: lot.id } }), 1);
    assert.equal(new Set((await prisma.inventoryMovement.findMany({ where: { inventoryLotId: lot.id }, select: { id: true } })).map(row => row.id)).size, 1);

    const trace = await production.getBatchTrace(outputBatchId);
    assert.ok(trace.receptions.some(item => item.items.some(row => row.productionBatchId === inputBatchId)));
    assert.ok(trace.works.some(item => item.id === work.id));
    assert.ok(trace.measurements.some(item => item.id === measurement.id && item.corrections.length === 1));
    assert.ok(trace.transformations.some(item => item.id === transformation.id));
    assert.ok(trace.losses.some(item => item.productionBatchId === inputBatchId));
    assert.ok(trace.batches.some(item => item.id === outputBatchId));
    assert.ok(trace.containers.some(item => [sourceContainer.id, destinationContainer.id].includes(item.id)));
    assert.ok(trace.containers.some(item => item.occupancies.some(occupancy => occupancy.batchId === inputBatchId)));
    assert.ok(trace.containers.some(item => item.movements.length > 0));
    assert.ok(trace.inventory.lots.some(item => item.id === lot.id));
    assert.ok(trace.inventory.movements.some(item => item.id === movement.id && item.inventoryLotId === lot.id));
    assert.ok(trace.inventory.stocks.some(item => item.id === stock.id && item.inventoryLotId === lot.id));
    assert.equal(trace.warnings.length, 0);
    assert.equal(JSON.stringify(trace).includes("requestHash"), false);

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const attachment = await attachments.create({
      entityType: "PRODUCTION_WORK", entityId: work.id, actorUserId,
      observations: "evidencia E2E",
      file: { originalname: "evidence.jpg", mimetype: "image/jpeg", size: jpeg.length, buffer: jpeg },
    });
    const attachmentRow = await prisma.attachment.findUniqueOrThrow({ where: { id: attachment.id } });
    assert.equal(attachmentRow.fileSize, jpeg.length);
    assert.equal(attachmentRow.storageProvider, "SUPABASE");
    assert.equal(await storage.exists(attachmentRow.storageKey), true);
    assert.equal(await attachments.downloadUrl(attachment.id, 300), `https://signed.invalid/${encodeURIComponent(attachmentRow.storageKey)}`);
    assert.equal(storage.signed.get(attachmentRow.storageKey), 300);
    assert.equal(await prisma.auditLog.count({ where: { action: "ATTACHMENT_CREATED", resourceId: attachment.id } }), 1);
    assert.equal(JSON.stringify(attachmentRow).includes("signed.invalid"), false);

    const firstPage = await production.listBatches({ page: 1, pageSize: 1, productionOrderId: order.id });
    const secondPage = await production.listBatches({ page: 2, pageSize: 1, productionOrderId: order.id });
    assert.equal(firstPage.pagination.page, 1);
    assert.equal(firstPage.pagination.pageSize, 1);
    assert.equal(firstPage.items.length, 1);
    assert.equal(secondPage.items.length, 1);
    assert.notEqual(firstPage.items[0]?.id, secondPage.items[0]?.id);
    assert.deepEqual(
      await production.listBatches({ page: 1, pageSize: 1, productionOrderId: order.id }),
      firstPage,
    );
    const filteredWorks = await production.listWorks({ page: 1, pageSize: 10, productionOrderId: order.id });
    assert.ok(filteredWorks.items.some(item => item.id === work.id));
    assert.equal((await production.listTransformations({ page: 1, pageSize: 10, productionOrderId: order.id })).items.some(item => item.id === transformation.id), true);
    assert.equal((await production.listBatches({ productionOrderId: randomUUID() })).items.length, 0);
    await assert.rejects(production.getBatch(randomUUID()), (error: any) => error.code === "BATCH_NOT_FOUND");
    assert.equal(await production.getOrder(randomUUID()), null);

    await production.closeTransformationOrder(transformationOrder.id, context);
    await production.closeOrder(order.id, context);
    assert.equal((await production.getOrder(order.id))?.status, "CLOSED");
    assert.equal((await production.getTransformationOrder(transformationOrder.id))?.status, "CLOSED");
    assert.equal(await prisma.auditLog.count({ where: { actorUserId, action: "PRODUCTION_ORDER_CLOSED", resourceId: order.id } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { actorUserId, action: "TRANSFORMATION_ORDER_CLOSED", resourceId: transformationOrder.id } }), 1);
  } finally {
    await prisma.$disconnect();
  }
});