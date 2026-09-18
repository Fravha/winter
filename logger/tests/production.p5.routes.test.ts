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
const verifier = { async verify() { return { uid: "p5-http" }; } } as unknown as TokenVerifier;
const user: AuthenticatedUser = { id: "user-id", firebaseUid: "p5-http", email: "p5@example.com", displayName: "P5", status: "ACTIVE", lastLoginAt: null, roles: [], permissions: ["production:read", "production:work_create", "production:work_correct"] };
const users: UserRepository = { async findByFirebaseUid() { return user; }, async updateLastLoginAt() {} };
const calls: string[] = [];
const service = {
  listWorks: async () => { calls.push("list"); return { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }; },
  getWork: async (value: string) => { calls.push(`get:${value}`); return { id: value }; },
  createWork: async () => { calls.push("create"); return { id }; },
  correctWork: async () => { calls.push("correct"); return { id }; },
} as unknown as ProductionService;

async function request(method: string, path: string, permissions: string[], body?: unknown) {
  const app = express(); app.use(requestContext); app.use(express.json());
  const scopedUser = { ...user, permissions };
  const scopedUsers: UserRepository = { async findByFirebaseUid() { return scopedUser; }, async updateLastLoginAt() {} };
  app.use("/production", createProductionRouter(verifier, scopedUsers, service)); app.use(errorHandler);
  const server = app.listen(0); await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/production${path}`, { method, headers: { authorization: "Bearer valid", "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await response.text(); let json: any = {}; try { json = JSON.parse(text); } catch {}
    return { response, json };
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

describe("Production P5 HTTP contracts and RBAC", () => {
  it("serves all work endpoints with validated success contracts", async () => {
    calls.length = 0;
    assert.equal((await request("GET", "/works", ["production:read"])).response.status, 200);
    assert.equal((await request("GET", `/works/${id}`, ["production:read"])).response.status, 200);
    assert.equal((await request("POST", "/works", ["production:work_create"], { productionOrderId: id, workTypeId: id, performedAt: "2024-01-01T00:00:00.000Z" })).response.status, 201);
    assert.equal((await request("POST", `/works/${id}/corrections`, ["production:work_correct"], { field: "observations", newValue: "x", reason: "reason" })).response.status, 200);
    assert.deepEqual(calls, ["list", `get:${id}`, "create", "correct"]);
  });

  it("separates read/create/correct permissions", async () => {
    for (const [method, path, permission, body] of [
      ["GET", "/works", "production:read", undefined],
      ["GET", `/works/${id}`, "production:read", undefined],
      ["POST", "/works", "production:work_create", { productionOrderId: id, workTypeId: id, performedAt: "2024-01-01T00:00:00.000Z" }],
      ["POST", `/works/${id}/corrections`, "production:work_correct", { field: "observations", newValue: "x", reason: "r" }],
    ] as const) {
      const result = await request(method, path, [], body);
      assert.equal(result.response.status, 403);
      assert.equal(result.json.error.code, "AUTH_FORBIDDEN");
    }
    assert.equal((await request("POST", "/works", ["production:read"], { productionOrderId: id, workTypeId: id, performedAt: "2024-01-01T00:00:00.000Z" })).response.status, 403);
    assert.equal((await request("POST", `/works/${id}/corrections`, ["production:read"], { field: "observations", newValue: "x", reason: "r" })).response.status, 403);
  });

  it("rejects malformed bodies and does not expose PATCH or DELETE", async () => {
    assert.equal((await request("POST", "/works", ["production:work_create"], { productionOrderId: id })).response.status, 400);
    assert.equal((await request("POST", `/works/${id}/corrections`, ["production:work_correct"], { field: "bad", newValue: "x", reason: "r" })).response.status, 400);
    assert.equal((await request("PATCH", `/works/${id}`, ["production:work_create"], {})).response.status, 404);
    assert.equal((await request("DELETE", `/works/${id}`, ["production:work_create"])).response.status, 404);
  });
});