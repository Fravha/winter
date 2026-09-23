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
const releaseId = "00000000-0000-4000-8000-000000000002";
const verifier = { async verify() { return { uid: "p55d-http" }; } } as unknown as TokenVerifier;
const user: AuthenticatedUser = { id, firebaseUid: "p55d-http", email: "p55d@example.com", displayName: "P55D", status: "ACTIVE", lastLoginAt: null, roles: [], permissions: [] };
const history = [{ releaseId, productionBatchId: id, quantity: "120.000", unit: "UNIDAD", warehouseId: id, warehouse: { id, code: "PT", name: "Producto terminado" }, inventoryLotId: id, inventoryLot: { id, lotCode: "PT-1", classification: "PRODUCTO_ENVASADO" }, inventoryMovementId: id, operationKey: "release-key", actorUserId: id, occurredAt: "2026-01-01T00:00:00.000Z", observations: null, status: "ACTIVE", reversible: true, reversal: null }];
const calls: unknown[] = [];
const service = { listInventoryReleaseWarehouses: async () => [{ id, codigo: "PT", nombre: "Producto terminado" }], listReleases: async (batchId: string) => { calls.push(["list", batchId]); return history; }, reverseRelease: async (batchId: string, id: string, body: unknown) => { calls.push(["reverse", batchId, id, body]); return { releaseId: id, reversalOperationKey: (body as any).operationKey }; }, releaseBatchToInventory: async () => ({}) } as unknown as ProductionService;

async function request(method: string, path: string, permissions: string[], body?: unknown) {
  const app = express(); app.use(requestContext); app.use(express.json());
  const users: UserRepository = { async findByFirebaseUid() { return { ...user, permissions }; }, async updateLastLoginAt() {} };
  app.use("/production", createProductionRouter(verifier, users, service)); app.use(errorHandler);
  const server = app.listen(0); await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/production${path}`, { method, headers: { authorization: "Bearer valid", "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { response, text: await response.text() };
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

describe("P5.5D release history/reversal HTTP contracts", () => {
  it("returns active warehouse options with release permission only", async () => {
    assert.equal((await request("GET", "/inventory-release/warehouses", [], undefined)).response.status, 403);
    const result = await request("GET", "/inventory-release/warehouses", ["production:inventory_release"]);
    assert.equal(result.response.status, 200);
    assert.deepEqual(JSON.parse(result.text), { data: [{ id, codigo: "PT", nombre: "Producto terminado" }] });
  });
  it("requires production:read and forwards a typed release history", async () => {
    calls.length = 0;
    assert.equal((await request("GET", `/batches/${id}/releases`, [], undefined)).response.status, 403);
    const result = await request("GET", `/batches/${id}/releases`, ["production:read"]);
    assert.equal(result.response.status, 200);
    assert.deepEqual(JSON.parse(result.text), { data: history });
    assert.deepEqual(calls[0], ["list", id]);
  });
  it("requires reverse permission and rejects malformed strict bodies", async () => {
    const path = `/batches/${id}/releases/${releaseId}/reverse`;
    assert.equal((await request("POST", path, [], { operationKey: "reverse-key", reason: "reason" })).response.status, 403);
    assert.equal((await request("POST", path, ["production:inventory_release_reverse"], { operationKey: "reverse-key", reason: "" })).response.status, 400);
    assert.equal((await request("POST", path, ["production:inventory_release_reverse"], { operationKey: "reverse-key", reason: "reason", requestHash: "client" })).response.status, 400);
    assert.equal((await request("POST", `/batches/not-a-uuid/releases/${releaseId}/reverse`, ["production:inventory_release_reverse"], { operationKey: "reverse-key", reason: "reason" })).response.status, 400);
    const result = await request("POST", path, ["production:inventory_release_reverse"], { operationKey: "reverse-key", reason: "reason" });
    assert.equal(result.response.status, 200);
    assert.deepEqual(calls.at(-1), ["reverse", id, releaseId, { operationKey: "reverse-key", reason: "reason" }]);
  });
});