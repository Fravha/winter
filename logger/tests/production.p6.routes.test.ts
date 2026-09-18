import assert from "node:assert/strict";
import express from "express";
import { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import { createProductionRouter } from "../src/modules/production/production.routes.js";
import { errorHandler } from "../src/shared/http/error-handler.js";
import { requestContext } from "../src/shared/http/request-context.js";
import type { TokenVerifier, AuthenticatedUser } from "../src/core/auth/auth.types.js";
import type { UserRepository } from "../src/core/users/user.repository.js";
import type { ProductionService } from "../src/modules/production/production.service.js";
const id = "00000000-0000-4000-8000-000000000001";
const verifier = { async verify() { return { uid: "p6-http" }; } } as unknown as TokenVerifier;
const user: AuthenticatedUser = { id, firebaseUid: "p6-http", email: "p6@example.com", displayName: "P6", status: "ACTIVE", lastLoginAt: null, roles: [], permissions: ["production:read", "production:reception_create"] };
let calls: string[] = [];
const service = {
  listReceptions: async () => { calls.push("list"); return { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }; },
  getReception: async (value: string) => { calls.push(`get:${value}`); return { id: value, items: [] }; },
  createReception: async () => { calls.push("create"); return { reception: { id }, items: [], batchIds: [] }; },
} as unknown as ProductionService;
async function request(method: string, path: string, permissions: string[], body?: unknown) {
  const app = express(); app.use(requestContext); app.use(express.json());
  const scopedUsers: UserRepository = { async findByFirebaseUid() { return { ...user, permissions }; }, async updateLastLoginAt() {} };
  app.use("/production", createProductionRouter(verifier, scopedUsers, service)); app.use(errorHandler);
  const server = app.listen(0); await new Promise<void>(resolve => server.once("listening", resolve));
  try { const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/production${path}`, { method, headers: { authorization: "Bearer valid", "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); const text = await response.text(); let json: any = {}; try { json = JSON.parse(text); } catch {} return { response, json }; }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
describe("Production P6 HTTP contracts and RBAC", () => {
  it("serves list/detail/create and separates permissions", async () => {
    calls = [];
    assert.equal((await request("GET", "/grape-receptions", ["production:read"])).response.status, 200);
    assert.equal((await request("GET", `/grape-receptions/${id}`, ["production:read"])).response.status, 200);
    const body = { productionOrderId: id, receivedAt: "2025-01-01T00:00:00.000Z", status: "ACCEPTED", items: [{ grapeVarietyId: id, articuloId: id, quantity: "1.000", unit: "KG" }], operationKey: "p6-http", requestHash: "hash" };
    assert.equal((await request("POST", "/grape-receptions", ["production:reception_create"], body)).response.status, 201);
    assert.equal((await request("POST", "/grape-receptions", ["production:read"], body)).response.status, 403);
    assert.deepEqual(calls, ["list", `get:${id}`, "create"]);
  });
  it("requires idempotency and rejects malformed bodies and mutation routes", async () => {
    const body = { productionOrderId: id, receivedAt: "2025-01-01T00:00:00.000Z", status: "ACCEPTED", items: [{ grapeVarietyId: id, articuloId: id, quantity: "1.000", unit: "KG" }] };
    assert.equal((await request("POST", "/grape-receptions", ["production:reception_create"], body)).response.status, 400);
    assert.equal((await request("POST", "/grape-receptions", ["production:reception_create"], { ...body, operationKey: "x", requestHash: "h", extra: true })).response.status, 400);
    assert.equal((await request("PATCH", `/grape-receptions/${id}`, ["production:reception_create"], {})).response.status, 404);
    assert.equal((await request("DELETE", `/grape-receptions/${id}`, ["production:reception_create"])).response.status, 404);
  });
});