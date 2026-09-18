import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { after, before, describe, it } from "node:test";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { AuditService } from "../src/core/audit/audit.service.js";
import { PrismaAuditRepository } from "../src/core/audit/prisma-audit.repository.js";
import { ProductionService } from "../src/modules/production/production.service.js";

const connectionString = process.env.WINTER_DATABASE_URL;
let available = false;
if (connectionString) {
  const probe = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await probe.$queryRaw`SELECT 1 FROM transformation_orders LIMIT 1`;
    available = true;
  } catch {
    available = false;
  } finally {
    await probe.$disconnect();
  }
}
const integrationOptions = available ? {} : { skip: "requires WINTER_DATABASE_URL with the Production P2 migration applied" };

describe("Production P2 PostgreSQL integration", () => {
  const prisma = connectionString ? new PrismaClient({ adapter: new PrismaPg({ connectionString }) }) : undefined;
  const service = prisma ? new ProductionService(prisma, new AuditService(new PrismaAuditRepository(prisma))) : undefined;
  const actorUserId = randomUUID();
  const orderIds: string[] = [];
  const transformationIds: string[] = [];

  before(async () => {
    if (!available || !prisma) return;
    await prisma.user.create({ data: { id: actorUserId, firebaseUid: `p2-${actorUserId}`, email: `${actorUserId}@test.invalid`, status: "ACTIVE" } });
  });
  after(async () => {
    if (!available || !prisma) return;
    await prisma.transformationOrder.deleteMany({ where: { id: { in: transformationIds } } });
    await prisma.productionOrder.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId } });
    await prisma.user.delete({ where: { id: actorUserId } });
    await prisma.$disconnect();
  });

  it("creates, lists and closes both aggregates atomically", integrationOptions, async () => {
    assert.ok(prisma && service);
    const context = { actorUserId, requestId: randomUUID() };
    const order = await service.createOrder({ code: `P2-${randomUUID()}`, startDate: new Date() }, context);
    orderIds.push(order.id);
    const child = await service.createTransformationOrder({ code: "T-1", productionOrderId: order.id, periodStart: new Date() }, context);
    transformationIds.push(child.id);
    await service.closeTransformationOrder(child.id, context);
    const closed = await service.closeOrder(order.id, context);
    assert.equal(closed.status, "CLOSED");
    assert.equal((await service.listOrders({ page: 1, pageSize: 10 })).items.length >= 1, true);
    assert.equal((await prisma.auditLog.count({ where: { actorUserId, action: { in: ["PRODUCTION_ORDER_CREATED", "PRODUCTION_ORDER_CLOSED", "TRANSFORMATION_ORDER_CREATED", "TRANSFORMATION_ORDER_CLOSED"] } } })) >= 4, true);
  });

  it("enforces ownership, uniqueness, irreversible close and audit rollback", integrationOptions, async () => {
    assert.ok(prisma && service);
    const context = { actorUserId, requestId: randomUUID() };
    const order = await service.createOrder({ code: `P2-RULES-${randomUUID()}`, startDate: new Date() }, context);
    orderIds.push(order.id);
    const duplicateGlobal = service.createOrder({ code: order.code, startDate: new Date() }, context);
    await assert.rejects(duplicateGlobal, (error: any) => error.code === "PRODUCTION_CODE_ALREADY_EXISTS");
    const child = await service.createTransformationOrder({ code: "SAME", productionOrderId: order.id, periodStart: new Date() }, context);
    transformationIds.push(child.id);
    await assert.rejects(
      service.createTransformationOrder({ code: "SAME", productionOrderId: order.id, periodStart: new Date() }, context),
      (error: any) => error.code === "PRODUCTION_CODE_ALREADY_EXISTS",
    );
    assert.equal((await service.getOrder(order.id))?.id, order.id);
    assert.equal((await service.getTransformationOrder(child.id))?.id, child.id);
    assert.equal((await service.listTransformationOrders({ page: 1, pageSize: 10 })).items.some((item) => item.id === child.id), true);
    await assert.rejects(service.closeOrder(order.id, context), (error: any) => error.code === "PRODUCTION_ORDER_NOT_CLOSABLE");
    await service.closeTransformationOrder(child.id, context);
    await assert.rejects(service.closeTransformationOrder(child.id, context), (error: any) => error.code === "TRANSFORMATION_ORDER_CLOSED");
    await service.closeOrder(order.id, context);
    await assert.rejects(service.closeOrder(order.id, context), (error: any) => error.code === "PRODUCTION_ORDER_CLOSED");
    await assert.rejects(
      service.createTransformationOrder({ code: "AFTER-CLOSE", productionOrderId: order.id, periodStart: new Date() }, context),
      (error: any) => error.code === "PRODUCTION_ORDER_CLOSED",
    );
    const rollbackCode = `P2-ROLLBACK-${randomUUID()}`;
    await assert.rejects(service.createOrder({ code: rollbackCode, startDate: new Date() }, { actorUserId: randomUUID(), requestId: randomUUID() }));
    assert.equal(await prisma.productionOrder.count({ where: { code: rollbackCode } }), 0);
  });

  it("serializes concurrent closes so exactly one transition succeeds", integrationOptions, async () => {
    assert.ok(prisma && service);
    const context = { actorUserId, requestId: randomUUID() };
    const order = await service.createOrder({ code: `P2-CONCURRENT-CLOSE-${randomUUID()}`, startDate: new Date() }, context);
    orderIds.push(order.id);

    const results = await Promise.allSettled([
      service.closeOrder(order.id, { ...context, requestId: randomUUID() }),
      service.closeOrder(order.id, { ...context, requestId: randomUUID() }),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    assert.ok(rejected);
    assert.equal(rejected.reason.code, "PRODUCTION_ORDER_CLOSED");
    const persisted = await prisma.productionOrder.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(persisted.status, "CLOSED");
    assert.equal(persisted.version, 1);
  });

  it("never leaves a closed parent with an open child during a concurrent race", integrationOptions, async () => {
    assert.ok(prisma && service);
    const context = { actorUserId, requestId: randomUUID() };
    const order = await service.createOrder({ code: `P2-CONCURRENT-CHILD-${randomUUID()}`, startDate: new Date() }, context);
    orderIds.push(order.id);

    const results = await Promise.allSettled([
      service.closeOrder(order.id, { ...context, requestId: randomUUID() }),
      service.createTransformationOrder({
        code: "CONCURRENT",
        productionOrderId: order.id,
        periodStart: new Date(),
      }, { ...context, requestId: randomUUID() }),
    ]);

    for (const result of results) {
      if (result.status === "fulfilled" && "productionOrderId" in result.value) {
        transformationIds.push(result.value.id);
      }
    }
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    assert.ok(rejected);
    assert.ok(
      ["PRODUCTION_ORDER_CLOSED", "PRODUCTION_ORDER_NOT_CLOSABLE"].includes(rejected.reason.code),
      `unexpected concurrent error ${rejected.reason?.name}/${rejected.reason?.code}: ${rejected.reason?.message}`,
    );

    const persisted = await prisma.productionOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { transformationOrders: true },
    });
    assert.equal(
      persisted.status === "CLOSED" && persisted.transformationOrders.some((item) => item.status === "OPEN"),
      false,
    );
  });
});