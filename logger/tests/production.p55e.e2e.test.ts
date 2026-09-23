import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import express from "express";
import { AddressInfo } from "node:net";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client.js";
import { createProductionRouter } from "../src/modules/production/production.routes.js";
import type { AuthenticatedUser, TokenVerifier } from "../src/core/auth/auth.types.js";
import type { UserRepository } from "../src/core/users/user.repository.js";
import { AuditService } from "../src/core/audit/audit.service.js";
import { PrismaAuditRepository } from "../src/core/audit/prisma-audit.repository.js";
import { ArticuloService } from "../src/modules/articulos/articulo.service.js";
import { PrismaArticuloRepository } from "../src/modules/articulos/prisma-articulo.repository.js";
import { PrismaArticuloUnitOfWork } from "../src/modules/articulos/prisma-articulo.unit-of-work.js";
import { InventoryService } from "../src/modules/inventory/inventory.service.js";
import { createTrustedIntermoduleContext } from "../src/modules/inventory/inventory.model.js";
import {
  canonicalProductionWorkInputRequest,
} from "../src/modules/production/production.work.js";
import {
  canonicalContainerAssignmentRequest,
  canonicalContainerPartialTransferRequest,
  canonicalContainerTransferRequest,
} from "../src/modules/production/production.container.js";
import { ProductionService } from "../src/modules/production/production.service.js";
import { resetProductionTestDatabase } from "./helpers/reset-production-test-database.js";

const connectionString = process.env.P55A_DATABASE_URL;
if (!connectionString) throw new Error("P55A_DATABASE_URL is required");
const databaseUrl = new URL(connectionString);
if (
  databaseUrl.hostname !== "127.0.0.1" ||
  decodeURIComponent(databaseUrl.pathname.slice(1)) !== "winter_p55_test"
) {
  throw new Error("P55A_DATABASE_URL must point to 127.0.0.1/winter_p55_test");
}

const stable = (value: unknown): string =>
  value === null || typeof value !== "object"
    ? JSON.stringify(value)
    : Array.isArray(value)
      ? `[${value.map(stable).join(",")}]`
      : `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
const digest = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");
const decimal = (value: string | Prisma.Decimal) => new Prisma.Decimal(value);

const receptionHash = (data: {
  productionOrderId: string;
  producerId?: string;
  receivedAt: Date;
  status: "ACCEPTED";
  observations?: string;
  items: Array<{ grapeVarietyId: string; articuloId: string; quantity: string; unit: string }>;
}) => createHash("sha256").update(JSON.stringify({
  productionOrderId: data.productionOrderId,
  producerId: data.producerId ?? null,
  receivedAt: data.receivedAt.toISOString(),
  status: data.status,
  observations: data.observations ?? null,
  items: data.items.map(item => ({
    grapeVarietyId: item.grapeVarietyId,
    articuloId: item.articuloId,
    quantity: decimal(item.quantity).toFixed(3),
    unit: item.unit,
  })),
  customFields: [],
})).digest("hex");

const transformationHash = (data: {
  productionOrderId: string;
  transformationOrderId: string;
  productionWorkId: string;
  performedAt: Date;
  observations: string;
  operationKey: string;
  inputs: Array<{ productionBatchId: string; quantity: string }>;
  outputs: Array<{ articuloId: string; quantity: string; unit: string }>;
  losses: Array<{ productionBatchId: string; quantity: string; unit: string; operationKey?: string; observations?: string }>;
}) => createHash("sha256").update(JSON.stringify({
  productionOrderId: data.productionOrderId.trim(),
  transformationOrderId: data.transformationOrderId.trim(),
  productionWorkId: data.productionWorkId.trim(),
  performedAt: data.performedAt.toISOString(),
  observations: data.observations.trim(),
  operationKey: data.operationKey.trim(),
  inputs: data.inputs.map(item => ({ productionBatchId: item.productionBatchId.trim(), quantity: decimal(item.quantity).toFixed(3) })),
  outputs: data.outputs.map(item => ({ articuloId: item.articuloId.trim(), quantity: decimal(item.quantity).toFixed(3), unit: item.unit.trim(), observations: null })),
  losses: data.losses.map(item => ({
    productionBatchId: item.productionBatchId?.trim() ?? null,
    quantity: decimal(item.quantity).toFixed(3),
    unit: item.unit.trim(),
    operationKey: item.operationKey?.trim() ?? null,
    observations: item.observations?.trim() ?? null,
  })),
})).digest("hex");

test("P5.5E real PostgreSQL end-to-end Production closure", async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const actorUserId = randomUUID();
  const context = { actorUserId, requestId: `p55e-${randomUUID()}` };
  const inventoryContext = {
    ...context,
    permissions: ["inventory:inbound", "inventory:lot_classify"] as const,
  };
  const audit = new AuditService(new PrismaAuditRepository(prisma));
  const articulos = new ArticuloService(new PrismaArticuloRepository(prisma), new PrismaArticuloUnitOfWork(prisma));
  const inventory = new InventoryService(prisma, articulos);
  const production = new ProductionService(prisma, audit, articulos, inventory);

  await resetProductionTestDatabase(prisma);
  try {
    await prisma.user.create({
      data: { id: actorUserId, firebaseUid: `p55e-${actorUserId}`, email: `${actorUserId}@p55e.test`, status: "ACTIVE" },
    });

    const grapeArticle = await articulos.createArticulo({
      codigo: `P55E-GRAPE-${randomUUID()}`, nombre: "Uva Malbec", clasificacion: "MATERIA_PRIMA", unidadMedida: "KG",
    }, context);
    const inputArticle = await articulos.createArticulo({
      codigo: `P55E-INPUT-${randomUUID()}`, nombre: "Bentonita", clasificacion: "MATERIA_PRIMA", unidadMedida: "KG",
    }, context);
    const outputArticle = await articulos.createArticulo({
      codigo: `P55E-OUTPUT-${randomUUID()}`, nombre: "Vino base E2E", clasificacion: "PRODUCTO_TERMINADO", unidadMedida: "KG",
    }, context);
    const order = await production.createOrder({ code: `P55E-O-${randomUUID()}`, startDate: new Date("2026-02-01T03:00:00.000Z") }, context);
    const transformationOrder = await production.createTransformationOrder({
      code: `P55E-T-${randomUUID()}`, productionOrderId: order.id, periodStart: new Date("2026-02-01T03:00:00.000Z"),
    }, context);
    const producer = await production.create("producers", { code: `P55E-P-${randomUUID()}`, name: "Productor dinámico E2E" }, context);
    const variety = await production.create("grape-varieties", { code: `P55E-V-${randomUUID()}`, name: "Malbec dinámico E2E" }, context);
    const workType = await production.create("work-types", { code: `P55E-WT-${randomUUID()}`, name: "Clarificación dinámica E2E" }, context);
    const participant = await production.create("participants", { code: `P55E-PART-${randomUUID()}`, name: "Operador E2E" }, context);
    const measurementType = await production.create("measurement-types", { code: `P55E-MT-${randomUUID()}`, name: "Temperatura E2E" }, context);

    const receptionData = {
      productionOrderId: order.id,
      producerId: producer.id,
      receivedAt: new Date("2026-02-01T04:00:00.000Z"),
      status: "ACCEPTED" as const,
      items: [{ grapeVarietyId: variety.id, articuloId: grapeArticle.id, quantity: "1000.000", unit: "KG" }],
      operationKey: `p55e-reception-${randomUUID()}`,
    };
    const reception = await production.createReception({
      ...receptionData,
      requestHash: receptionHash(receptionData),
    }, context);
    assert.equal(reception.batchIds.length, 1);
    const batchId = reception.batchIds[0]!;
    const receptionRow = await prisma.grapeReception.findUniqueOrThrow({ where: { id: (reception.reception as { id: string }).id } });
    assert.equal(receptionRow.status, "ACCEPTED");
    assert.equal(receptionRow.producerId, producer.id);
    assert.equal(receptionRow.actorUserId, actorUserId);
    assert.equal(receptionRow.productionOrderId, order.id);
    assert.equal(receptionRow.receivedAt.toISOString(), "2026-02-01T04:00:00.000Z");
    assert.equal((await prisma.grapeReceptionItem.findUniqueOrThrow({ where: { productionBatchId: batchId } })).quantity.toFixed(3), "1000.000");
    assert.equal((await production.getBatchBalance(batchId)).available, "1000.000");
    assert.equal(await prisma.grapeReceptionItem.count({ where: { productionBatchId: batchId, grapeVarietyId: variety.id } }), 1);

    const warehouse = await prisma.warehouse.create({ data: { codigo: `P55E-W-${randomUUID()}`, nombre: "Almacén E2E" } });
    await inventory.registerInbound({
      articuloId: inputArticle.id,
      warehouseId: warehouse.id,
      quantity: "10.000",
      unit: "KG",
      source: "P55E_SEED",
      idempotencyKey: `p55e-input-seed-${randomUUID()}`,
    }, inventoryContext);
    assert.equal((await inventory.getStock({ warehouseId: warehouse.id, articuloId: inputArticle.id })).quantity, "10.000");

    const sourceContainer = await production.createContainer({ code: `P55E-T04-${randomUUID()}`, name: "T04", type: "TANQUE", capacity: "1000.000", capacityUnit: "KG" }, context);
    const totalDestination = await production.createContainer({ code: `P55E-T07-${randomUUID()}`, name: "T07", type: "TANQUE", capacity: "1000.000", capacityUnit: "KG" }, context);
    const partialDestination = await production.createContainer({ code: `P55E-T08-${randomUUID()}`, name: "T08", type: "BARRICA", capacity: "300.000", capacityUnit: "KG" }, context);
    assert.equal(partialDestination.type, "BARRICA");
    const work = await production.createWork({
      productionOrderId: order.id,
      transformationOrderId: transformationOrder.id,
      workTypeId: workType.id,
      performedAt: new Date("2026-02-01T05:00:00.000Z"),
      batchIds: [batchId],
      containerIds: [sourceContainer.id, totalDestination.id, partialDestination.id],
      participants: [{ participantId: participant.id, role: "operador" }],
      observations: "Trabajo E2E; la observación es narrativa",
    }, context);

    const workInput = {
      articuloId: inputArticle.id,
      warehouseId: warehouse.id,
      quantity: "2.000",
      unit: "KG" as const,
      operationKey: `p55e-input-${randomUUID()}`,
      observations: "Bentonita agregada durante clarificación",
    };
    const inputResult = await production.createWorkInput(work.id, {
      ...workInput,
      requestHash: digest(canonicalProductionWorkInputRequest(workInput)),
    }, context);
    const inputRow = await prisma.productionWorkInput.findUniqueOrThrow({ where: { id: inputResult.id } });
    const inputMovement = await prisma.inventoryMovement.findUniqueOrThrow({ where: { id: inputRow.inventoryMovementId! } });
    assert.equal(inputRow.quantity.toFixed(3), "2.000");
    assert.equal(inputRow.unit, "KG");
    assert.equal(inputMovement.source, "PRODUCTION_CONSUMPTION");
    assert.equal(inputMovement.type, "OUTBOUND");
    assert.equal(inputRow.observations, workInput.observations);
    assert.equal((await inventory.getStock({ warehouseId: warehouse.id, articuloId: inputArticle.id })).quantity, "8.000");

    const measurement = await production.createMeasurement({
      productionBatchId: batchId,
      productionContainerId: sourceContainer.id,
      productionWorkId: work.id,
      measurementTypeId: measurementType.id,
      participantId: participant.id,
      value: "18.500",
      unit: "°C",
      measuredAt: new Date("2026-02-01T05:30:00.000Z"),
      observations: "Medición inicial narrativa",
    }, context);
    const measurementRow = await prisma.productionMeasurement.findUniqueOrThrow({ where: { id: measurement.id } });
    assert.equal(measurementRow.value.toFixed(3), "18.500");
    assert.equal(measurementRow.unit, "°C");
    assert.equal(measurementRow.measurementTypeId, measurementType.id);
    assert.equal(measurementRow.participantId, participant.id);
    assert.equal(measurementRow.measuredAt.toISOString(), "2026-02-01T05:30:00.000Z");
    assert.equal(measurementRow.productionBatchId, batchId);
    assert.equal(measurementRow.productionContainerId, sourceContainer.id);
    assert.equal(measurementRow.productionWorkId, work.id);

    const assignment = {
      batchId, destinationContainerId: sourceContainer.id, quantity: "300.000",
      operationKey: `p55e-assign-${randomUUID()}`,
    };
    const assignmentResult = await production.assignBatchToContainer({
      ...assignment,
      requestHash: digest(canonicalContainerAssignmentRequest(assignment)),
    }, context);
    assert.equal(assignmentResult.occupancy.quantity, "300.000");
    assert.equal((await production.getContainer(sourceContainer.id)).status, "OCUPADO");
    assert.equal(await prisma.productionBatchContainerMovement.count({
      where: { movementType: "ASSIGNED", destinationContainerId: sourceContainer.id, sourceBatchId: batchId },
    }), 1);

    const totalTransfer = {
      batchId, sourceContainerId: sourceContainer.id, destinationContainerId: totalDestination.id,
      operationKey: `p55e-total-${randomUUID()}`,
    };
    const totalResult = await production.transferBatchBetweenContainers({
      ...totalTransfer,
      requestHash: digest(canonicalContainerTransferRequest(totalTransfer)),
    }, context);
    assert.equal(totalResult.occupancy.containerId, totalDestination.id);
    const sourceOccupancyAfterTotal = await prisma.productionContainerOccupancy.findFirstOrThrow({ where: { containerId: sourceContainer.id, batchId }, orderBy: { openedAt: "desc" } });
    assert.ok(sourceOccupancyAfterTotal.closedAt);
    assert.equal((await production.getContainer(totalDestination.id)).status, "OCUPADO");
    assert.equal(await prisma.productionContainerOccupancy.count({ where: { containerId: sourceContainer.id, batchId, closedAt: null } }), 0);
    assert.equal(await prisma.productionContainerOccupancy.count({ where: { containerId: totalDestination.id, batchId, closedAt: null } }), 1);
    assert.equal(await prisma.productionBatchContainerMovement.count({
      where: {
        movementType: "TRANSFERRED",
        sourceContainerId: sourceContainer.id,
        destinationContainerId: totalDestination.id,
        sourceBatchId: batchId,
      },
    }), 1);

    const partialTransfer = {
      batchId, sourceContainerId: totalDestination.id, destinationContainerId: partialDestination.id,
      quantity: "100.000", childCode: `P55E-CHILD-${randomUUID()}`,
      operationKey: `p55e-partial-${randomUUID()}`,
    };
    const partialResult = await production.transferBatchPartiallyBetweenContainers({
      ...partialTransfer,
      requestHash: digest(canonicalContainerPartialTransferRequest(partialTransfer)),
    }, context);
    assert.equal(partialResult.child.balance.available, "100.000");
    assert.equal(partialResult.source.quantity, "200.000");
    assert.equal(partialResult.destination.quantity, "100.000");
    assert.equal(await prisma.productionBatchLineage.count({ where: { parentBatchId: batchId, childBatchId: partialResult.child.id } }), 1);
    assert.equal(await prisma.productionBatchContainerMovement.count({ where: { movementType: "PARTIAL_TRANSFERRED", sourceBatchId: batchId, destinationBatchId: partialResult.child.id } }), 1);
    assert.equal(await prisma.productionContainerOccupancy.count({ where: { containerId: totalDestination.id, batchId, closedAt: null } }), 1);
    assert.equal(await prisma.productionContainerOccupancy.count({ where: { containerId: partialDestination.id, batchId: partialResult.child.id, closedAt: null } }), 1);
    assert.equal(await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: batchId, entryType: "SEPARATED", quantity: new Prisma.Decimal("100.000") } }), 1);
    assert.equal(await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: partialResult.child.id, entryType: "GENERATED", quantity: new Prisma.Decimal("100.000") } }), 1);
    assert.equal((await production.getContainer(totalDestination.id)).status, "OCUPADO");
    assert.equal((await production.getContainer(partialDestination.id)).status, "OCUPADO");

    const transformationData = {
      productionOrderId: order.id,
      transformationOrderId: transformationOrder.id,
      productionWorkId: work.id,
      performedAt: new Date("2026-02-01T07:00:00.000Z"),
      operationKey: `p55e-transformation-${randomUUID()}`,
      observations: "Transformación E2E narrativa",
      inputs: [{ productionBatchId: batchId, quantity: "500.000" }],
      outputs: [{ articuloId: outputArticle.id, quantity: "500.000", unit: "KG" }],
      losses: [{ productionBatchId: batchId, quantity: "20.000", unit: "KG", observations: "Pérdida de proceso" }],
    };
    const transformation = await production.createTransformation({
      ...transformationData,
      requestHash: transformationHash(transformationData),
    }, context);
    assert.deepEqual(await production.createTransformation({
      ...transformationData,
      requestHash: transformationHash(transformationData),
    }, context), transformation);
    assert.equal(transformation.inputs[0]?.quantity, "500.000");
    assert.equal(transformation.outputs[0]?.quantity, "500.000");
    assert.equal(transformation.losses[0]?.quantity, "20.000");
    const outputBatchId = transformation.outputs[0]!.productionBatchId;
    assert.equal(await prisma.productionLoss.count({ where: { transformationId: transformation.id, productionBatchId: batchId } }), 1);
    assert.equal((await production.getBatchBalance(batchId)).available, "380.000");
    assert.equal(await prisma.productionBatchLineage.count({ where: { parentBatchId: batchId, childBatchId: outputBatchId } }), 1);
    assert.equal(await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: outputBatchId, entryType: "GENERATED", quantity: new Prisma.Decimal("500.000") } }), 1);
    assert.equal((await production.getBatchBalance(outputBatchId)).available, "500.000");

    const unrelatedOrder = await production.createOrder({ code: `P55E-UNRELATED-${randomUUID()}`, startDate: new Date() }, context);
    const unrelatedBatch = await production.createBatch({
      code: `P55E-UNRELATED-BATCH-${randomUUID()}`, productionOrderId: unrelatedOrder.id, articuloId: outputArticle.id,
      unit: "KG", quantity: "1.000", operationKey: `p55e-unrelated-${randomUUID()}`, requestHash: "seed",
    }, context);

    const firstReleaseInput = {
      productionBatchId: outputBatchId, quantity: "100.000", warehouseId: warehouse.id,
      lotCode: `P55E-CLASSIFY-${randomUUID()}`, classification: "PRODUCTO_ENVASADO",
      fechaIngreso: new Date("2026-02-01T08:00:00.000Z"), operationKey: `p55e-release-classify-${randomUUID()}`,
    };
    const firstRelease = await production.releaseBatchToInventory(firstReleaseInput, context);
    assert.deepEqual(await production.releaseBatchToInventory(firstReleaseInput, context), firstRelease);
    assert.equal((await prisma.inventoryLot.findUniqueOrThrow({ where: { id: firstRelease.inventoryLotId } })).classification, "PRODUCTO_ENVASADO");
    assert.equal(await prisma.inventoryMovement.count({
      where: { id: firstRelease.inventoryMovementId, type: "INBOUND", source: "PRODUCTION_OUTPUT" },
    }), 1);
    assert.equal((await production.listReleases(outputBatchId)).filter(item => item.releaseId === firstRelease.releaseId).length, 1);
    assert.equal((await production.getBatch(outputBatchId))!.balance.transferredToInventory, "100.000");
    assert.equal(await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: outputBatchId, entryType: "TRANSFERRED_TO_INVENTORY", quantity: new Prisma.Decimal("100.000") } }), 1);
    assert.equal((await prisma.inventoryStock.findFirstOrThrow({ where: { inventoryLotId: firstRelease.inventoryLotId } })).quantity.toFixed(3), "100.000");
    const classified = await inventory.transitionInventoryLotClassification({
      inventoryLotId: firstRelease.inventoryLotId,
      classification: "PRODUCTO_TERMINADO",
      idempotencyKey: `p55e-classify-${randomUUID()}`,
    }, inventoryContext);
    assert.equal((classified as { classification: string }).classification, "PRODUCTO_TERMINADO");
    assert.equal(await prisma.auditLog.count({ where: { action: "INVENTORY_LOT_CLASSIFIED", resourceId: firstRelease.inventoryLotId, actorUserId } }), 1);
    assert.equal((await prisma.inventoryLot.findUniqueOrThrow({ where: { id: firstRelease.inventoryLotId } })).classification, "PRODUCTO_TERMINADO");

    const reversibleReleaseInput = {
      productionBatchId: outputBatchId, quantity: "100.000", warehouseId: warehouse.id,
      lotCode: `P55E-REVERSIBLE-${randomUUID()}`, classification: "PRODUCTO_ENVASADO",
      fechaIngreso: new Date("2026-02-01T08:05:00.000Z"), operationKey: `p55e-release-reversible-${randomUUID()}`,
    };
    const reversibleRelease = await production.releaseBatchToInventory(reversibleReleaseInput, context);
    assert.deepEqual(await production.releaseBatchToInventory(reversibleReleaseInput, context), reversibleRelease);
    const reversalInput = { operationKey: `p55e-reversal-${randomUUID()}`, reason: "Corrección operativa E2E" };
    const reversal = await production.reverseRelease(outputBatchId, reversibleRelease.releaseId, reversalInput, context);
    assert.equal(reversal.remainingProductionQuantity, "400.000");
    assert.deepEqual(await production.reverseRelease(outputBatchId, reversibleRelease.releaseId, reversalInput, context), reversal);
    assert.equal(await prisma.productionInventoryRelease.count({ where: { id: reversibleRelease.releaseId } }), 1);
    assert.equal(await prisma.productionInventoryReversal.count({ where: { releaseId: reversibleRelease.releaseId } }), 1);
    assert.equal(await prisma.inventoryMovement.count({ where: { inventoryLotId: reversibleRelease.inventoryLotId } }), 2);
    assert.equal((await prisma.inventoryStock.findFirstOrThrow({ where: { inventoryLotId: reversibleRelease.inventoryLotId } })).quantity.toFixed(3), "0.000");
    assert.equal(await prisma.auditLog.count({ where: { action: "PRODUCTION_BATCH_RELEASE_REVERSED", resourceId: reversibleRelease.releaseId } }), 1);
    const releaseHistory = await production.listReleases(outputBatchId);
    assert.equal(releaseHistory.length, 2);
    assert.equal(releaseHistory.find(item => item.releaseId === firstRelease.releaseId)?.status, "ACTIVE");
    assert.equal(releaseHistory.find(item => item.releaseId === reversibleRelease.releaseId)?.reversal?.inventoryMovementId, reversal.inventoryMovementId);
    assert.equal((await production.getBatch(outputBatchId))!.balance.transferredToInventory, "100.000");
    assert.equal(await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: outputBatchId, entryType: "INVENTORY_RELEASE_RESTORED", quantity: new Prisma.Decimal("100.000") } }), 1);

    const assertConservation = async (batchIdToCheck: string, expected: {
      generated: string; consumed: string; separated: string; lost: string; transferredToInventory: string; available: string;
    }) => {
      const detail = await production.getBatch(batchIdToCheck);
      assert.ok(detail);
      const balance = detail.balance;
      assert.deepEqual(balance, {
        productionBatchId: batchIdToCheck,
        generated: expected.generated,
        consumed: expected.consumed,
        separated: expected.separated,
        lost: expected.lost,
        transferredToInventory: expected.transferredToInventory,
        available: expected.available,
        ledgerVersion: balance.ledgerVersion,
        updatedAt: balance.updatedAt,
      });
      const total = ["available", "consumed", "separated", "lost", "transferredToInventory"]
        .reduce((sum, key) => sum.plus(new Prisma.Decimal(balance[key as keyof typeof balance] as string)), new Prisma.Decimal(0));
      assert.equal(total.toFixed(3), new Prisma.Decimal(balance.generated as string).toFixed(3));
    };
    await assertConservation(batchId, {
      generated: "1000.000", consumed: "500.000", separated: "100.000", lost: "20.000",
      transferredToInventory: "0.000", available: "380.000",
    });
    await assertConservation(outputBatchId, {
      generated: "500.000", consumed: "0.000", separated: "0.000", lost: "0.000",
      transferredToInventory: "100.000", available: "400.000",
    });

    const unrelatedTransformationOrder = await production.createTransformationOrder({
      code: `P55E-UNRELATED-T-${randomUUID()}`, productionOrderId: unrelatedOrder.id, periodStart: new Date(),
    }, context);
    const unrelatedReceptionData = {
      productionOrderId: unrelatedOrder.id,
      producerId: producer.id,
      receivedAt: new Date("2026-02-02T04:00:00.000Z"),
      status: "ACCEPTED" as const,
      items: [{ grapeVarietyId: variety.id, articuloId: grapeArticle.id, quantity: "10.000", unit: "KG" }],
      operationKey: `p55e-unrelated-reception-${randomUUID()}`,
    };
    const unrelatedReception = await production.createReception({
      ...unrelatedReceptionData,
      requestHash: receptionHash(unrelatedReceptionData),
    }, context);
    const unrelatedReceptionBatchId = unrelatedReception.batchIds[0]!;
    const unrelatedSource = await production.createContainer({ code: `P55E-UNRELATED-C1-${randomUUID()}`, type: "TANQUE", capacity: "20.000", capacityUnit: "KG" }, context);
    const unrelatedDestination = await production.createContainer({ code: `P55E-UNRELATED-C2-${randomUUID()}`, type: "BARRICA", capacity: "20.000", capacityUnit: "KG" }, context);
    const unrelatedWork = await production.createWork({
      productionOrderId: unrelatedOrder.id,
      transformationOrderId: unrelatedTransformationOrder.id,
      workTypeId: workType.id,
      performedAt: new Date("2026-02-02T05:00:00.000Z"),
      batchIds: [unrelatedReceptionBatchId],
      containerIds: [unrelatedSource.id, unrelatedDestination.id],
      participants: [{ participantId: participant.id, role: "operador" }],
      observations: "Trabajo no relacionado",
    }, context);
    const unrelatedMeasurement = await production.createMeasurement({
      productionBatchId: unrelatedReceptionBatchId,
      productionContainerId: unrelatedSource.id,
      productionWorkId: unrelatedWork.id,
      measurementTypeId: measurementType.id,
      participantId: participant.id,
      value: "19.000",
      unit: "°C",
      measuredAt: new Date("2026-02-02T05:30:00.000Z"),
      observations: "Medición no relacionada",
    }, context);
    const unrelatedAssignment = {
      batchId: unrelatedReceptionBatchId, destinationContainerId: unrelatedSource.id, quantity: "1.000",
      operationKey: `p55e-unrelated-assign-${randomUUID()}`,
    };
    await production.assignBatchToContainer({
      ...unrelatedAssignment,
      requestHash: digest(canonicalContainerAssignmentRequest(unrelatedAssignment)),
    }, context);
    const unrelatedTotal = {
      batchId: unrelatedReceptionBatchId, sourceContainerId: unrelatedSource.id, destinationContainerId: unrelatedDestination.id,
      operationKey: `p55e-unrelated-total-${randomUUID()}`,
    };
    await production.transferBatchBetweenContainers({
      ...unrelatedTotal,
      requestHash: digest(canonicalContainerTransferRequest(unrelatedTotal)),
    }, context);
    const unrelatedTransformationData = {
      productionOrderId: unrelatedOrder.id,
      transformationOrderId: unrelatedTransformationOrder.id,
      productionWorkId: unrelatedWork.id,
      performedAt: new Date("2026-02-02T07:00:00.000Z"),
      operationKey: `p55e-unrelated-transformation-${randomUUID()}`,
      observations: "Transformación no relacionada",
      inputs: [{ productionBatchId: unrelatedReceptionBatchId, quantity: "0.500" }],
      outputs: [{ articuloId: outputArticle.id, quantity: "0.400", unit: "KG" }],
      losses: [{ productionBatchId: unrelatedReceptionBatchId, quantity: "0.100", unit: "KG", observations: "Pérdida no relacionada" }],
    };
    const unrelatedTransformation = await production.createTransformation({
      ...unrelatedTransformationData,
      requestHash: transformationHash(unrelatedTransformationData),
    }, context);
    const unrelatedLossId = (await prisma.productionLoss.findFirstOrThrow({ where: { transformationId: unrelatedTransformation.id } })).id;
    const unrelatedOutputBatchId = unrelatedTransformation.outputs[0]!.productionBatchId;
    const unrelatedReleaseInput = {
      productionBatchId: unrelatedOutputBatchId, quantity: "0.100", warehouseId: warehouse.id,
      lotCode: `P55E-UNRELATED-LOT-${randomUUID()}`, classification: "PRODUCTO_ENVASADO" as const,
      fechaIngreso: new Date("2026-02-02T08:00:00.000Z"), operationKey: `p55e-unrelated-release-${randomUUID()}`,
    };
    const unrelatedRelease = await production.releaseBatchToInventory(unrelatedReleaseInput, context);

    const trace = await production.getBatchTrace(outputBatchId);
    assert.ok(trace.batches.some(batch => batch.id === outputBatchId));
    assert.ok(trace.batches.some(batch => batch.id === batchId));
    assert.ok(trace.receptions.some(receptionItem => receptionItem.items.some(item => item.productionBatchId === batchId && item.grapeVarietyId === variety.id)));
    assert.ok(trace.works.some(item => item.id === work.id && item.inputs.some(input => input.id === inputResult.id && input.inventoryMovementId === inputMovement.id)));
    assert.ok(trace.measurements.some(item => item.id === measurement.id));
    assert.ok(trace.containers.some(item => item.id === sourceContainer.id && item.occupancies.some(occupancy => occupancy.batchId === batchId && occupancy.closedAt !== null)));
    assert.ok(trace.containers.some(item => item.id === totalDestination.id && item.movements.some(movement => movement.movementType === "TRANSFERRED")));
    assert.ok(trace.containers.some(item => item.id === partialDestination.id && item.movements.some(movement => movement.movementType === "PARTIAL_TRANSFERRED")));
    assert.ok(trace.transformations.some(item => item.id === transformation.id));
    assert.ok(trace.losses.some(item => item.productionBatchId === batchId));
    assert.ok(trace.inventory.lots.some(item => item.id === firstRelease.inventoryLotId));
    assert.ok(trace.inventory.lots.some(item => item.id === reversibleRelease.inventoryLotId));
    assert.ok(trace.inventory.movements.some(item => item.id === firstRelease.inventoryMovementId && item.type === "INBOUND"));
    assert.ok(trace.inventory.movements.some(item => item.id === reversal.inventoryMovementId && item.type === "OUTBOUND"));
    assert.ok(trace.releases.some(item => item.releaseId === firstRelease.releaseId));
    const tracedReversal = trace.releases.find(item => item.releaseId === reversibleRelease.releaseId);
    assert.equal(tracedReversal?.status, "REVERSED");
    assert.equal(tracedReversal?.reversal?.inventoryMovementId, reversal.inventoryMovementId);
    assert.equal(trace.batches.some(batch => batch.id === unrelatedBatch.id), false);
    assert.equal(trace.batches.some(batch => batch.id === unrelatedReceptionBatchId || batch.id === unrelatedOutputBatchId), false);
    assert.equal(trace.lineage.some(edge => edge.childBatchId === unrelatedOutputBatchId || edge.parentBatchId === unrelatedReceptionBatchId), false);
    assert.equal(trace.ledger.some(entry => entry.productionBatchId === unrelatedReceptionBatchId || entry.productionBatchId === unrelatedOutputBatchId), false);
    assert.equal(trace.receptions.some(item => item.id === (unrelatedReception.reception as { id: string }).id), false);
    assert.equal(trace.works.some(item => item.id === unrelatedWork.id), false);
    assert.equal(trace.measurements.some(item => item.id === unrelatedMeasurement.id), false);
    assert.equal(trace.containers.some(item => item.id === unrelatedSource.id || item.id === unrelatedDestination.id), false);
    assert.equal(trace.transformations.some(item => item.id === unrelatedTransformation.id), false);
    assert.equal(trace.losses.some(item => item.id === unrelatedLossId), false);
    assert.equal(trace.releases.some(item => item.releaseId === unrelatedRelease.releaseId), false);
    assert.equal(trace.inventory.lots.some(item => item.id === unrelatedRelease.inventoryLotId), false);
    assert.equal(trace.inventory.movements.some(item => item.id === unrelatedRelease.inventoryMovementId), false);
    assert.equal(trace.inventory.stocks.some(item => item.inventoryLotId === unrelatedRelease.inventoryLotId), false);

    const verifier = {
      async verify() { return { uid: `p55e-${actorUserId}` }; },
    } as unknown as TokenVerifier;
    const httpUser: AuthenticatedUser = {
      id: actorUserId,
      firebaseUid: `p55e-${actorUserId}`,
      email: `${actorUserId}@p55e.test`,
      displayName: "P5.5E",
      status: "ACTIVE",
      lastLoginAt: null,
      roles: [],
      permissions: ["production:read"],
    };
    const users: UserRepository = {
      async findByFirebaseUid() { return httpUser; },
      async updateLastLoginAt() {},
    };
    const app = express();
    app.use(express.json());
    app.use("/api/v1/production", createProductionRouter(verifier, users, production));
    const server = app.listen(0);
    await new Promise<void>(resolve => server.once("listening", resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/production/batches/${outputBatchId}/trace`, {
        headers: { authorization: "Bearer p55e-real-db-e2e" },
      });
      assert.equal(response.status, 200);
      const envelope = await response.json() as { data: typeof trace };
      assert.ok(envelope.data);
      assert.equal(envelope.data.rootBatchId, outputBatchId);
      assert.ok(envelope.data.batches.some(batch => batch.id === outputBatchId));
      assert.ok(envelope.data.transformations.some(item => item.id === transformation.id));
      assert.ok(envelope.data.releases.some(release => release.releaseId === firstRelease.releaseId));
      assert.ok(envelope.data.inventory.lots.some(lot => lot.id === firstRelease.inventoryLotId));
      assert.ok(envelope.data.containers.some(container => container.id === totalDestination.id));
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }

    const workInputFromDb = await prisma.productionWorkInput.findUniqueOrThrow({ where: { id: inputResult.id } });
    assert.equal(workInputFromDb.observations?.includes("2.000"), false);
    assert.equal(workInputFromDb.quantity.toFixed(3), "2.000");
    assert.equal((await prisma.grapeVariety.findUniqueOrThrow({ where: { id: variety.id } })).name.includes("Vino"), false);
    assert.notEqual(grapeArticle.id, outputArticle.id);
    assert.equal((await prisma.articulo.findUniqueOrThrow({ where: { id: grapeArticle.id } })).clasificacion, "MATERIA_PRIMA");
    assert.equal((await prisma.articulo.findUniqueOrThrow({ where: { id: outputArticle.id } })).clasificacion, "PRODUCTO_TERMINADO");
  } finally {
    await resetProductionTestDatabase(prisma);
    await prisma.$disconnect();
  }
});