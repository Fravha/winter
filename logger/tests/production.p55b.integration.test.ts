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
import {
  canonicalContainerAssignmentRequest,
  canonicalContainerPartialTransferRequest,
  canonicalContainerTransferRequest,
} from "../src/modules/production/production.container.js";
import { getTemporaryProductionDatabaseUrl } from "./helpers/production-test-database.js";

const url = getTemporaryProductionDatabaseUrl("P55B_DATABASE_URL");
const run = url ? describe : describe.skip;
const stable = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(stable).join(",")}]`
    : `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
const digest = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");

run("P5.5B container PostgreSQL integration", () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
  const articles = new ArticuloService(new PrismaArticuloRepository(prisma), new PrismaArticuloUnitOfWork(prisma));
  const service = new ProductionService(prisma, new AuditService(new PrismaAuditRepository(prisma)), articles, new InventoryService(prisma, articles));
  const actor = randomUUID();
  const context = { actorUserId: actor, requestId: `p55b-${randomUUID()}` };
  let articleId = "", typeId = "", orderId = "", secondOrderId = "", workId = "", secondWorkId = "";
  const batchIds: string[] = [], containerIds: string[] = [], operationKeys: string[] = [];

  before(async () => {
    await prisma.user.create({ data: { id: actor, firebaseUid: `p55b-${actor}`, email: `${actor}@p55b.test`, status: "ACTIVE" } });
    articleId = (await articles.createArticulo({ codigo: `P55B-${randomUUID()}`, nombre: "Vino base", clasificacion: "PRODUCTO_TERMINADO", unidadMedida: "L" }, context)).id;
    const order = await service.createOrder({ code: `P55B-${randomUUID()}`, startDate: new Date() }, context);
    orderId = order.id;
    secondOrderId = (await service.createOrder({ code: `P55B-${randomUUID()}`, startDate: new Date() }, context)).id;
    typeId = (await service.create("work-types", { code: `P55B-${randomUUID()}`, name: "Traslado" }, context)).id;
    workId = (await service.createWork({ productionOrderId: orderId, workTypeId: typeId, performedAt: new Date() }, context)).id;
    secondWorkId = (await service.createWork({ productionOrderId: secondOrderId, workTypeId: typeId, performedAt: new Date() }, context)).id;
  });

  after(async () => {
    try {
      await dropFailureTrigger();
      await prisma.$executeRawUnsafe("ALTER TABLE production_batch_container_movements DISABLE TRIGGER production_batch_container_movements_append_only");
      await prisma.$executeRawUnsafe("ALTER TABLE production_container_operations DISABLE TRIGGER production_container_operations_append_only");
      await prisma.productionBatchContainerMovement.deleteMany({ where: { OR: [{ sourceContainerId: { in: containerIds } }, { destinationContainerId: { in: containerIds } }] } });
      await prisma.productionContainerOperation.deleteMany({ where: { operationKey: { in: operationKeys } } });
      await prisma.productionContainerOccupancy.deleteMany({ where: { containerId: { in: containerIds } } });
      await prisma.productionContainer.deleteMany({ where: { id: { in: containerIds } } });
      await prisma.$executeRawUnsafe("ALTER TABLE production_container_operations ENABLE TRIGGER production_container_operations_append_only");
      await prisma.$executeRawUnsafe("ALTER TABLE production_batch_container_movements ENABLE TRIGGER production_batch_container_movements_append_only");
      await prisma.productionBatchLedgerEntry.deleteMany({ where: { productionBatchId: { in: batchIds } } });
      await prisma.productionBatch.deleteMany({ where: { id: { in: batchIds } } });
      if (secondWorkId) await prisma.productionWork.delete({ where: { id: secondWorkId } });
      if (workId) await prisma.productionWork.delete({ where: { id: workId } });
      if (secondOrderId) await prisma.productionOrder.delete({ where: { id: secondOrderId } });
      if (orderId) await prisma.productionOrder.delete({ where: { id: orderId } });
      if (typeId) await prisma.workType.delete({ where: { id: typeId } });
      if (articleId) await prisma.articulo.delete({ where: { id: articleId } });
      await prisma.auditLog.deleteMany({ where: { actorUserId: actor } });
      await prisma.user.delete({ where: { id: actor } });
    } finally {
      await prisma.$executeRawUnsafe("ALTER TABLE production_container_operations ENABLE TRIGGER production_container_operations_append_only").catch(() => {});
      await prisma.$executeRawUnsafe("ALTER TABLE production_batch_container_movements ENABLE TRIGGER production_batch_container_movements_append_only").catch(() => {});
      await prisma.$disconnect();
    }
  });

  async function batch(order = orderId, quantity = "1200.000") {
    const row = await service.createBatch({ code: `B-${randomUUID()}`, productionOrderId: order, articuloId: articleId, unit: "L", quantity, operationKey: `p55b-batch-${randomUUID()}`, requestHash: "seed" }, context);
    batchIds.push(row.id);
    return row.id;
  }
  async function container(code: string, capacity = "2000.000", unit = "L") {
    const row = await service.createContainer({ code: `${code}-${randomUUID()}`, name: code === "B-26015" ? "Barrica 26015" : code, type: code === "B-26015" ? "BARRICA" : "TANQUE", capacity, capacityUnit: unit }, context);
    containerIds.push(row.id);
    return row.id;
  }
  function assignData(batchId: string, operationKey = `p55b-assign-${randomUUID()}`, occurredAt?: Date) {
    const data = { batchId, quantity: "1200.000", operationKey, requestHash: "", ...(occurredAt ? { occurredAt } : {}) };
    operationKeys.push(operationKey);
    data.requestHash = digest(canonicalContainerAssignmentRequest({ ...data, destinationContainerId: "00000000-0000-4000-8000-000000000001" }));
    return data;
  }
  function transferData(batchId: string, destinationContainerId: string, operationKey = `p55b-transfer-${randomUUID()}`, extra: Record<string, unknown> = {}) {
    const data = { batchId, destinationContainerId, operationKey, requestHash: "", ...extra };
    operationKeys.push(operationKey);
    data.requestHash = digest(canonicalContainerTransferRequest(data));
    return data;
  }
  function partialData(batchId: string, destinationContainerId: string, operationKey = `p55b-partial-${randomUUID()}`) {
    const data = { batchId, destinationContainerId, quantity: "200.000", childCode: `CHILD-${randomUUID()}`, operationKey, requestHash: "" };
    operationKeys.push(operationKey);
    data.requestHash = digest(canonicalContainerPartialTransferRequest(data));
    return data;
  }
  async function installFailureTrigger() {
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION p55b_fail_occupancy_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'P5.5B Failure C'; END; $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER p55b_fail_occupancy BEFORE INSERT OR UPDATE ON production_container_occupancies FOR EACH ROW EXECUTE FUNCTION p55b_fail_occupancy_fn()`);
  }
  async function dropFailureTrigger() {
    await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS p55b_fail_occupancy ON production_container_occupancies");
    await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS p55b_fail_occupancy_fn()");
  }
  async function assertNoEffects(before: { movement: number; operation: number; occupancy: number; audit: number }, batchIdsToCheck: string[]) {
    assert.equal(await prisma.productionBatchContainerMovement.count(), before.movement);
    assert.equal(await prisma.productionContainerOperation.count(), before.operation);
    assert.equal(await prisma.productionContainerOccupancy.count(), before.occupancy);
    assert.equal(await prisma.auditLog.count({ where: { actorUserId: actor } }), before.audit);
    for (const id of batchIdsToCheck) {
      assert.equal(await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: id } }), 1);
    }
  }

  it("creates and lists the Barrica 26015 metadata", async () => {
    const id = await container("B-26015");
    const listed = await service.listContainers();
    assert.equal(listed.some(item => item.id === id && item.name === "Barrica 26015" && item.type === "BARRICA"), true);
  });

  it("replays exactly and reports a changed correctly-hashed payload as IDEMPOTENCY_CONFLICT", async () => {
    const id = await batch(), source = await container("T-04"), destination = await container("T-07");
    await service.assignBatchToContainer({ ...assignData(id), destinationContainerId: source }, context);
    const transfer = transferData(id, destination);
    const first = await service.transferBatchBetweenContainers({ ...transfer, sourceContainerId: source }, context);
    assert.deepEqual(await service.transferBatchBetweenContainers({ ...transfer, sourceContainerId: source }, context), first);
    const changed = { ...transfer, observations: "changed" };
    changed.requestHash = digest(canonicalContainerTransferRequest(changed));
    await assert.rejects(service.transferBatchBetweenContainers({ ...changed, sourceContainerId: source }, context), (error: any) => error.code === "IDEMPOTENCY_CONFLICT");
  });

  it("rejects a Work from another order without partial effects", async () => {
    const id = await batch(), source = await container("T-08"), destination = await container("T-09");
    await service.assignBatchToContainer({ ...assignData(id), destinationContainerId: source }, context);
    const before = { movement: await prisma.productionBatchContainerMovement.count(), operation: await prisma.productionContainerOperation.count(), occupancy: await prisma.productionContainerOccupancy.count(), audit: await prisma.auditLog.count({ where: { actorUserId: actor } }) };
    const transfer = transferData(id, destination, undefined, { productionWorkId: secondWorkId });
    await assert.rejects(service.transferBatchBetweenContainers({ ...transfer, sourceContainerId: source }, context), (error: any) => error.code === "PROCESS_MOVEMENT_WORK_INCOMPATIBLE");
    await assertNoEffects(before, [id]);
  });

  it("rejects out-of-service, capacity, unit mismatch, and occupied destinations atomically", async () => {
    const outBatch = await batch(), outSource = await container("T-10"), outDest = await container("T-11");
    await service.deactivateContainer(outDest, context);
    const beforeOut = { movement: await prisma.productionBatchContainerMovement.count(), operation: await prisma.productionContainerOperation.count(), occupancy: await prisma.productionContainerOccupancy.count(), audit: await prisma.auditLog.count({ where: { actorUserId: actor } }) };
    await assert.rejects(service.assignBatchToContainer({ ...assignData(outBatch), destinationContainerId: outDest }, context), (error: any) => error.code === "CONTAINER_OUT_OF_SERVICE");
    await assertNoEffects(beforeOut, [outBatch]);
    const capBatch = await batch("".concat(orderId), "1200.000"), capSource = await container("T-12"), capDest = await container("T-13", "1000.000");
    const beforeCap = { movement: await prisma.productionBatchContainerMovement.count(), operation: await prisma.productionContainerOperation.count(), occupancy: await prisma.productionContainerOccupancy.count(), audit: await prisma.auditLog.count({ where: { actorUserId: actor } }) };
    await assert.rejects(service.assignBatchToContainer({ ...assignData(capBatch), destinationContainerId: capDest }, context), (error: any) => /CAPACITY|capacity/i.test(error.code ?? error.message));
    await assertNoEffects(beforeCap, [capBatch]);
    const unitBatch = await batch(), unitDest = await container("T-14", "2000.000", "KG");
    const beforeUnit = { movement: await prisma.productionBatchContainerMovement.count(), operation: await prisma.productionContainerOperation.count(), occupancy: await prisma.productionContainerOccupancy.count(), audit: await prisma.auditLog.count({ where: { actorUserId: actor } }) };
    await assert.rejects(service.assignBatchToContainer({ ...assignData(unitBatch), destinationContainerId: unitDest }, context), (error: any) => /UNIT|unit/i.test(error.code ?? error.message));
    await assertNoEffects(beforeUnit, [unitBatch]);
    const sourceBatch = await batch(), occupiedBatch = await batch(), occupiedSource = await container("T-15"), occupiedDest = await container("T-16");
    await service.assignBatchToContainer({ ...assignData(occupiedBatch), destinationContainerId: occupiedDest }, context);
    await service.assignBatchToContainer({ ...assignData(sourceBatch), destinationContainerId: occupiedSource }, context);
    const beforeOccupied = { movement: await prisma.productionBatchContainerMovement.count(), operation: await prisma.productionContainerOperation.count(), occupancy: await prisma.productionContainerOccupancy.count(), audit: await prisma.auditLog.count({ where: { actorUserId: actor } }) };
    const transfer = transferData(sourceBatch, occupiedDest);
    await assert.rejects(service.transferBatchBetweenContainers({ ...transfer, sourceContainerId: occupiedSource }, context), (error: any) => /OCCUP|occupied/i.test(error.code ?? error.message));
    await assertNoEffects(beforeOccupied, [sourceBatch, occupiedBatch]);
  });

  it("rolls back Failure C after movement for total transfer", async () => {
    const id = await batch(), source = await container("T-17"), destination = await container("T-18");
    await service.assignBatchToContainer({ ...assignData(id), destinationContainerId: source }, context);
    const before = { movement: await prisma.productionBatchContainerMovement.count(), operation: await prisma.productionContainerOperation.count(), occupancy: await prisma.productionContainerOccupancy.count(), audit: await prisma.auditLog.count({ where: { actorUserId: actor } }) };
    const transfer = transferData(id, destination);
    await installFailureTrigger();
    try {
      await assert.rejects(service.transferBatchBetweenContainers({ ...transfer, sourceContainerId: source }, context));
    } finally { await dropFailureTrigger(); }
    await assertNoEffects(before, [id]);
    assert.equal((await service.getContainer(source)).status, "OCUPADO");
    assert.equal((await service.getContainer(destination)).status, "DISPONIBLE");
  });

  it("rolls back Failure C after movement, split, and lineage for partial transfer", async () => {
    const id = await batch(), source = await container("T-19"), destination = await container("T-20");
    await service.assignBatchToContainer({ ...assignData(id), destinationContainerId: source }, context);
    const before = { movement: await prisma.productionBatchContainerMovement.count(), operation: await prisma.productionContainerOperation.count(), occupancy: await prisma.productionContainerOccupancy.count(), audit: await prisma.auditLog.count({ where: { actorUserId: actor } }) };
    const transfer = partialData(id, destination);
    await installFailureTrigger();
    try {
      await assert.rejects(service.transferBatchPartiallyBetweenContainers({ ...transfer, sourceContainerId: source }, context));
    } finally { await dropFailureTrigger(); }
    await assertNoEffects(before, [id]);
    assert.equal(await prisma.productionBatch.count({ where: { code: transfer.childCode } }), 0);
    assert.equal(await prisma.productionBatchLineage.count({ where: { parentBatchId: id } }), 0);
    assert.equal((await service.getContainer(source)).status, "OCUPADO");
    assert.equal((await service.getContainer(destination)).status, "DISPONIBLE");
  });
});