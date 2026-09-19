import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import express from "express";
import type { TokenVerifier } from "../src/core/auth/auth.types.js";
import type { AuthenticatedUser } from "../src/core/users/user.types.js";
import type { UserRepository } from "../src/core/users/user.repository.js";
import type { ProductionService } from "../src/modules/production/production.service.js";
import { createProductionRouter } from "../src/modules/production/production.routes.js";
import { errorHandler } from "../src/shared/http/error-handler.js";
import { requestContext } from "../src/shared/http/request-context.js";
import { AppError } from "../src/shared/errors/app-error.js";
import { ProductionTraceService } from "../src/modules/production/production.trace.js";

const id = "00000000-0000-4000-8000-000000000001";
const verifier: TokenVerifier = { async verify() { return { uid: "p11-hardening" }; } };

function makeService() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const page = { items: [], pagination: { page: 2, pageSize: 5, total: 0, totalPages: 0 } };
  const record = (method: string, result: unknown) => async (...args: unknown[]) => {
    calls.push({ method, args });
    if (result instanceof Error) throw result;
    return result;
  };
  return {
    calls,
    service: {
      list: record("list", page),
      listOrders: record("listOrders", page),
      getOrder: record("getOrder", null),
      createOrder: record("createOrder", { id }),
    } as unknown as ProductionService,
  };
}

async function request(
  method: string,
  path: string,
  permissions: string[],
  body?: unknown,
  serviceOverride?: ProductionService,
) {
  const user: AuthenticatedUser = {
    id: "user-id", firebaseUid: "p11-hardening", email: "p11@example.test",
    displayName: "P11", status: "ACTIVE", lastLoginAt: null, roles: [], permissions,
  };
  const users: UserRepository = {
    async findByFirebaseUid() { return user; },
    async updateLastLoginAt() {},
  };
  const mock = makeService();
  const app = express();
  app.use(requestContext);
  app.use(express.json());
  app.use("/production", createProductionRouter(verifier, users, serviceOverride ?? mock.service));
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/production${path}`, {
      method,
      headers: { authorization: "Bearer valid", "content-type": "application/json", "x-request-id": "p11-hardening" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { response, text: await response.text(), calls: mock.calls };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe("P11 contractual HTTP hardening", () => {
  it("keeps read permission separate from commands and rejects actor fields from bodies", async () => {
    const read = await request("GET", "/orders?page=2&pageSize=5&status=OPEN", ["production:read"]);
    assert.equal(read.response.status, 200);
    assert.deepEqual(JSON.parse(read.text).meta, { page: 2, pageSize: 5, total: 0, totalPages: 0 });
    const command = await request("POST", "/orders", ["production:read"], { code: "P11", startDate: "2026-01-01T00:00:00.000Z" });
    assert.equal(command.response.status, 403);
    const actor = await request("POST", "/orders", ["production:order_create"], {
      code: "P11", startDate: "2026-01-01T00:00:00.000Z", userId: id,
    });
    assert.equal(actor.response.status, 400);
    assert.equal(actor.calls.length, 0);
  });

  it("enforces query page-size limits, empty results, and missing-resource errors", async () => {
    const tooLarge = await request("GET", "/orders?page=1&pageSize=101", ["production:read"]);
    assert.equal(tooLarge.response.status, 400);
    const validation = JSON.parse(tooLarge.text) as { error: { details?: { formErrors?: unknown } } };
    assert.ok(validation.error.details?.fieldErrors !== undefined);
    const missing = await request("GET", `/orders/${id}`, ["production:read"]);
    assert.equal(missing.response.status, 404);
    const body = JSON.parse(missing.text) as { error: { code: string } };
    assert.equal(body.error.code, "PRODUCTION_ORDER_NOT_FOUND");
  });

  it("redacts unexpected infrastructure details from HTTP errors", async () => {
    const service = {
      listOrders: async () => {
        throw new Error("PrismaClientKnownRequestError SQL SELECT secret=token requestHash=internal");
      },
    } as unknown as ProductionService;
    const result = await request("GET", "/orders", ["production:read"], undefined, service);
    assert.equal(result.response.status, 500);
    assert.deepEqual(JSON.parse(result.text), {
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId: "p11-hardening" },
    });
    for (const sensitive of ["Prisma", "SQL", "secret", "requestHash", "stack", "token"]) {
      assert.equal(result.text.includes(sensitive), false, `response leaked ${sensitive}`);
    }
  });

  it("redacts details from domain errors in production-shaped responses", async () => {
    const service = {
      listOrders: async () => {
        throw new AppError("ORDER_CONFLICT", "Order conflict", 409, {
          sql: "SELECT * FROM users", requestHash: "internal", secret: "token",
        });
      },
    } as unknown as ProductionService;
    const result = await request("GET", "/orders", ["production:read"], undefined, service);
    assert.equal(result.response.status, 409);
    assert.deepEqual(JSON.parse(result.text), {
      error: { code: "ORDER_CONFLICT", message: "Order conflict", requestId: "p11-hardening" },
    });
  });
});

type FakePrisma = ConstructorParameters<typeof ProductionTraceService>[0];

function tracePrisma(edges: Array<{ id: string; parentBatchId: string; childBatchId: string; quantity: string; unit: string; operationKey: string; createdAt: Date }>, ledger = false): FakePrisma {
  const root = {
    id, code: "P11-BATCH", productionOrderId: id, articuloId: id, unit: "KG",
    createdAt: new Date("2026-01-01T00:00:00.000Z"), observations: null, version: 0,
    productionOrder: { id, code: "P11-ORDER", status: "OPEN", startDate: new Date("2026-01-01T00:00:00.000Z"), observations: null, closedAt: null },
    balance: { generated: "10", consumed: "1", separated: "0", lost: "0", transferredToInventory: "0", available: "9" },
  };
  return {
    productionBatch: {
      findUnique: async () => root,
      findMany: async () => [root],
    },
    productionBatchLineage: { findMany: async ({ where }: any) => {
      const layer = [...(where.OR?.[0]?.parentBatchId?.in ?? []), ...(where.OR?.[1]?.childBatchId?.in ?? [])];
      return edges.filter((edge) => layer.includes(edge.parentBatchId) || layer.includes(edge.childBatchId));
    } },
    articulo: { findMany: async () => [] },
    productionBatchLedgerEntry: { findMany: async () => ledger ? [{
      id: "ledger-1", productionBatchId: id, entryType: "GENERATED", quantity: "10.000",
      unit: "KG", occurredAt: new Date("2026-01-01T00:00:00.000Z"), operationKey: "p11",
      metadata: { requestHash: "must-not-leak", nested: { requestHash: "also-hidden", ok: "yes" } },
    }] : [] },
    grapeReception: { findMany: async () => [] },
    transformation: { findMany: async () => [] },
    productionWorkBatch: { findMany: async () => [] },
    productionWork: { findMany: async () => [] },
    productionContainerOccupancy: { findMany: async () => [] },
    productionWorkContainer: { findMany: async () => [] },
    productionContainer: { findMany: async () => [] },
    productionMeasurement: { findMany: async () => [] },
    productionLoss: { findMany: async () => [] },
    inventoryLot: { findMany: async () => [] },
    inventoryMovement: { findMany: async () => [] },
    inventoryStock: { findMany: async () => [] },
  } as unknown as FakePrisma;
}

describe("P11 trace hardening boundaries", () => {
  it("deduplicates cycles and serializes dates/decimals while removing requestHash", async () => {
    const service = new ProductionTraceService(tracePrisma([
      { id: "edge-a", parentBatchId: id, childBatchId: "batch-b", quantity: "1.000", unit: "KG", operationKey: "a", createdAt: new Date("2026-01-01T00:00:00.000Z") },
      { id: "edge-b", parentBatchId: "batch-b", childBatchId: id, quantity: "1.000", unit: "KG", operationKey: "b", createdAt: new Date("2026-01-02T00:00:00.000Z") },
    ], true));
    const result = await service.get(id);
    assert.equal(result.batches.length, 1);
    assert.equal(result.lineage.length, 2);
    assert.equal(result.batches[0]?.createdAt, "2026-01-01T00:00:00.000Z");
    assert.equal(result.ledger[0]?.quantity, "10.000");
    assert.deepEqual(result.ledger[0]?.metadata, { nested: { ok: "yes" } });
    assert.equal(JSON.stringify(result).includes("requestHash"), false);
  });

  it("enforces the 100-level trace depth limit", async () => {
    const edges = Array.from({ length: 101 }, (_, index) => ({
      id: `edge-${index}`, parentBatchId: index === 0 ? id : `batch-${index}`,
      childBatchId: `batch-${index + 1}`, quantity: "1", unit: "KG", operationKey: `op-${index}`,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }));
    await assert.rejects(() => new ProductionTraceService(tracePrisma(edges)).get(id), (error: any) => error.code === "TRACE_LIMIT_EXCEEDED");
  });

  it("accepts exactly 100 levels but rejects the 101st", async () => {
    const edges = (count: number) => Array.from({ length: count }, (_, index) => ({
      id: `depth-edge-${count}-${index}`, parentBatchId: index === 0 ? id : `depth-${index}`,
      childBatchId: `depth-${index + 1}`, quantity: "1", unit: "KG", operationKey: `depth-op-${index}`,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }));
    await new ProductionTraceService(tracePrisma(edges(100))).get(id);
    await assert.rejects(() => new ProductionTraceService(tracePrisma(edges(101))).get(id), (error: any) => error.code === "TRACE_LIMIT_EXCEEDED");
  });

  it("accepts exactly 1000 batches but rejects the 1001st", async () => {
    const edges = (count: number) => Array.from({ length: count - 1 }, (_, index) => ({
      id: `count-edge-${count}-${index}`, parentBatchId: id,
      childBatchId: `count-${index + 1}`, quantity: "1", unit: "KG", operationKey: `count-op-${index}`,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }));
    await new ProductionTraceService(tracePrisma(edges(1000))).get(id);
    await assert.rejects(() => new ProductionTraceService(tracePrisma(edges(1001))).get(id), (error: any) => error.code === "TRACE_LIMIT_EXCEEDED");
  });
});