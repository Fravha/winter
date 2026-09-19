import assert from "node:assert/strict";
import express from "express";
import { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import { createProductionRouter } from "../src/modules/production/production.routes.js";
import { errorHandler } from "../src/shared/http/error-handler.js";
import { requestContext } from "../src/shared/http/request-context.js";
import type { AuthenticatedUser, TokenVerifier } from "../src/core/auth/auth.types.js";
import type { UserRepository } from "../src/core/users/user.repository.js";
import type { ProductionService } from "../src/modules/production/production.service.js";

const id = "00000000-0000-4000-8000-000000000001";
const verifier = { async verify() { return { uid: "p7-http" }; } } as unknown as TokenVerifier;
const user: AuthenticatedUser = { id: "user-id", firebaseUid: "p7-http", email: "p7@example.com", displayName: "P7", status: "ACTIVE", lastLoginAt: null, roles: [], permissions: ["production:read", "production:measurement_create"] };
const users: UserRepository = { async findByFirebaseUid() { return user; }, async updateLastLoginAt() {} };
const calls: string[] = [];
const service = {
  listMeasurements: async (q: unknown) => { calls.push(`list:${JSON.stringify(q)}`); return { items: [{ id, value: "1.000001", measuredAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:01.000Z" }], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }; },
  getMeasurement: async (value: string) => { calls.push(`get:${value}`); return { id: value, value: "0", measuredAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:01.000Z" }; },
  createMeasurement: async (body: unknown) => { calls.push(`create:${JSON.stringify(body)}`); return { id, ...(body as object), value: "1.000001", measuredAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:01.000Z" }; },
} as unknown as ProductionService;

async function request(method: string, path: string, permissions: string[], body?: unknown) {
  const app = express(); app.use(requestContext); app.use(express.json());
  const scoped: UserRepository = { async findByFirebaseUid() { return { ...user, permissions }; }, async updateLastLoginAt() {} };
  app.use("/production", createProductionRouter(verifier, scoped, service)); app.use(errorHandler);
  const server = app.listen(0); await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/production${path}`, { method, headers: { authorization: "Bearer valid", "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text(); let json: any = {}; try { json = JSON.parse(text); } catch {}
    return { response, json };
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
const body = { measurementTypeId: id, productionBatchId: id, value: "1.000001", unit: " kg ", measuredAt: "2026-01-01T00:00:00.000Z", observations: "note" };

describe("Production P7 HTTP contracts and RBAC", () => {
  it("forwards strict list/detail/create requests and DTOs", async () => {
    calls.length = 0;
    assert.equal((await request("GET", "/measurements?page=1", ["production:read"])).response.status, 200);
    assert.equal((await request("GET", `/measurements/${id}`, ["production:read"])).response.status, 200);
    assert.equal((await request("POST", "/measurements", ["production:measurement_create"], body)).response.status, 201);
    assert.equal(calls.length, 3);
    assert.match(calls[2]!, /measurementTypeId/);
  });
  it("enforces RBAC and strict HTTP input without calling service", async () => {
    calls.length = 0;
    for (const [method, path, bodyValue] of [["GET", "/measurements", undefined], ["POST", "/measurements", body]] as const) {
      assert.equal((await request(method, path, [])).response.status, 403);
    }
    assert.equal((await request("POST", "/measurements", ["production:measurement_create"], { ...body, value: 1 })).response.status, 400);
    assert.equal((await request("POST", "/measurements", ["production:measurement_create"], { ...body, value: "not-a-decimal" })).response.status, 400);
    assert.equal((await request("POST", "/measurements", ["production:measurement_create"], { ...body, value: "1.1234567" })).response.status, 400);
    assert.equal((await request("POST", "/measurements", ["production:measurement_create"], { ...body, productionBatchId: undefined, value: "1" })).response.status, 400);
    assert.equal((await request("PATCH", `/measurements/${id}`, ["production:measurement_create"], {})).response.status, 404);
    assert.equal((await request("DELETE", `/measurements/${id}`, ["production:measurement_create"])).response.status, 404);
    assert.equal(calls.length, 0);
  });
});