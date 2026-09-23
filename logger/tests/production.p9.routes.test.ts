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
const warehouseId = "00000000-0000-4000-8000-000000000002";
const verifier = { async verify() { return { uid: "p9-http" }; } } as unknown as TokenVerifier;
const user: AuthenticatedUser = { id, firebaseUid: "p9-http", email: "p9@example.com", displayName: "P9", status: "ACTIVE", lastLoginAt: null, roles: [], permissions: [] };
const body = { quantity: "1.000", warehouseId, operationKey: "p9-http-key", lotCode: "LOT-1", classification: "PRODUCTO_ENVASADO", fechaIngreso: "2026-01-02T03:04:05.000Z" };
let calls: unknown[] = [];
const result = { productionBatchId: id, quantity: "1.000", remainingProductionQuantity: "0.000", inventoryLotId: warehouseId, inventoryMovementId: id, warehouseId };
const service = { releaseBatchToInventory: async (value: unknown) => { calls.push(value); return result; } } as unknown as ProductionService;

async function request(method: string, path: string, permissions: string[], payload?: unknown) {
  const app = express(); app.use(requestContext); app.use(express.json());
  const users: UserRepository = { async findByFirebaseUid() { return { ...user, permissions }; }, async updateLastLoginAt() {} };
  app.use("/production", createProductionRouter(verifier, users, service)); app.use(errorHandler);
  const server = app.listen(0); await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/production${path}`, { method, headers: { authorization: "Bearer valid", "content-type": "application/json" }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
    return { response, text: await response.text() };
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

describe("Production P9 HTTP contracts and RBAC", () => {
  it("forwards the strict command and returns the exact response", async () => {
    calls = [];
    const response = await request("POST", `/batches/${id}/release-to-inventory`, ["production:inventory_release"], body);
    assert.equal(response.response.status, 200);
    assert.deepEqual(JSON.parse(response.text), { data: result });
    assert.equal((calls[0] as any).productionBatchId, id);
    assert.equal((calls[0] as any).fechaIngreso instanceof Date, true);
  });
  it("rejects missing permission, invalid UUIDs and strict payloads without service calls", async () => {
    calls = [];
    assert.equal((await request("POST", `/batches/${id}/release-to-inventory`, [], body)).response.status, 403);
    assert.equal((await request("POST", `/batches/not-a-uuid/release-to-inventory`, ["production:inventory_release"], body)).response.status, 400);
    assert.equal((await request("POST", `/batches/${id}/release-to-inventory`, ["production:inventory_release"], { ...body, extra: true })).response.status, 400);
    assert.equal((await request("POST", `/batches/${id}/release-to-inventory`, ["production:inventory_release"], { ...body, requestHash: "client-supplied" })).response.status, 400);
    assert.equal((await request("POST", `/batches/${id}/release-to-inventory`, ["production:inventory_release"], { ...body, quantity: "0" })).response.status, 400);
    assert.equal((await request("PATCH", `/batches/${id}/release-to-inventory`, ["production:inventory_release"], body)).response.status, 404);
    assert.equal((await request("DELETE", `/batches/${id}/release-to-inventory`, ["production:inventory_release"])).response.status, 404);
    assert.equal(calls.length, 0);
  });
});