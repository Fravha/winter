import assert from "node:assert/strict";
import express from "express";
import { after, describe, it } from "node:test";
import { AddressInfo } from "node:net";
import { createProductionRouter } from "../src/modules/production/production.routes.js";
import { errorHandler } from "../src/shared/http/error-handler.js";
import { requestContext } from "../src/shared/http/request-context.js";
import type { AuthenticatedUser } from "../src/core/auth/auth.types.js";
import type { TokenVerifier } from "../src/core/auth/auth.types.js";
import type { UserRepository } from "../src/core/users/user.repository.js";
import type { ProductionService } from "../src/modules/production/production.service.js";

const id = "00000000-0000-4000-8000-000000000001";
const verifier = { async verify() { return { uid: "p4-http" }; } } as unknown as TokenVerifier;
const all = ["production:read", "production:container_manage"];
const user: AuthenticatedUser = { id: "user-id", firebaseUid: "p4-http", email: "p4@example.com", displayName: "P4", status: "ACTIVE", lastLoginAt: null, roles: [], permissions: all };
const users: UserRepository = { async findByFirebaseUid() { return user; }, async updateLastLoginAt() {} };
const calls: Array<{ name: string; args: unknown[] }> = [];
const service = {
  listContainers: async (...args: unknown[]) => { calls.push({ name: "list", args }); return []; },
  getContainer: async (...args: unknown[]) => { calls.push({ name: "get", args }); return { id }; },
  getContainerOccupancies: async (...args: unknown[]) => { calls.push({ name: "occupancies", args }); return []; },
  getContainerMovements: async (...args: unknown[]) => { calls.push({ name: "movements", args }); return []; },
  createContainer: async (...args: unknown[]) => { calls.push({ name: "create", args }); return { id }; },
  updateContainer: async (...args: unknown[]) => { calls.push({ name: "update", args }); return { id }; },
  activateContainer: async (...args: unknown[]) => { calls.push({ name: "activate", args }); return { id }; },
  deactivateContainer: async (...args: unknown[]) => { calls.push({ name: "deactivate", args }); return { id }; },
} as unknown as ProductionService;

async function request(method: string, path: string, permissions = all, body?: unknown) {
  const app = express(); app.use(requestContext); app.use(express.json());
  const scopedUser = { ...user, permissions };
  const scopedUsers: UserRepository = { async findByFirebaseUid() { return scopedUser; }, async updateLastLoginAt() {} };
  app.use("/production", createProductionRouter(verifier, scopedUsers, service)); app.use(errorHandler);
  const server = app.listen(0); await new Promise<void>((resolve) => server.once("listening", resolve));
  try { const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/production${path}`, { method, headers: { authorization: "Bearer valid", "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); const text = await response.text(); let json: any = {}; try { json = JSON.parse(text); } catch { /* Express's unmatched 404 is intentionally HTML. */ } return { response, json }; }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

describe("Production P4 HTTP contracts and RBAC", () => {
  after(() => undefined);
  for (const [method, path, permission] of [["GET", "/containers", "production:read"], ["GET", `/containers/${id}`, "production:read"], ["GET", `/containers/${id}/occupancies`, "production:read"], ["GET", `/containers/${id}/movements`, "production:read"], ["POST", "/containers", "production:container_manage"], ["PATCH", `/containers/${id}`, "production:container_manage"], ["POST", `/containers/${id}/activate`, "production:container_manage"], ["POST", `/containers/${id}/deactivate`, "production:container_manage"]] as const) {
    it(`denies ${method} ${path} without ${permission}`, async () => {
      const result = await request(method, path, []);
      assert.equal(result.response.status, 403);
      assert.equal(result.json.error.code, "AUTH_FORBIDDEN");
    });
  }
  it("does not expose legacy transfer aliases", async () => {
    for (const path of [`/containers/${id}/transfer`, `/containers/${id}/partial-transfer`]) {
      const result = await request("POST", path, all, { batchId: id, quantity: "1.000" });
      assert.equal(result.response.status, 404);
    }
  });
  it("serves successful reads/admin operations and captures validated arguments", async () => {
    calls.length = 0;
    for (const path of ["/containers", `/containers/${id}`, `/containers/${id}/occupancies`, `/containers/${id}/movements`]) {
      const result = await request("GET", path, all);
      assert.equal(result.response.status, 200);
      assert.ok("data" in result.json);
    }
    const create = await request("POST", "/containers", all, { code: "HTTP-C", type: "OTRO", capacity: "2.000", capacityUnit: "KG" });
    const update = await request("PATCH", `/containers/${id}`, all, { capacity: "3.000" });
    const activate = await request("POST", `/containers/${id}/activate`, all);
    const deactivate = await request("POST", `/containers/${id}/deactivate`, all);
    for (const result of [create, update, activate, deactivate]) assert.ok([200, 201].includes(result.response.status));
    assert.deepEqual(calls.map((call) => call.name), ["list", "get", "occupancies", "movements", "create", "update", "activate", "deactivate"]);
    assert.equal((calls.find((call) => call.name === "create")?.args[0] as any).code, "HTTP-C");
    assert.equal((calls.find((call) => call.name === "update")?.args[1] as any).capacity, "3.000");
  });
  it("rejects malformed create/update bodies and separates read/admin permissions", async () => {
    assert.equal((await request("POST", "/containers", all, { code: "", type: "OTRO", capacity: "2.000", capacityUnit: "KG" })).response.status, 400);
    assert.equal((await request("PATCH", `/containers/${id}`, all, { code: "not-allowed" })).response.status, 400);
    assert.equal((await request("POST", "/containers", ["production:read"], { code: "HTTP-C", type: "OTRO", capacity: "2.000", capacityUnit: "KG" })).response.status, 403);
    assert.equal((await request("GET", "/containers", ["production:container_manage"])).response.status, 403);
  });
});