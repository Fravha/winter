import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { describe, it } from "node:test";
import type { TokenVerifier } from "../src/core/auth/auth.types.js";
import type { AuthenticatedUser } from "../src/core/users/user.types.js";
import type { UserRepository } from "../src/core/users/user.repository.js";
import type { ProductionService } from "../src/modules/production/production.service.js";
import { createProductionRouter } from "../src/modules/production/production.routes.js";
import { errorHandler } from "../src/shared/http/error-handler.js";
import { requestContext } from "../src/shared/http/request-context.js";

const id = "00000000-0000-4000-8000-000000000001";
const verifier: TokenVerifier = { async verify() { return { uid: "p2-firebase", email: "p2@example.com" }; } };
const allPermissions = ["production:read", "production:order_create", "production:order_close", "production:transformation_order_create", "production:transformation_order_close"];

async function request(method: string, path: string, permissions = allPermissions, body?: unknown) {
  const calls: { method: string; args: unknown[] }[] = [];
  const record = (name: string, result: unknown) => async (...args: unknown[]) => { calls.push({ method: name, args }); return result; };
  const service = {
    list: record("list", { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
    create: record("create", {}),
    update: record("update", {}),
    setActive: record("setActive", {}),
    listDefinitions: record("listDefinitions", []),
    createDefinition: record("createDefinition", {}),
    updateDefinition: record("updateDefinition", {}),
    setDefinitionActive: record("setDefinitionActive", {}),
    setValue: record("setValue", {}),
    listOrders: record("listOrders", { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
    getOrder: record("getOrder", { id }),
    createOrder: record("createOrder", { id }),
    closeOrder: record("closeOrder", { id }),
    listTransformationOrders: record("listTransformationOrders", { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
    getTransformationOrder: record("getTransformationOrder", { id }),
    createTransformationOrder: record("createTransformationOrder", { id }),
    closeTransformationOrder: record("closeTransformationOrder", { id }),
    listBatches: record("listBatches", { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
    getBatch: record("getBatch", { id, balance: { productionBatchId: id, available: "0.000" } }),
    getBatchBalance: record("getBatchBalance", { productionBatchId: id, unit: "KG", available: "0.000" }),
  } as unknown as ProductionService;
  const user: AuthenticatedUser = { id: "user-id", firebaseUid: "p2-firebase", email: "p2@example.com", displayName: "P2", status: "ACTIVE", lastLoginAt: null, roles: [], permissions };
  const users: UserRepository = { async findByFirebaseUid() { return user; }, async updateLastLoginAt() {} };
  const app = express();
  app.use(requestContext);
  app.use(express.json());
  app.use("/production", createProductionRouter(verifier, users, service));
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/production${path}`, { method, headers: { authorization: "Bearer valid", "content-type": "application/json", "x-request-id": "p2-http" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { response, json: await response.json() as unknown, calls };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe("Production P2 HTTP contracts and RBAC", () => {
  const endpoints = [
    ["GET", "/orders", "production:read"], ["GET", `/orders/${id}`, "production:read"],
    ["POST", "/orders", "production:order_create"], ["POST", `/orders/${id}/close`, "production:order_close"],
    ["GET", "/transformation-orders", "production:read"], ["GET", `/transformation-orders/${id}`, "production:read"],
    ["POST", "/transformation-orders", "production:transformation_order_create"], ["POST", `/transformation-orders/${id}/close`, "production:transformation_order_close"],
    ["GET", "/batches", "production:read"], ["GET", `/batches/${id}`, "production:read"], ["GET", `/batches/${id}/balance`, "production:read"],
  ] as const;
  for (const [method, path, permission] of endpoints) {
    it(`denies ${method} ${path} without ${permission}`, async () => {
      const result = await request(method, path, []);
      assert.equal(result.response.status, 403);
      assert.equal((result.json as any).error.code, "AUTH_FORBIDDEN");
    });
  }
  it("exposes all eleven endpoints and propagates actor/request context", async () => {
    for (const [method, path] of endpoints) {
      const body = method === "POST" && path === "/orders" ? { code: "PO", startDate: "2026-01-01T00:00:00.000Z" } : method === "POST" && path === "/transformation-orders" ? { code: "TO", productionOrderId: id, periodStart: "2026-01-01T00:00:00.000Z" } : undefined;
      const result = await request(method, path, allPermissions, body);
      assert.notEqual(result.response.status, 404);
      if (method === "POST" && (path === "/orders" || path === "/transformation-orders")) {
        const args = result.calls[0]?.args as unknown[];
        assert.equal((args[1] as any).actorUserId, "user-id");
        assert.equal((args[1] as any).requestId, "p2-http");
      }
    }
  });
  it("rejects strict create payloads before service invocation", async () => {
    const result = await request("POST", "/orders", ["production:order_create"], { code: "PO", startDate: "2026-01-01T00:00:00.000Z", unexpected: true });
    assert.equal(result.response.status, 400);
    assert.equal(result.calls.length, 0);
  });
});