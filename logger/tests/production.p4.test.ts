import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { AuditService } from "../src/core/audit/audit.service.js";
import { PrismaAuditRepository } from "../src/core/audit/prisma-audit.repository.js";
import { ProductionService } from "../src/modules/production/production.service.js";
import {
  canonicalContainerAssignmentRequest,
  canonicalContainerPartialTransferRequest,
  canonicalContainerTransferRequest,
  ProductionContainerService,
} from "../src/modules/production/production.container.js";
import { createTemporaryProductionDatabaseResource } from "./helpers/production-test-database.js";

const database = createTemporaryProductionDatabaseResource("P4_DATABASE_URL", connectionString => ({
  connectionString,
  createClient: () => new PrismaClient({ adapter: new PrismaPg({ connectionString }) }),
}));
const connectionString = database?.connectionString;
const stable = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(stable).join(",")}]`
    : `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
const digest = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");
const assignmentHash = (data: any) => digest(canonicalContainerAssignmentRequest(data));
const transferHash = (data: any) => digest(canonicalContainerTransferRequest(data));
const partialHash = (data: any) => digest(canonicalContainerPartialTransferRequest(data));
let available = false;
if (database) {
  const probe = database.createClient();
  try { await probe.$queryRaw`SELECT 1 FROM production_container_operations LIMIT 1`; available = true; } catch { available = false; }
  await probe.$disconnect();
}
const integrationOptions = available ? {} : { skip: "requires P4_DATABASE_URL with the P4 migration applied" };
if (connectionString && !available) throw new Error("P4_DATABASE_URL was supplied but the P4 migration/database is unavailable");

describe("Production P4 PostgreSQL", () => {
  const prisma = database?.createClient();
  const actorUserId = randomUUID();
  const context = { actorUserId, requestId: randomUUID() };
  const service = prisma ? new ProductionService(prisma, new AuditService(new PrismaAuditRepository(prisma))) : undefined;
  let orderId = "";

  before(async () => {
    if (!available || !prisma || !service) return;
    await prisma.user.create({ data: { id: actorUserId, firebaseUid: `p4-${actorUserId}`, email: `${actorUserId}@test.invalid`, status: "ACTIVE" } });
    orderId = (await service.createOrder({ code: `P4-${randomUUID()}`, startDate: new Date() }, context)).id;
  });
  after(async () => { if (prisma) await prisma.$disconnect(); });

  it("assigns, transfers totally, then transfers partially through P3 split", integrationOptions, async () => {
    assert.ok(service);
    const batch = await service.createBatch({ code: `P4-B-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "KG", quantity: "10.000", operationKey: `p4-create-${randomUUID()}`, requestHash: "p4" }, context);
    const source = await service.createContainer({ code: `P4-C-${randomUUID()}`, capacity: "10.000", capacityUnit: "KG" }, context);
    const middle = await service.createContainer({ code: `P4-C-${randomUUID()}`, capacity: "10.000", capacityUnit: "KG" }, context);
    const destination = await service.createContainer({ code: `P4-C-${randomUUID()}`, capacity: "10.000", capacityUnit: "KG" }, context);
    const assign = { batchId: batch.id, destinationContainerId: source.id, quantity: "6.000", operationKey: `p4-assign-${randomUUID()}` };
    await service.assignBatchToContainer({ ...assign, requestHash: assignmentHash(assign) }, context);
    const total = { batchId: batch.id, sourceContainerId: source.id, destinationContainerId: middle.id, operationKey: `p4-total-${randomUUID()}` };
    await service.transferBatchBetweenContainers({ ...total, requestHash: transferHash(total) }, context);
    const partial = { batchId: batch.id, sourceContainerId: middle.id, destinationContainerId: destination.id, quantity: "2.000", childCode: `P4-CH-${randomUUID()}`, operationKey: `p4-partial-${randomUUID()}` };
    const result = await service.transferBatchPartiallyBetweenContainers({ ...partial, requestHash: partialHash(partial) }, context);
    assert.equal(result.source.quantity, "4.000");
    assert.equal(result.destination.quantity, "2.000");
    assert.equal(result.child.balance.available, "2.000");
    assert.equal((await service.getContainer(source.id)).status, "DISPONIBLE");
    assert.equal((await service.getContainer(destination.id)).status, "OCUPADO");
  });

  it("rejects occupied and out-of-service destinations", integrationOptions, async () => {
    assert.ok(service);
    const batch = await service.createBatch({ code: `P4-B-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "L", quantity: "2.000", operationKey: `p4-create-${randomUUID()}`, requestHash: "p4" }, context);
    const other = await service.createBatch({ code: `P4-B-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "L", quantity: "2.000", operationKey: `p4-create-${randomUUID()}`, requestHash: "p4" }, context);
    const occupied = await service.createContainer({ code: `P4-C-${randomUUID()}`, capacity: "2.000", capacityUnit: "L" }, context);
    const source = await service.createContainer({ code: `P4-C-${randomUUID()}`, capacity: "2.000", capacityUnit: "L" }, context);
    const occupiedSeed = { batchId: other.id, destinationContainerId: occupied.id, quantity: "1.000", operationKey: `p4-assign-${randomUUID()}` };
    await service.assignBatchToContainer({ ...occupiedSeed, requestHash: assignmentHash(occupiedSeed) }, context);
    const occupiedAttempt = { batchId: batch.id, destinationContainerId: occupied.id, quantity: "1.000", operationKey: `p4-assign-${randomUUID()}` };
    await assert.rejects(service.assignBatchToContainer({ ...occupiedAttempt, requestHash: assignmentHash(occupiedAttempt) }, context), (error: any) => error.code === "CONTAINER_OCCUPIED");
    await service.deactivateContainer(source.id, context);
    const outAttempt = { batchId: batch.id, destinationContainerId: source.id, quantity: "1.000", operationKey: `p4-assign-${randomUUID()}` };
    await assert.rejects(service.assignBatchToContainer({ ...outAttempt, requestHash: assignmentHash(outAttempt) }, context), (error: any) => error.code === "CONTAINER_OUT_OF_SERVICE");
  });

  it("protects open container allocations from P3 reductions", integrationOptions, async () => {
    assert.ok(service);
    const batch = await service.createBatch({ code: `P4-B-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "KG", quantity: "5.000", operationKey: `p4-create-${randomUUID()}`, requestHash: "allocation" }, context);
    const container = await service.createContainer({ code: `P4-C-${randomUUID()}`, capacity: "5.000", capacityUnit: "KG" }, context);
    const allocation = { batchId: batch.id, destinationContainerId: container.id, quantity: "3.000", operationKey: `p4-assign-${randomUUID()}` };
    await service.assignBatchToContainer({ ...allocation, requestHash: assignmentHash(allocation) }, context);
    await assert.rejects(service.consumeBatch({ batchId: batch.id, quantity: "3.000", unit: "KG", operationKey: `p4-consume-${randomUUID()}`, requestHash: "allocation" }, context), (error: any) => error.code === "INSUFFICIENT_BATCH_QUANTITY");
    await service.consumeBatch({ batchId: batch.id, quantity: "1.000", unit: "KG", operationKey: `p4-consume-${randomUUID()}`, requestHash: "allocation" }, context);
    await assert.rejects(service.splitBatch({ parentBatchId: batch.id, children: [{ code: `P4-CH-${randomUUID()}`, quantity: "2.000" }], operationKey: `p4-split-${randomUUID()}`, requestHash: "allocation" }, context), (error: any) => error.code === "INSUFFICIENT_BATCH_QUANTITY");
    const split = await service.splitBatch({ parentBatchId: batch.id, children: [{ code: `P4-CH-${randomUUID()}`, quantity: "1.000" }], operationKey: `p4-split-${randomUUID()}`, requestHash: "allocation" }, context);
    assert.equal(split.parent.available, "3.000");
  });

  it("allows one batch across containers and reopens summed same-container occupancy", integrationOptions, async () => {
    assert.ok(service);
    const batch = await service.createBatch({ code: `P4-B-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "KG", quantity: "5.000", operationKey: `p4-create-${randomUUID()}`, requestHash: "same-batch" }, context);
    const first = await service.createContainer({ code: `P4-C-${randomUUID()}`, capacity: "4.000", capacityUnit: "KG" }, context);
    const second = await service.createContainer({ code: `P4-C-${randomUUID()}`, capacity: "4.000", capacityUnit: "KG" }, context);
    for (const move of [
      { batchId: batch.id, destinationContainerId: first.id, quantity: "2.000", operationKey: `p4-assign-${randomUUID()}` },
      { batchId: batch.id, destinationContainerId: second.id, quantity: "2.000", operationKey: `p4-assign-${randomUUID()}` },
      { batchId: batch.id, destinationContainerId: first.id, quantity: "1.000", operationKey: `p4-assign-${randomUUID()}` },
    ]) await service.assignBatchToContainer({ ...move, requestHash: assignmentHash(move) }, context);
    const firstView = await service.getContainer(first.id);
    assert.equal(firstView.occupancies.filter((item) => item.closedAt === null).length, 1);
    assert.equal(firstView.occupancies.find((item) => item.closedAt === null)?.quantity, "3.000");
    assert.equal((await service.getContainer(second.id)).occupancies.find((item) => item.closedAt === null)?.quantity, "2.000");
  });

  it("rejects backdated occupancy-closing operations", integrationOptions, async () => {
    assert.ok(service);
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now());
    const addBatch = await service.createBatch({ code: `P4-B-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "KG", quantity: "4.000", operationKey: `p4-create-${randomUUID()}`, requestHash: "dates" }, context);
    const addContainer = await service.createContainer({ code: `P4-C-${randomUUID()}`, capacity: "4.000", capacityUnit: "KG" }, context);
    const addFuture = { batchId: addBatch.id, destinationContainerId: addContainer.id, quantity: "1.000", operationKey: `p4-assign-${randomUUID()}`, occurredAt: future };
    await service.assignBatchToContainer({ ...addFuture, requestHash: assignmentHash(addFuture) }, context);
    const addPast = { ...addFuture, operationKey: `p4-assign-${randomUUID()}`, occurredAt: past };
    await assert.rejects(service.assignBatchToContainer({ ...addPast, requestHash: assignmentHash(addPast) }, context), (error: any) => error.code === "INVALID_CONTAINER_OPERATION");
    const totalBatch = await service.createBatch({ code: `P4-B-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "KG", quantity: "4.000", operationKey: `p4-create-${randomUUID()}`, requestHash: "dates" }, context);
    const totalSource = await service.createContainer({ code: `P4-C-${randomUUID()}`, capacity: "4.000", capacityUnit: "KG" }, context);
    const totalDest = await service.createContainer({ code: `P4-C-${randomUUID()}`, capacity: "4.000", capacityUnit: "KG" }, context);
    const totalFuture = { batchId: totalBatch.id, destinationContainerId: totalSource.id, quantity: "1.000", operationKey: `p4-assign-${randomUUID()}`, occurredAt: future };
    await service.assignBatchToContainer({ ...totalFuture, requestHash: assignmentHash(totalFuture) }, context);
    const totalPast = { batchId: totalBatch.id, sourceContainerId: totalSource.id, destinationContainerId: totalDest.id, operationKey: `p4-total-${randomUUID()}`, occurredAt: past };
    await assert.rejects(service.transferBatchBetweenContainers({ ...totalPast, requestHash: transferHash(totalPast) }, context), (error: any) => error.code === "INVALID_CONTAINER_OPERATION");
    const partialBatch = await service.createBatch({ code: `P4-B-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "KG", quantity: "4.000", operationKey: `p4-create-${randomUUID()}`, requestHash: "dates" }, context);
    const partialSource = await service.createContainer({ code: `P4-C-${randomUUID()}`, capacity: "4.000", capacityUnit: "KG" }, context);
    const partialDest = await service.createContainer({ code: `P4-C-${randomUUID()}`, capacity: "4.000", capacityUnit: "KG" }, context);
    const partialFuture = { batchId: partialBatch.id, destinationContainerId: partialSource.id, quantity: "2.000", operationKey: `p4-assign-${randomUUID()}`, occurredAt: future };
    await service.assignBatchToContainer({ ...partialFuture, requestHash: assignmentHash(partialFuture) }, context);
    const partialPast = { batchId: partialBatch.id, sourceContainerId: partialSource.id, destinationContainerId: partialDest.id, quantity: "1.000", childCode: `P4-CH-${randomUUID()}`, operationKey: `p4-partial-${randomUUID()}`, occurredAt: past };
    await assert.rejects(service.transferBatchPartiallyBetweenContainers({ ...partialPast, requestHash: partialHash(partialPast) }, context), (error: any) => error.code === "INVALID_CONTAINER_OPERATION");
  });

  it("replays idempotent assignments, rejects conflicts, and protects historical facts", integrationOptions, async () => {
    assert.ok(service && prisma);
    const batch = await service.createBatch({ code: `P4-B-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "KG", quantity: "3.000", operationKey: `p4-create-${randomUUID()}`, requestHash: "p4" }, context);
    const container = await service.createContainer({ code: `P4-C-${randomUUID()}`, capacity: "3.000", capacityUnit: "KG" }, context);
    const inputData = { batchId: batch.id, destinationContainerId: container.id, quantity: "2.000", operationKey: `p4-idempotent-${randomUUID()}` };
    const input = { ...inputData, requestHash: assignmentHash(inputData) };
    const first = await service.assignBatchToContainer(input, context);
    assert.deepEqual(await service.assignBatchToContainer(input, context), first);
    const changedInput = { ...inputData, quantity: "1.000" };
    await assert.rejects(service.assignBatchToContainer({ ...changedInput, requestHash: assignmentHash(changedInput) }, context), (error: any) => error.code === "IDEMPOTENCY_CONFLICT");
    await assert.rejects(service.updateContainer(container.id, { capacity: "1.000" }, context), (error: any) => error.code === "CONTAINER_CAPACITY_EXCEEDED");
    const movement = await prisma.productionBatchContainerMovement.findFirstOrThrow({ where: { operationKey: input.operationKey } });
    await assert.rejects(prisma.productionBatchContainerMovement.update({ where: { id: movement.id }, data: { quantity: "1.000" } }));
    await assert.rejects(prisma.productionBatchContainerMovement.delete({ where: { id: movement.id } }));
    const occupancy = await prisma.productionContainerOccupancy.findFirstOrThrow({ where: { containerId: container.id, closedAt: null } });
    await assert.rejects(prisma.productionContainerOccupancy.update({ where: { id: occupancy.id }, data: { quantity: "1.000" } }));
    await assert.rejects(prisma.productionContainerOccupancy.delete({ where: { id: occupancy.id } }));
    const operation = await prisma.productionContainerOperation.findUniqueOrThrow({ where: { operationKey: input.operationKey } });
    await assert.rejects(prisma.productionContainerOperation.delete({ where: { id: operation.id } }));
  });

  it("rolls back container creation when audit fails", integrationOptions, async () => {
    assert.ok(prisma && service);
    const failing = new ProductionContainerService(prisma, {} as AuditService, () => new AuditService({ create: async () => { throw new Error("audit failure"); } }));
    const code = `P4-ROLLBACK-${randomUUID()}`;
    await assert.rejects(failing.create({ code, capacity: "1.000", capacityUnit: "KG" }, context));
    assert.equal(await prisma.productionContainer.count({ where: { code } }), 0);
    const statusContainer = await service.createContainer({ code: `P4-AUDIT-${randomUUID()}`, capacity: "1.000", capacityUnit: "KG" }, context);
    await assert.rejects(failing.setStatus(statusContainer.id, "FUERA_DE_SERVICIO", context));
    assert.equal((await service.getContainer(statusContainer.id)).status, "DISPONIBLE");
    const batch = await service.createBatch({ code: `P4-B-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "KG", quantity: "1.000", operationKey: `p4-create-${randomUUID()}`, requestHash: "audit" }, context);
    const movementContainer = await service.createContainer({ code: `P4-AUDIT-${randomUUID()}`, capacity: "1.000", capacityUnit: "KG" }, context);
    const auditMove = { batchId: batch.id, destinationContainerId: movementContainer.id, quantity: "1.000", operationKey: `p4-audit-${randomUUID()}` };
    await assert.rejects(failing.assign({ ...auditMove, requestHash: assignmentHash(auditMove) }, context));
    assert.equal(await prisma.productionContainerOccupancy.count({ where: { containerId: movementContainer.id } }), 0);
    assert.equal(await prisma.productionBatchContainerMovement.count({ where: { destinationContainerId: movementContainer.id } }), 0);
    const partialBatch = await service.createBatch({ code: `P4-B-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit: "KG", quantity: "3.000", operationKey: `p4-create-${randomUUID()}`, requestHash: "audit-partial" }, context);
    const partialSource = await service.createContainer({ code: `P4-AUDIT-${randomUUID()}`, capacity: "3.000", capacityUnit: "KG" }, context);
    const partialDestination = await service.createContainer({ code: `P4-AUDIT-${randomUUID()}`, capacity: "3.000", capacityUnit: "KG" }, context);
    const partialSeed = { batchId: partialBatch.id, destinationContainerId: partialSource.id, quantity: "2.000", operationKey: `p4-assign-${randomUUID()}` };
    await service.assignBatchToContainer({ ...partialSeed, requestHash: assignmentHash(partialSeed) }, context);
    const partialOperationKey = `p4-audit-partial-${randomUUID()}`;
    const partialChildCode = `P4-AUDIT-CH-${randomUUID()}`;
    const sourceBefore = await prisma.productionContainerOccupancy.findFirstOrThrow({ where: { containerId: partialSource.id, closedAt: null } });
    const ledgerCountBefore = await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: partialBatch.id } });
    const lineageCountBefore = await prisma.productionBatchLineage.count({ where: { parentBatchId: partialBatch.id } });
    const balanceBefore = await service.getBatchBalance(partialBatch.id);
    const auditCountBefore = await prisma.auditLog.count({ where: { actorUserId, action: "BATCH_CONTAINER_PARTIAL_TRANSFERRED" } });
    const auditPartial = { batchId: partialBatch.id, sourceContainerId: partialSource.id, destinationContainerId: partialDestination.id, quantity: "1.000", childCode: partialChildCode, operationKey: partialOperationKey };
    await assert.rejects(failing.transferPartial({ ...auditPartial, requestHash: partialHash(auditPartial) }, context));
    assert.equal(await prisma.productionBatch.count({ where: { code: partialChildCode } }), 0);
    assert.equal(await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: partialBatch.id } }), ledgerCountBefore);
    assert.equal(await prisma.productionBatchLineage.count({ where: { parentBatchId: partialBatch.id } }), lineageCountBefore);
    assert.deepEqual(await service.getBatchBalance(partialBatch.id), balanceBefore);
    const sourceAfter = await prisma.productionContainerOccupancy.findMany({ where: { containerId: partialSource.id, closedAt: null } });
    assert.equal(sourceAfter.length, 1);
    assert.equal(sourceAfter[0]?.id, sourceBefore.id);
    assert.equal(sourceAfter[0]?.quantity.toFixed(3), "2.000");
    assert.equal((await service.getContainer(partialSource.id)).status, "OCUPADO");
    assert.equal((await service.getContainer(partialDestination.id)).status, "DISPONIBLE");
    assert.equal(await prisma.productionContainerOccupancy.count({ where: { containerId: partialDestination.id } }), 0);
    assert.equal(await prisma.productionBatchContainerMovement.count({ where: { operationKey: partialOperationKey } }), 0);
    assert.equal(await prisma.productionContainerOperation.count({ where: { operationKey: partialOperationKey } }), 0);
    assert.equal(await prisma.auditLog.count({ where: { actorUserId, action: "BATCH_CONTAINER_PARTIAL_TRANSFERRED" } }), auditCountBefore);
  });

  it("serializes competing occupation, total transfers, capacity and partial transfers", integrationOptions, async () => {
    assert.ok(service);
    const makeBatch = (unit = "KG", quantity = "4.000") => service.createBatch({ code: `P4-B-${randomUUID()}`, productionOrderId: orderId, articuloId: randomUUID(), unit, quantity, operationKey: `p4-create-${randomUUID()}`, requestHash: "race" }, context);
    const makeContainer = (capacity = "4.000") => service.createContainer({ code: `P4-C-${randomUUID()}`, capacity, capacityUnit: "KG" }, context);

    const occupied = await makeContainer();
    const first = await makeBatch();
    const second = await makeBatch();
    const occupation = await Promise.allSettled([
      ...[first, second].map(batch => { const move = { batchId: batch.id, destinationContainerId: occupied.id, quantity: "2.000", operationKey: `p4-race-${randomUUID()}` }; return service.assignBatchToContainer({ ...move, requestHash: assignmentHash(move) }, context); }),
    ]);
    assert.equal(occupation.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(occupation.filter((item) => item.status === "rejected").length, 1);
    assert.equal(occupation.find((item) => item.status === "rejected")?.reason.code, "CONTAINER_OCCUPIED");
    const occupiedView = await service.getContainer(occupied.id);
    assert.equal(occupiedView.status, "OCUPADO");
    assert.equal(occupiedView.occupancies.filter((item) => item.closedAt === null).length, 1);

    const source = await makeContainer();
    const targetA = await makeContainer();
    const targetB = await makeContainer();
    const transferable = await makeBatch();
    const sourceSeed = { batchId: transferable.id, destinationContainerId: source.id, quantity: "3.000", operationKey: `p4-assign-${randomUUID()}` };
    await service.assignBatchToContainer({ ...sourceSeed, requestHash: assignmentHash(sourceSeed) }, context);
    const ledgerBefore = await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: transferable.id } });
    const balanceBefore = (await service.getBatchBalance(transferable.id)).available;
    const totals = await Promise.allSettled([
      ...[targetA, targetB].map(destination => { const move = { batchId: transferable.id, sourceContainerId: source.id, destinationContainerId: destination.id, operationKey: `p4-total-${randomUUID()}` }; return service.transferBatchBetweenContainers({ ...move, requestHash: transferHash(move) }, context); }),
    ]);
    assert.equal(totals.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(totals.filter((item) => item.status === "rejected").length, 1);
    assert.ok(["CONTAINER_OCCUPANCY_NOT_FOUND", "CONTAINER_OCCUPIED", "PRODUCTION_CONCURRENCY_CONFLICT"].includes(totals.find((item) => item.status === "rejected")?.reason.code));
    assert.equal((await service.getContainer(source.id)).status, "DISPONIBLE");
    assert.equal((await prisma.productionContainerOccupancy.count({ where: { containerId: source.id, closedAt: null } })), 0);
    assert.equal((await prisma.productionContainerOccupancy.count({ where: { containerId: { in: [targetA.id, targetB.id] }, closedAt: null } })), 1);
    const transferOccupancy = await prisma.productionContainerOccupancy.findFirstOrThrow({ where: { containerId: { in: [targetA.id, targetB.id] }, closedAt: null } });
    assert.equal(transferOccupancy.batchId, transferable.id);
    assert.equal(await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: transferable.id } }), ledgerBefore);
    assert.equal((await service.getBatchBalance(transferable.id)).available, balanceBefore);

    const capacity = await makeContainer("2.000");
    const capacityBatchA = await makeBatch();
    const capacitySeed = { batchId: capacityBatchA.id, destinationContainerId: capacity.id, quantity: "1.000", operationKey: `p4-capacity-seed-${randomUUID()}` };
    await service.assignBatchToContainer({ ...capacitySeed, requestHash: assignmentHash(capacitySeed) }, context);
    const capacityKeyA = `p4-capacity-${randomUUID()}`;
    const capacityKeyB = `p4-capacity-${randomUUID()}`;
    const capacityRace = await Promise.allSettled([
      ...[capacityKeyA, capacityKeyB].map(operationKey => { const move = { batchId: capacityBatchA.id, destinationContainerId: capacity.id, quantity: "0.750", operationKey }; return service.assignBatchToContainer({ ...move, requestHash: assignmentHash(move) }, context); }),
    ]);
    assert.equal(capacityRace.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(capacityRace.filter((item) => item.status === "rejected").length, 1);
    assert.equal(capacityRace.find((item) => item.status === "rejected")?.reason.code, "CONTAINER_CAPACITY_EXCEEDED");
    const persistedCapacity = await service.getContainer(capacity.id);
    assert.equal(persistedCapacity.capacity, "2.000");
    assert.equal(persistedCapacity.status, "OCUPADO");
    assert.equal(persistedCapacity.occupancies.filter((item) => item.closedAt === null).length, 1);
    assert.equal(persistedCapacity.occupancies.find((item) => item.closedAt === null)?.quantity, "1.750");

    const partialSource = await makeContainer();
    const partialA = await makeContainer();
    const partialB = await makeContainer();
    // Leave unallocated batch quantity for the atomic split; allocation protection
    // must not make both competing partial transfers fail before the race.
    const partialBatch = await makeBatch("KG", "8.000");
    const partialSourceSeed = { batchId: partialBatch.id, destinationContainerId: partialSource.id, quantity: "4.000", operationKey: `p4-assign-${randomUUID()}` };
    await service.assignBatchToContainer({ ...partialSourceSeed, requestHash: assignmentHash(partialSourceSeed) }, context);
    const partialKeyA = `p4-partial-${randomUUID()}`;
    const partialKeyB = `p4-partial-${randomUUID()}`;
    const childCodeA = `P4-CH-${randomUUID()}`;
    const childCodeB = `P4-CH-${randomUUID()}`;
    const partials = await Promise.allSettled([
      ...[[partialA, childCodeA, partialKeyA], [partialB, childCodeB, partialKeyB]].map(([destinationContainer, childCode, operationKey]) => { const move = { batchId: partialBatch.id, sourceContainerId: partialSource.id, destinationContainerId: (destinationContainer as any).id, quantity: "2.000", childCode: childCode!, operationKey: operationKey! }; return service.transferBatchPartiallyBetweenContainers({ ...move, requestHash: partialHash(move) }, context); }),
    ]);
    assert.equal(partials.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(partials.filter((item) => item.status === "rejected").length, 1);
    assert.ok(["CONTAINER_OCCUPANCY_NOT_FOUND", "CONTAINER_OCCUPIED", "INVALID_CONTAINER_OPERATION", "PRODUCTION_CONCURRENCY_CONFLICT"].includes(partials.find((item) => item.status === "rejected")?.reason.code));
    const childCodes = [childCodeA, childCodeB];
    const children = await prisma.productionBatch.findMany({ where: { code: { in: childCodes } } });
    assert.equal(children.length, 1);
    const child = children[0]!;
    assert.equal(await prisma.productionBatchLineage.count({ where: { childBatchId: child.id, operationKey: { in: [`${partialKeyA}:split:lineage`, `${partialKeyB}:split:lineage`] } } }), 1);
    assert.equal(await prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: partialBatch.id, entryType: "SEPARATED", operationKey: { in: [`${partialKeyA}:split:separated`, `${partialKeyB}:split:separated`] } } }), 1);
    assert.equal((await service.getBatchBalance(partialBatch.id)).available, "6.000");
    assert.equal((await service.getContainer(partialSource.id)).occupancies.find((item) => item.closedAt === null)?.quantity, "2.000");
    assert.equal(await prisma.productionContainerOccupancy.count({ where: { containerId: { in: [partialA.id, partialB.id] }, batchId: child.id, closedAt: null } }), 1);
  });
});