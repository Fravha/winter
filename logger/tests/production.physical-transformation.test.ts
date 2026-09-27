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
import {
  canonicalContainerAssignmentRequest,
  canonicalContainerTransferRequest,
} from "../src/modules/production/production.container.js";
import { ProductionService } from "../src/modules/production/production.service.js";
import { ProductionTransformationService } from "../src/modules/production/production.transformation.js";
import { createTemporaryProductionDatabaseResource } from "./helpers/production-test-database.js";

const database = createTemporaryProductionDatabaseResource("P8_DATABASE_URL", connectionString => ({
  connectionString,
  createClient: () => new PrismaClient({ adapter: new PrismaPg({ connectionString }) }),
}));
const connectionString = database?.connectionString;
let available = false;
if (database) {
  const probe = database.createClient();
  try {
    await probe.$queryRaw`SELECT 1 FROM production_container_occupancies LIMIT 1`;
    await probe.$queryRaw`SELECT 1 FROM transformations LIMIT 1`;
    available = true;
  } catch {
    available = false;
  } finally {
    await probe.$disconnect();
  }
}
if (connectionString && !available) {
  throw new Error("P8_DATABASE_URL was supplied but the P4/P8 migrations or test database are unavailable");
}
const integrationOptions = available ? {} : { skip: "requires P8_DATABASE_URL pointing to an isolated temporary database with P4/P8 migrations" };

const stable = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(stable).join(",")}]`
    : `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
const digest = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");
const assignmentHash = (data: object) => digest(canonicalContainerAssignmentRequest(data as any));
const transferHash = (data: object) => digest(canonicalContainerTransferRequest(data as any));
const coded = (error: unknown): error is { code: string } =>
  typeof error === "object" && error !== null && "code" in error && typeof error.code === "string";

describe("Production physical transformation", () => {
  const actorUserId = randomUUID();
  const context = { actorUserId, requestId: randomUUID() };
  const prisma = database?.createClient();
  const audit = prisma ? new AuditService(new PrismaAuditRepository(prisma)) : undefined;
  const articles = prisma
    ? new ArticuloService(new PrismaArticuloRepository(prisma), new PrismaArticuloUnitOfWork(prisma))
    : undefined;
  const production = prisma && audit && articles
    ? new ProductionService(prisma, audit, articles)
    : undefined;

  before(async () => {
    if (!available || !prisma || !production) return;
    await prisma.user.create({
      data: { id: actorUserId, firebaseUid: `physical-${actorUserId}`, email: `${actorUserId}@test.invalid`, status: "ACTIVE" },
    });
  });
  after(async () => { await prisma?.$disconnect(); });

  async function fixture(quantity = "100.000") {
    assert.ok(prisma && production && articles);
    const order = await production.createOrder({ code: `PHY-O-${randomUUID()}`, startDate: new Date() }, context);
    const inputArticle = await articles.createArticulo({
      codigo: `PHY-A-${randomUUID()}`, nombre: "Physical input", clasificacion: "MATERIA_PRIMA", unidadMedida: "L",
    }, context);
    const outputArticle = await articles.createArticulo({
      codigo: `PHY-A-${randomUUID()}`, nombre: "Physical output", clasificacion: "PRODUCTO_PROCESO", unidadMedida: "L",
    }, context);
    const input = await production.createBatch({
      code: `PHY-B-${randomUUID()}`, productionOrderId: order.id, articuloId: inputArticle.id, unit: "L", quantity,
      operationKey: `phy-create-${randomUUID()}`, requestHash: "fixture",
    }, context);
    return { order, inputArticle, outputArticle, input };
  }

  async function container(capacity = "200.000", unit = "L") {
    assert.ok(production);
    return production.createContainer({ code: `PHY-C-${randomUUID()}`, capacity, capacityUnit: unit }, context);
  }

  async function occupy(batchId: string, containerId: string, quantity: string) {
    assert.ok(production);
    const operation = {
      batchId, destinationContainerId: containerId, quantity, operationKey: `phy-assign-${randomUUID()}`,
    };
    return production.assignBatchToContainer({ ...operation, requestHash: assignmentHash(operation) }, context);
  }

  async function rollbackSnapshot() {
    assert.ok(prisma);
    return Promise.all([
      prisma.transformation.count(),
      prisma.productionBatch.count(),
      prisma.productionBatchLedgerEntry.count(),
      prisma.productionContainerOccupancy.count(),
      prisma.productionBatchContainerMovement.count(),
      prisma.productionContainerOperation.count(),
      prisma.productionBatchOperation.count(),
      prisma.auditLog.count({ where: { actorUserId } }),
    ]);
  }

  async function withFailureTrigger(
    table: "production_batches" | "production_batch_container_movements",
    condition: string,
    message: string,
    work: () => Promise<unknown>,
  ) {
    assert.ok(prisma);
    const suffix = randomUUID().replaceAll("-", "");
    const functionName = `test_physical_failure_${suffix}`;
    const triggerName = `test_physical_failure_${suffix}`;
    const sqlLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION public."${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF (${condition}) THEN RAISE EXCEPTION ${sqlLiteral(message)} USING ERRCODE = 'P0001'; END IF; RETURN NEW; END; $body$`,
    );
    try {
      await prisma.$executeRawUnsafe(
        `CREATE TRIGGER "${triggerName}" BEFORE INSERT ON public."${table}" FOR EACH ROW EXECUTE FUNCTION public."${functionName}"()`,
      );
      return await work();
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON public."${table}"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public."${functionName}"()`);
    }
  }

  function command(f: Awaited<ReturnType<typeof fixture>>, overrides: Record<string, unknown> = {}) {
    return {
      productionOrderId: f.order.id,
      performedAt: new Date(),
      operationKey: `phy-transform-${randomUUID()}`,
      requestHash: "caller-hash",
      inputs: [{ productionBatchId: f.input.id, quantity: "98.000" }],
      outputs: [{ articuloId: f.outputArticle.id, quantity: "98.000", unit: "L" }],
      ...overrides,
    };
  }

  async function transform(data: ReturnType<typeof command>) {
    assert.ok(production);
    return production.createTransformation(data, context);
  }

  async function assertNoOverallocatedOpenOccupancy(batchIds: string[]) {
    assert.ok(prisma);
    for (const productionBatchId of batchIds) {
      const [balance, occupancies] = await Promise.all([
        prisma.productionBatchBalance.findUnique({ where: { productionBatchId } }),
        prisma.productionContainerOccupancy.findMany({ where: { batchId: productionBatchId, closedAt: null } }),
      ]);
      const allocated = occupancies.reduce((sum, row) => sum + Number(row.quantity), 0);
      assert.ok(Number(balance?.available ?? 0) >= allocated, `batch ${productionBatchId} has more open occupancy than available quantity`);
      assert.ok(allocated >= 0);
    }
  }

  it("preserves legacy transformations that do not use containers", integrationOptions, async () => {
    assert.ok(prisma);
    const f = await fixture();
    const result = await transform(command(f, {
      inputs: [{ productionBatchId: f.input.id, quantity: "10.000" }],
      outputs: [{ articuloId: f.outputArticle.id, quantity: "9.000", unit: "L" }],
    }));
    assert.equal(result.outputs.length, 1);
    assert.equal(result.physicalReconciliation.sourceWithdrawals.length, 0);
    assert.equal(result.physicalReconciliation.outputPlacements.length, 0);
    assert.equal((await production!.getBatchBalance(f.input.id)).available, "90.000");
    assert.equal(await prisma.productionContainerOccupancy.count({ where: { batchId: f.input.id } }), 0);
  });

  it("reconciles a full physical transformation, attributed loss, output placement, audit and lineage", integrationOptions, async () => {
    assert.ok(prisma && production);
    const f = await fixture();
    const source = await container();
    const destination = await container();
    const original = await occupy(f.input.id, source.id, "100.000");
    const result = await transform(command(f, {
      losses: [{ productionBatchId: f.input.id, quantity: "2.000", unit: "L" }],
      sourceWithdrawals: [{ productionBatchId: f.input.id, containerId: source.id, quantity: "100.000" }],
      outputPlacements: [{ outputIndex: 0, containerId: destination.id, quantity: "98.000" }],
    }));
    const outputId = result.outputs[0]!.productionBatchId;
    const [sourceHistory, destinationView, inputBalance, outputBalance, lineage] = await Promise.all([
      prisma.productionContainerOccupancy.findMany({ where: { containerId: source.id }, orderBy: { openedAt: "asc" } }),
      production.getContainer(destination.id),
      production.getBatchBalance(f.input.id),
      production.getBatchBalance(outputId),
      prisma.productionBatchLineage.findMany({ where: { parentBatchId: f.input.id, childBatchId: outputId } }),
    ]);
    assert.equal(sourceHistory.length, 1);
    assert.equal(sourceHistory[0]!.id, original.occupancy.id);
    assert.ok(sourceHistory[0]!.closedAt);
    assert.equal((await production.getContainer(source.id)).status, "DISPONIBLE");
    assert.equal(inputBalance.available, "0.000");
    assert.equal(outputBalance.available, "98.000");
    assert.equal(destinationView.status, "OCUPADO");
    assert.equal(destinationView.occupancies.find(row => row.closedAt === null)?.quantity, "98.000");
    assert.equal(result.losses[0]!.productionBatchId, f.input.id);
    assert.equal(lineage.length, 1);
    assert.equal(await prisma.auditLog.count({ where: { actorUserId, action: "PRODUCTION_TRANSFORMATION_CREATED", resourceId: result.id } }), 1);
    assert.deepEqual(result.physicalReconciliation.sourceWithdrawals.map(row => ({
      productionBatchId: row.productionBatchId, containerId: row.containerId, quantity: row.quantity,
      sourceOccupancyId: row.sourceOccupancyId, remainderQuantity: row.remainderQuantity,
    })), [{
      productionBatchId: f.input.id, containerId: source.id, quantity: "100.000",
      sourceOccupancyId: original.occupancy.id, remainderQuantity: "0.000",
    }]);
    assert.equal(result.physicalReconciliation.outputPlacements[0]!.productionBatchId, outputId);
    await assertNoOverallocatedOpenOccupancy([f.input.id, outputId]);
  });

  it("preserves the unprocessed remainder for a partial physical transformation", integrationOptions, async () => {
    assert.ok(prisma && production);
    const f = await fixture();
    const source = await container();
    const destination = await container();
    const original = await occupy(f.input.id, source.id, "100.000");
    const result = await transform(command(f, {
      inputs: [{ productionBatchId: f.input.id, quantity: "39.000" }],
      outputs: [{ articuloId: f.outputArticle.id, quantity: "39.000", unit: "L" }],
      losses: [{ productionBatchId: f.input.id, quantity: "1.000", unit: "L" }],
      sourceWithdrawals: [{ productionBatchId: f.input.id, containerId: source.id, quantity: "40.000" }],
      outputPlacements: [{ outputIndex: 0, containerId: destination.id, quantity: "39.000" }],
    }));
    const outputId = result.outputs[0]!.productionBatchId;
    const sourceView = await production.getContainer(source.id);
    const sourceOccupancies = await prisma.productionContainerOccupancy.findMany({ where: { containerId: source.id }, orderBy: { openedAt: "asc" } });
    assert.equal(sourceOccupancies.length, 2);
    assert.equal(sourceOccupancies[0]!.id, original.occupancy.id);
    assert.ok(sourceOccupancies[0]!.closedAt);
    assert.equal(sourceOccupancies[1]!.batchId, f.input.id);
    assert.equal(sourceOccupancies[1]!.quantity.toFixed(3), "60.000");
    assert.equal(sourceOccupancies[1]!.closedAt, null);
    assert.equal(sourceView.status, "OCUPADO");
    assert.equal((await production.getBatchBalance(f.input.id)).available, "60.000");
    assert.equal((await production.getBatchBalance(outputId)).available, "39.000");
    assert.equal(result.physicalReconciliation.sourceWithdrawals[0]!.remainderOccupancyId, sourceOccupancies[1]!.id);
    assert.equal(result.physicalReconciliation.sourceWithdrawals[0]!.remainderQuantity, "60.000");
    await assertNoOverallocatedOpenOccupancy([f.input.id, outputId]);
  });

  it("rejects withdrawals beyond occupancy or batch balance without partial writes", integrationOptions, async () => {
    assert.ok(prisma && production);
    const f = await fixture();
    const source = await container();
    await occupy(f.input.id, source.id, "40.000");
    const before = await Promise.all([
      prisma.transformation.count({ where: { productionOrderId: f.order.id } }),
      prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: f.input.id } }),
      prisma.productionContainerOccupancy.count({ where: { containerId: source.id } }),
    ]);
    await assert.rejects(transform(command(f, {
      inputs: [{ productionBatchId: f.input.id, quantity: "41.000" }],
      sourceWithdrawals: [{ productionBatchId: f.input.id, containerId: source.id, quantity: "41.000" }],
    })), (error: unknown) => coded(error) && ["CONTAINER_WITHDRAWAL_EXCEEDS_OCCUPANCY", "TRANSFORMATION_SOURCE_WITHDRAWAL_EXCEEDS_OCCUPANCY", "INSUFFICIENT_CONTAINER_OCCUPANCY"].includes(error.code));
    await assert.rejects(transform(command(f, {
      inputs: [{ productionBatchId: f.input.id, quantity: "101.000" }],
      sourceWithdrawals: [{ productionBatchId: f.input.id, containerId: source.id, quantity: "40.000" }],
    })), (error: unknown) => coded(error) && ["INSUFFICIENT_BATCH_QUANTITY", "TRANSFORMATION_SOURCE_WITHDRAWAL_EXCEEDS_BATCH_AVAILABLE"].includes(error.code));
    assert.deepEqual(await Promise.all([
      prisma.transformation.count({ where: { productionOrderId: f.order.id } }),
      prisma.productionBatchLedgerEntry.count({ where: { productionBatchId: f.input.id } }),
      prisma.productionContainerOccupancy.count({ where: { containerId: source.id } }),
    ]), before);
    await assertNoOverallocatedOpenOccupancy([f.input.id]);
  });

  it("requires physically withdrawn loss to be attributed to the corresponding source batch", integrationOptions, async () => {
    assert.ok(prisma && production);
    const f = await fixture();
    const source = await container();
    await occupy(f.input.id, source.id, "100.000");
    await assert.rejects(transform(command(f, {
      inputs: [{ productionBatchId: f.input.id, quantity: "39.000" }],
      losses: [{ quantity: "1.000", unit: "L" }],
      sourceWithdrawals: [{ productionBatchId: f.input.id, containerId: source.id, quantity: "40.000" }],
    })), (error: unknown) => coded(error) && ["INVALID_TRANSFORMATION", "TRANSFORMATION_LOSS_NOT_ATTRIBUTABLE", "SOURCE_WITHDRAWAL_NOT_RECONCILED"].includes(error.code));
    assert.equal(await prisma.transformation.count({ where: { productionOrderId: f.order.id } }), 0);
    assert.equal((await production.getContainer(source.id)).occupancies.find(row => row.closedAt === null)?.quantity, "100.000");
    await assertNoOverallocatedOpenOccupancy([f.input.id]);
  });

  it("rejects occupied, out-of-service, unit-incompatible and undersized output destinations", integrationOptions, async () => {
    assert.ok(prisma && production);
    const occupiedFixture = await fixture();
    const occupiedSource = await container();
    const occupiedDestination = await container();
    const blocker = await production.createBatch({
      code: `PHY-B-${randomUUID()}`, productionOrderId: occupiedFixture.order.id, articuloId: occupiedFixture.inputArticle.id,
      unit: "L", quantity: "5.000", operationKey: `phy-blocker-${randomUUID()}`, requestHash: "fixture",
    }, context);
    await occupy(occupiedFixture.input.id, occupiedSource.id, "100.000");
    await occupy(blocker.id, occupiedDestination.id, "2.000");
    await assert.rejects(transform(command(occupiedFixture, {
      inputs: [{ productionBatchId: occupiedFixture.input.id, quantity: "98.000" }],
      losses: [{ productionBatchId: occupiedFixture.input.id, quantity: "2.000", unit: "L" }],
      sourceWithdrawals: [{ productionBatchId: occupiedFixture.input.id, containerId: occupiedSource.id, quantity: "100.000" }],
      outputPlacements: [{ outputIndex: 0, containerId: occupiedDestination.id, quantity: "98.000" }],
    })), (error: unknown) => coded(error) && error.code === "CONTAINER_OCCUPIED");

    const serviceUnavailable = await fixture();
    const serviceSource = await container();
    const outOfService = await container();
    await occupy(serviceUnavailable.input.id, serviceSource.id, "100.000");
    await production.deactivateContainer(outOfService.id, context);
    await assert.rejects(transform(command(serviceUnavailable, {
      losses: [{ productionBatchId: serviceUnavailable.input.id, quantity: "2.000", unit: "L" }],
      sourceWithdrawals: [{ productionBatchId: serviceUnavailable.input.id, containerId: serviceSource.id, quantity: "100.000" }],
      outputPlacements: [{ outputIndex: 0, containerId: outOfService.id, quantity: "98.000" }],
    })), (error: unknown) => coded(error) && error.code === "CONTAINER_OUT_OF_SERVICE");

    const incompatible = await fixture();
    const incompatibleSource = await container();
    const wrongUnit = await container("200.000", "KG");
    await occupy(incompatible.input.id, incompatibleSource.id, "100.000");
    await assert.rejects(transform(command(incompatible, {
      losses: [{ productionBatchId: incompatible.input.id, quantity: "2.000", unit: "L" }],
      sourceWithdrawals: [{ productionBatchId: incompatible.input.id, containerId: incompatibleSource.id, quantity: "100.000" }],
      outputPlacements: [{ outputIndex: 0, containerId: wrongUnit.id, quantity: "98.000" }],
    })), (error: unknown) => coded(error) && error.code === "INVALID_CONTAINER_OPERATION");

    const insufficientCapacity = await fixture();
    const capacitySource = await container();
    const tooSmall = await container("97.000");
    await occupy(insufficientCapacity.input.id, capacitySource.id, "100.000");
    await assert.rejects(transform(command(insufficientCapacity, {
      losses: [{ productionBatchId: insufficientCapacity.input.id, quantity: "2.000", unit: "L" }],
      sourceWithdrawals: [{ productionBatchId: insufficientCapacity.input.id, containerId: capacitySource.id, quantity: "100.000" }],
      outputPlacements: [{ outputIndex: 0, containerId: tooSmall.id, quantity: "98.000" }],
    })), (error: unknown) => coded(error) && error.code === "CONTAINER_CAPACITY_EXCEEDED");

    await assertNoOverallocatedOpenOccupancy([
      occupiedFixture.input.id, blocker.id, serviceUnavailable.input.id, incompatible.input.id, insufficientCapacity.input.id,
    ]);
  });

  it("rejects a placement dated before the latest closure in a reused destination", integrationOptions, async () => {
    assert.ok(prisma && production);
    const f = await fixture();
    const source = await container();
    const destination = await container();
    const vacatedTo = await container();
    const blocker = await production.createBatch({
      code: `PHY-B-${randomUUID()}`, productionOrderId: f.order.id, articuloId: f.inputArticle.id,
      unit: "L", quantity: "5.000", operationKey: `phy-reuse-blocker-${randomUUID()}`, requestHash: "fixture",
    }, context);
    await occupy(f.input.id, source.id, "100.000");
    await occupy(blocker.id, destination.id, "5.000");
    const latestClose = new Date(Date.now() + 60_000);
    const move = {
      batchId: blocker.id, sourceContainerId: destination.id, destinationContainerId: vacatedTo.id,
      operationKey: `phy-reuse-transfer-${randomUUID()}`, occurredAt: latestClose,
    };
    await production.transferBatchBetweenContainers({ ...move, requestHash: transferHash(move) }, context);
    const destinationHistory = await production.getContainer(destination.id);
    assert.equal(destinationHistory.status, "DISPONIBLE");
    assert.equal(destinationHistory.occupancies[0]!.closedAt, latestClose.toISOString());

    const data = command(f, {
      losses: [{ productionBatchId: f.input.id, quantity: "2.000", unit: "L" }],
      sourceWithdrawals: [{ productionBatchId: f.input.id, containerId: source.id, quantity: "100.000" }],
      outputPlacements: [{ outputIndex: 0, containerId: destination.id, quantity: "98.000" }],
    });
    const before = await rollbackSnapshot();
    await assert.rejects(transform(data), (error: unknown) => coded(error) && error.code === "INVALID_CONTAINER_OPERATION");
    assert.deepEqual(await rollbackSnapshot(), before);
    assert.equal((await prisma.productionContainerOccupancy.findUniqueOrThrow({
      where: { id: (await production.getContainer(source.id)).occupancies[0]!.id },
    })).closedAt, null);
    assert.equal((await production.getContainer(destination.id)).status, "DISPONIBLE");
    assert.equal((await production.getBatchBalance(f.input.id)).available, "100.000");
    await assertNoOverallocatedOpenOccupancy([f.input.id, blocker.id]);
  });

  it("rolls back source closure and audit when output-batch creation fails", integrationOptions, async () => {
    assert.ok(prisma && articles && production);
    const f = await fixture();
    const source = await container();
    const destination = await container();
    const initialOccupancy = await occupy(f.input.id, source.id, "100.000");
    const data = command(f, {
      losses: [{ productionBatchId: f.input.id, quantity: "2.000", unit: "L" }],
      sourceWithdrawals: [{ productionBatchId: f.input.id, containerId: source.id, quantity: "100.000" }],
      outputPlacements: [{ outputIndex: 0, containerId: destination.id, quantity: "98.000" }],
    });
    const before = await rollbackSnapshot();
    const failing = new ProductionTransformationService(prisma, articles);
    await withFailureTrigger(
      "production_batches",
      "NEW.code LIKE 'TR-%'",
      "injected output batch creation failure",
      () => assert.rejects(failing.create(data, context), /injected output batch creation failure/),
    );
    assert.deepEqual(await rollbackSnapshot(), before);
    assert.equal((await prisma.productionContainerOccupancy.findUniqueOrThrow({
      where: { id: initialOccupancy.occupancy.id },
    })).closedAt, null);
    assert.equal((await production.getContainer(source.id)).status, "OCUPADO");
    assert.equal((await production.getContainer(destination.id)).status, "DISPONIBLE");
    assert.equal((await production.getBatchBalance(f.input.id)).available, "100.000");
    await assertNoOverallocatedOpenOccupancy([f.input.id]);
  });

  it("rolls back source closure and output batch when placement fails", integrationOptions, async () => {
    assert.ok(prisma && articles && production);
    const f = await fixture();
    const source = await container();
    const destination = await container();
    const initialOccupancy = await occupy(f.input.id, source.id, "100.000");
    const data = command(f, {
      losses: [{ productionBatchId: f.input.id, quantity: "2.000", unit: "L" }],
      sourceWithdrawals: [{ productionBatchId: f.input.id, containerId: source.id, quantity: "100.000" }],
      outputPlacements: [{ outputIndex: 0, containerId: destination.id, quantity: "98.000" }],
    });
    const before = await rollbackSnapshot();
    const failing = new ProductionTransformationService(prisma, articles);
    await withFailureTrigger(
      "production_batch_container_movements",
      `NEW.operation_key = '${data.operationKey}:placement:0'`,
      "injected output placement failure",
      () => assert.rejects(failing.create(data, context), /injected output placement failure/),
    );
    assert.deepEqual(await rollbackSnapshot(), before);
    assert.equal((await prisma.productionContainerOccupancy.findUniqueOrThrow({
      where: { id: initialOccupancy.occupancy.id },
    })).closedAt, null);
    assert.equal((await production.getContainer(source.id)).status, "OCUPADO");
    assert.equal((await production.getContainer(destination.id)).status, "DISPONIBLE");
    assert.equal((await production.getBatchBalance(f.input.id)).available, "100.000");
    await assertNoOverallocatedOpenOccupancy([f.input.id]);
  });

  it("rolls back source closure, batches, placements and audit when audit recording fails", integrationOptions, async () => {
    assert.ok(prisma && articles && production);
    const f = await fixture();
    const source = await container();
    const destination = await container();
    const initialOccupancy = await occupy(f.input.id, source.id, "100.000");
    const failing = new ProductionTransformationService(prisma, articles, () => ({
      record: async () => { throw new Error("injected audit failure"); },
    } as unknown as AuditService));
    const data = command(f, {
      losses: [{ productionBatchId: f.input.id, quantity: "2.000", unit: "L" }],
      sourceWithdrawals: [{ productionBatchId: f.input.id, containerId: source.id, quantity: "100.000" }],
      outputPlacements: [{ outputIndex: 0, containerId: destination.id, quantity: "98.000" }],
    });
    const before = await Promise.all([
      prisma.transformation.count(),
      prisma.productionBatch.count(),
      prisma.productionBatchLedgerEntry.count(),
      prisma.productionContainerOccupancy.count(),
      prisma.productionBatchContainerMovement.count(),
      prisma.productionContainerOperation.count(),
      prisma.auditLog.count({ where: { actorUserId } }),
    ]);
    await assert.rejects(failing.create(data, context), /injected audit failure/);
    assert.deepEqual(await Promise.all([
      prisma.transformation.count(),
      prisma.productionBatch.count(),
      prisma.productionBatchLedgerEntry.count(),
      prisma.productionContainerOccupancy.count(),
      prisma.productionBatchContainerMovement.count(),
      prisma.productionContainerOperation.count(),
      prisma.auditLog.count({ where: { actorUserId } }),
    ]), before);
    const oldOccupancy = await prisma.productionContainerOccupancy.findUniqueOrThrow({ where: { id: initialOccupancy.occupancy.id } });
    assert.equal(oldOccupancy.closedAt, null);
    assert.equal((await production.getContainer(source.id)).status, "OCUPADO");
    assert.equal((await production.getContainer(destination.id)).status, "DISPONIBLE");
    assert.equal((await production.getBatchBalance(f.input.id)).available, "100.000");
    await assertNoOverallocatedOpenOccupancy([f.input.id]);
  });

  it("replays the complete physical result idempotently and conflicts when physical payload changes", integrationOptions, async () => {
    assert.ok(prisma && production);
    const f = await fixture();
    const source = await container();
    const destination = await container();
    await occupy(f.input.id, source.id, "100.000");
    const data = command(f, {
      losses: [{ productionBatchId: f.input.id, quantity: "2.000", unit: "L" }],
      sourceWithdrawals: [{ productionBatchId: f.input.id, containerId: source.id, quantity: "100.000" }],
      outputPlacements: [{ outputIndex: 0, containerId: destination.id, quantity: "98.000" }],
    });
    const first = await transform(data);
    const before = await Promise.all([
      prisma.transformation.count({ where: { operationKey: data.operationKey } }),
      prisma.productionBatchContainerMovement.count({ where: { operationKey: { startsWith: data.operationKey } } }),
      prisma.productionContainerOccupancy.count({ where: { batchId: f.input.id } }),
      prisma.productionBatch.count(),
    ]);
    assert.deepEqual(await transform(data), first);
    assert.deepEqual(await Promise.all([
      prisma.transformation.count({ where: { operationKey: data.operationKey } }),
      prisma.productionBatchContainerMovement.count({ where: { operationKey: { startsWith: data.operationKey } } }),
      prisma.productionContainerOccupancy.count({ where: { batchId: f.input.id } }),
      prisma.productionBatch.count(),
    ]), before);
    await assert.rejects(transform({
      ...data,
      outputPlacements: [{ outputIndex: 0, containerId: destination.id, quantity: "97.000" }],
    }), (error: unknown) => coded(error) && error.code === "IDEMPOTENCY_CONFLICT");
    await assertNoOverallocatedOpenOccupancy([f.input.id, first.outputs[0]!.productionBatchId]);
  });

  it("serializes a physical transformation against a competing total container transfer", integrationOptions, async () => {
    assert.ok(prisma && production);
    const f = await fixture();
    const source = await container();
    const transferTarget = await container();
    const outputTarget = await container();
    await occupy(f.input.id, source.id, "100.000");
    const transformCommand = command(f, {
      losses: [{ productionBatchId: f.input.id, quantity: "2.000", unit: "L" }],
      sourceWithdrawals: [{ productionBatchId: f.input.id, containerId: source.id, quantity: "100.000" }],
      outputPlacements: [{ outputIndex: 0, containerId: outputTarget.id, quantity: "98.000" }],
    });
    const move = {
      batchId: f.input.id, sourceContainerId: source.id, destinationContainerId: transferTarget.id,
      operationKey: `phy-transfer-${randomUUID()}`,
    };
    const [transformation, movement] = await Promise.allSettled([
      transform(transformCommand),
      production.transferBatchBetweenContainers({ ...move, requestHash: transferHash(move) }, context),
    ]);
    assert.equal([transformation, movement].filter(result => result.status === "fulfilled").length, 1);
    const rejected = [transformation, movement].find(result => result.status === "rejected") as PromiseRejectedResult;
    assert.ok(coded(rejected.reason));
    assert.ok([
      "CONTAINER_OCCUPANCY_NOT_FOUND", "CONTAINER_OCCUPIED", "INSUFFICIENT_BATCH_QUANTITY",
      "PRODUCTION_CONCURRENCY_CONFLICT", "PRODUCTION_CONCURRENCY_RETRY_EXHAUSTED",
    ].includes(rejected.reason.code));
    const outputId = transformation.status === "fulfilled" ? transformation.value.outputs[0]!.productionBatchId : undefined;
    await assertNoOverallocatedOpenOccupancy([f.input.id, ...(outputId ? [outputId] : [])]);
    if (transformation.status === "fulfilled") {
      assert.equal((await production.getBatchBalance(f.input.id)).available, "0.000");
      assert.equal((await production.getContainer(source.id)).status, "DISPONIBLE");
      assert.equal((await production.getContainer(outputTarget.id)).status, "OCUPADO");
    } else {
      assert.equal((await production.getContainer(source.id)).status, "DISPONIBLE");
      assert.equal((await production.getContainer(transferTarget.id)).status, "OCUPADO");
    }
  });

  it("serializes a physical transformation against a competing assignment to its output destination", integrationOptions, async () => {
    assert.ok(prisma && production);
    const f = await fixture();
    const source = await container();
    const outputTarget = await container();
    const competingBatch = await production.createBatch({
      code: `PHY-B-${randomUUID()}`, productionOrderId: f.order.id, articuloId: f.inputArticle.id,
      unit: "L", quantity: "5.000", operationKey: `phy-competing-assign-${randomUUID()}`, requestHash: "fixture",
    }, context);
    await occupy(f.input.id, source.id, "100.000");
    const transformCommand = command(f, {
      losses: [{ productionBatchId: f.input.id, quantity: "2.000", unit: "L" }],
      sourceWithdrawals: [{ productionBatchId: f.input.id, containerId: source.id, quantity: "100.000" }],
      outputPlacements: [{ outputIndex: 0, containerId: outputTarget.id, quantity: "98.000" }],
    });
    const assignment = {
      batchId: competingBatch.id, destinationContainerId: outputTarget.id, quantity: "5.000",
      operationKey: `phy-competing-assignment-${randomUUID()}`,
    };
    const beforeAudit = await prisma.auditLog.count({ where: { actorUserId } });
    const [transformation, allocation] = await Promise.allSettled([
      transform(transformCommand),
      production.assignBatchToContainer({ ...assignment, requestHash: assignmentHash(assignment) }, context),
    ]);
    assert.equal([transformation, allocation].filter(result => result.status === "fulfilled").length, 1);
    const rejected = [transformation, allocation].find(result => result.status === "rejected") as PromiseRejectedResult;
    assert.ok(coded(rejected.reason));
    assert.ok([
      "CONTAINER_OCCUPIED", "PRODUCTION_CONCURRENCY_CONFLICT", "PRODUCTION_CONCURRENCY_RETRY_EXHAUSTED",
    ].includes(rejected.reason.code));
    const destination = await production.getContainer(outputTarget.id);
    const outputId = transformation.status === "fulfilled" ? transformation.value.outputs[0]!.productionBatchId : undefined;
    assert.equal(destination.status, "OCUPADO");
    if (transformation.status === "fulfilled") {
      assert.equal(destination.occupancies.find(row => row.closedAt === null)?.batchId, outputId);
      assert.equal((await production.getBatchBalance(f.input.id)).available, "0.000");
      assert.equal((await production.getBatchBalance(competingBatch.id)).available, "5.000");
      assert.equal(await prisma.auditLog.count({ where: { actorUserId } }) - beforeAudit, 3);
    } else {
      assert.equal(destination.occupancies.find(row => row.closedAt === null)?.batchId, competingBatch.id);
      assert.equal((await production.getContainer(source.id)).status, "OCUPADO");
      assert.equal((await production.getBatchBalance(f.input.id)).available, "100.000");
      assert.equal(await prisma.auditLog.count({ where: { actorUserId } }) - beforeAudit, 1);
    }
    await assertNoOverallocatedOpenOccupancy([f.input.id, competingBatch.id, ...(outputId ? [outputId] : [])]);
  });

  it("exposes source/destination physical history, quantities, losses and lineage in the output trace", integrationOptions, async () => {
    assert.ok(prisma && production);
    const f = await fixture();
    const source = await container();
    const destination = await container();
    await occupy(f.input.id, source.id, "100.000");
    const result = await transform(command(f, {
      losses: [{ productionBatchId: f.input.id, quantity: "2.000", unit: "L" }],
      sourceWithdrawals: [{ productionBatchId: f.input.id, containerId: source.id, quantity: "100.000" }],
      outputPlacements: [{ outputIndex: 0, containerId: destination.id, quantity: "98.000" }],
    }));
    const outputId = result.outputs[0]!.productionBatchId;
    const trace = await production.getBatchTrace(outputId);
    assert.ok(trace.batches.some(batch => batch.id === f.input.id));
    assert.ok(trace.batches.some(batch => batch.id === outputId));
    assert.ok(trace.lineage.some(edge => edge.parentBatchId === f.input.id && edge.childBatchId === outputId));
    const tracedTransformation = trace.transformations.find(transformation => transformation.id === result.id);
    assert.ok(tracedTransformation);
    assert.equal(Number(tracedTransformation.inputs.find(input => input.productionBatchId === f.input.id)?.quantity), 98);
    assert.ok(tracedTransformation.losses.some(loss => loss.productionBatchId === f.input.id && Number(loss.quantity) === 2));
    assert.ok(trace.containers.some(item => item.id === source.id && item.occupancies.some(occupancy => occupancy.batchId === f.input.id && occupancy.closedAt)));
    assert.ok(trace.containers.some(item => item.id === destination.id && item.occupancies.some(occupancy => occupancy.batchId === outputId && occupancy.closedAt === null)));
    const reconciliation = (tracedTransformation as typeof tracedTransformation & {
      physicalReconciliation?: { sourceWithdrawals: Array<{ containerId: string; quantity: string }>; outputPlacements: Array<{ containerId: string; quantity: string }> };
    }).physicalReconciliation;
    assert.ok(reconciliation);
    assert.deepEqual(reconciliation.sourceWithdrawals.map(item => ({ containerId: item.containerId, quantity: item.quantity })), [{ containerId: source.id, quantity: "100.000" }]);
    assert.deepEqual(reconciliation.outputPlacements.map(item => ({ containerId: item.containerId, quantity: item.quantity })), [{ containerId: destination.id, quantity: "98.000" }]);
    await assertNoOverallocatedOpenOccupancy([f.input.id, outputId]);
  });
});