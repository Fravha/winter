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
const verifier = { async verify() { return { uid: "p8-http" }; } } as unknown as TokenVerifier;
const user: AuthenticatedUser = { id: "user-id", firebaseUid: "p8-http", email: "p8@example.com", displayName: "P8", status: "ACTIVE", lastLoginAt: null, roles: [], permissions: ["production:read", "production:transformation_create"] };
const users: UserRepository = { async findByFirebaseUid() { return user; }, async updateLastLoginAt() {} };
const calls: string[] = [];
const service = {
  listTransformations: async (q: unknown) => { calls.push(`list:${JSON.stringify(q)}`); return { items: [{ id }], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } }; },
  getTransformation: async (value: string) => { calls.push(`get:${value}`); return { id: value }; },
  createTransformation: async (body: unknown) => { calls.push(`create:${JSON.stringify(body)}`); return { id, ...(body as object) }; },
} as unknown as ProductionService;

async function request(method: string, path: string, permissions: string[], body?: unknown) {
  const app = express(); app.use(requestContext); app.use(express.json());
  const scoped: UserRepository = { async findByFirebaseUid() { return { ...user, permissions }; }, async updateLastLoginAt() {} };
  app.use("/production", createProductionRouter(verifier, scoped, service)); app.use(errorHandler);
  const server = app.listen(0); await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/production${path}`, { method, headers: { authorization: "Bearer valid", "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { response, text: await response.text() };
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
const body = {
  productionOrderId: id, performedAt: "2026-01-02T03:04:05.000Z", operationKey: "p8-http-key", requestHash: "p8-http-hash",
  inputs: [{ productionBatchId: id, quantity: "1.000" }], outputs: [{ articuloId: id, quantity: "1.000", unit: "KG" }],
};

describe("Production P8 HTTP contracts and RBAC", () => {
  it("supports list/detail/create with the required permissions", async () => {
    calls.length = 0;
    assert.equal((await request("GET", "/transformations?page=1", ["production:read"])).response.status, 200);
    assert.equal((await request("GET", `/transformations/${id}`, ["production:read"])).response.status, 200);
    assert.equal((await request("POST", "/transformations", ["production:transformation_create"], body)).response.status, 201);
    assert.equal(calls.length, 3);
  });
  it("rejects missing RBAC, invalid strict payloads and destructive routes without service calls", async () => {
    calls.length = 0;
    assert.equal((await request("GET", "/transformations", [])).response.status, 403);
    assert.equal((await request("POST", "/transformations", [], body)).response.status, 403);
    assert.equal((await request("POST", "/transformations", ["production:transformation_create"], { ...body, inputs: [] })).response.status, 400);
    assert.equal((await request("POST", "/transformations", ["production:transformation_create"], { ...body, outputs: [{ articuloId: id, quantity: "0", unit: "KG" }] })).response.status, 400);
    assert.equal((await request("POST", "/transformations", ["production:transformation_create"], { ...body, extra: true })).response.status, 400);
    assert.equal((await request("PATCH", `/transformations/${id}`, ["production:transformation_create"], {})).response.status, 404);
    assert.equal((await request("DELETE", `/transformations/${id}`, ["production:transformation_create"])).response.status, 404);
    assert.equal(calls.length, 0);
  });
  it("requires loss permission only when embedded losses are present", async () => {
    const withLoss = { ...body, losses: [{ quantity: "0.100", unit: "KG" }] };
    assert.equal((await request("POST", "/transformations", ["production:transformation_create"], withLoss)).response.status, 403);
    assert.equal((await request("POST", "/transformations", ["production:transformation_create", "production:loss_create"], withLoss)).response.status, 201);
  });
});