import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { AuditService } from "../src/core/audit/audit.service.js";
import type { AuditRepository } from "../src/core/audit/audit.repository.js";
import { ProductionService } from "../src/modules/production/production.service.js";

function fixture() {
  const orders: any[] = [];
  const transformations: any[] = [];
  let failAudit = false;
  const auditRows: any[] = [];
  const auditRepository: AuditRepository = {
    async create(row) { if (failAudit) throw new Error("audit failure"); auditRows.push(row); },
  };
  const tx: any = {
    auditLog: {
      create: async ({ data }: any) => { if (failAudit) throw new Error("audit failure"); auditRows.push(data); return data; },
    },
    productionOrder: {
      findUnique: async ({ where }: any) => orders.find((x) => where.id ? x.id === where.id : x.code === where.code) ?? null,
      create: async ({ data }: any) => { const item = { id: randomUUID(), status: "OPEN", version: 0, createdAt: new Date(), updatedAt: new Date(), ...data }; orders.push(item); return item; },
      findMany: async ({ where, skip, take }: any) => orders.filter((x) => !where?.status || x.status === where.status).slice(skip, skip + take),
      count: async ({ where }: any) => orders.filter((x) => !where?.status || x.status === where.status).length,
      update: async ({ where, data }: any) => { const item = orders.find((x) => x.id === where.id && x.version === where.version); if (!item) throw new Error("stale"); Object.assign(item, data, { version: item.version + 1, updatedAt: new Date() }); if (item.version && typeof data.version === "object") item.version = where.version + 1; return item; },
    },
    transformationOrder: {
      findUnique: async ({ where }: any) => where.id ? transformations.find((x) => x.id === where.id) ?? null : transformations.find((x) => x.productionOrderId === where.productionOrderId_code.productionOrderId && x.code === where.productionOrderId_code.code) ?? null,
      create: async ({ data }: any) => { const item = { id: randomUUID(), status: "OPEN", version: 0, createdAt: new Date(), updatedAt: new Date(), ...data }; transformations.push(item); return item; },
      findMany: async ({ where, skip, take }: any) => transformations.filter((x) => !where?.status || x.status === where.status).slice(skip, skip + take),
      count: async ({ where }: any) => transformations.filter((x) => !where?.status || x.status === where.status).length,
      update: async ({ where, data }: any) => { const item = transformations.find((x) => x.id === where.id && x.version === where.version); if (!item) throw new Error("stale"); Object.assign(item, data, { version: where.version + 1, updatedAt: new Date() }); return item; },
    },
  };
  const prisma: any = {
    ...tx,
    $transaction: async (work: (value: any) => Promise<unknown>) => {
      const ordersSnapshot = structuredClone(orders);
      const transformationsSnapshot = structuredClone(transformations);
      try { return await work(tx); } catch (error) { orders.splice(0, orders.length, ...ordersSnapshot); transformations.splice(0, transformations.length, ...transformationsSnapshot); throw error; }
    },
  };
  return { service: new ProductionService(prisma as PrismaClient, new AuditService(auditRepository)), orders, transformations, auditRows, setFailAudit: (value: boolean) => { failAudit = value; } };
}

const context = { actorUserId: randomUUID(), requestId: "p2-test", ipAddress: "127.0.0.1" };

describe("Production P2 service/domain", () => {
  it("supports create/get/paginated list/close and irreversible lifecycle for both aggregates", async () => {
    const f = fixture();
    const order = await f.service.createOrder({ code: "PO-1", startDate: new Date("2026-01-01") }, context);
    assert.equal(order.status, "OPEN");
    assert.equal((await f.service.getOrder(order.id))?.id, order.id);
    assert.equal((await f.service.listOrders({ page: 1, pageSize: 1 })).pagination.total, 1);
    const child = await f.service.createTransformationOrder({ code: "TO-1", productionOrderId: order.id, periodStart: new Date("2026-01-01") }, context);
    assert.equal(child.status, "OPEN");
    assert.equal((await f.service.getTransformationOrder(child.id))?.id, child.id);
    assert.equal((await f.service.listTransformationOrders({ page: 1, pageSize: 1 })).pagination.total, 1);
    await assert.rejects(() => f.service.closeOrder(order.id, context), (error: any) => error.code === "PRODUCTION_ORDER_NOT_CLOSABLE");
    await f.service.closeTransformationOrder(child.id, context);
    await assert.rejects(() => f.service.closeTransformationOrder(child.id, context), (error: any) => error.code === "TRANSFORMATION_ORDER_CLOSED");
    await f.service.closeOrder(order.id, context);
    await assert.rejects(() => f.service.closeOrder(order.id, context), (error: any) => error.code === "PRODUCTION_ORDER_CLOSED");
    await assert.rejects(() => f.service.createTransformationOrder({ code: "TO-2", productionOrderId: order.id, periodStart: new Date() }, context), (error: any) => error.code === "PRODUCTION_ORDER_CLOSED");
    assert.equal(f.auditRows.length, 4);
  });

  it("enforces not-found, code uniqueness and rolls back writes when audit fails", async () => {
    const f = fixture();
    await assert.rejects(() => f.service.closeOrder(randomUUID(), context), (error: any) => error.code === "PRODUCTION_ORDER_NOT_FOUND");
    const order = await f.service.createOrder({ code: "GLOBAL-CODE", startDate: new Date() }, context);
    await assert.rejects(() => f.service.createOrder({ code: "GLOBAL-CODE", startDate: new Date() }, context), (error: any) => error.code === "PRODUCTION_CODE_ALREADY_EXISTS");
    await f.service.createTransformationOrder({ code: "CHILD", productionOrderId: order.id, periodStart: new Date() }, context);
    await assert.rejects(() => f.service.createTransformationOrder({ code: "CHILD", productionOrderId: order.id, periodStart: new Date() }, context), (error: any) => error.code === "PRODUCTION_CODE_ALREADY_EXISTS");
    f.setFailAudit(true);
    await assert.rejects(() => f.service.createOrder({ code: "ROLLBACK", startDate: new Date() }, context));
    assert.equal(f.orders.some((item) => item.code === "ROLLBACK"), false);
  });
});