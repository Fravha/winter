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
const verifier = { async verify() { return { uid: "p10-http" }; } } as unknown as TokenVerifier;
const user: AuthenticatedUser = { id, firebaseUid: "p10-http", email: "p10@example.com", displayName: "P10", status: "ACTIVE", lastLoginAt: null, roles: [], permissions: [] };
const trace = { rootBatchId: id, batches: [], lineage: [], ledger: [], receptions: [], works: [], measurements: [], transformations: [], losses: [], containers: [], inventory: { lots: [], movements: [], stocks: [] }, warnings: [] };
const calls: unknown[] = [];
const service = {
  getBatchTrace: async (value: string) => { calls.push(["trace", value]); return trace; },
  correctMeasurement: async (value: string, body: unknown) => { calls.push(["measurement", value, body]); return { id: value, version: 1 }; },
  correctReception: async (value: string, body: unknown) => { calls.push(["reception", value, body]); return { id: value, version: 1 }; },
} as unknown as ProductionService;
async function request(method: string, path: string, permissions: string[], payload?: unknown) {
  const app = express(); app.use(requestContext); app.use(express.json());
  const users: UserRepository = { async findByFirebaseUid() { return { ...user, permissions }; }, async updateLastLoginAt() {} };
  app.use("/production", createProductionRouter(verifier, users, service)); app.use(errorHandler);
  const server = app.listen(0); await new Promise<void>(resolve => server.once("listening", resolve));
  try { const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/production${path}`, { method, headers: { authorization: "Bearer valid", "content-type": "application/json" }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) }); return { response, text: await response.text() }; }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
describe("Production P10 HTTP contracts and RBAC", () => {
  it("returns typed trace only with production:read", async () => {
    calls.length = 0; const response = await request("GET", `/batches/${id}/trace`, ["production:read"]);
    assert.equal(response.response.status, 200); assert.deepEqual(JSON.parse(response.text), { data: trace }); assert.deepEqual(calls[0], ["trace", id]);
    assert.equal((await request("GET", `/batches/${id}/trace`, [])).response.status, 403);
  });
  it("accepts only field-specific correction contracts and permissions", async () => {
    calls.length = 0;
    const measurement = await request("POST", `/measurements/${id}/corrections`, ["production:measurement_correct"], { field: "value", newValue: "1.250000", reason: "approved", operationKey: "p10-m-1" });
    assert.equal(measurement.response.status, 200); assert.equal((calls[0] as string[])[0], "measurement");
    assert.equal((await request("POST", `/measurements/${id}/corrections`, ["production:measurement_correct"], { field: "quantity", newValue: "1", reason: "blocked", operationKey: "p10-m-2" })).response.status, 400);
    assert.equal((await request("POST", `/grape-receptions/${id}/corrections`, ["production:reception_correct"], { field: "observations", newValue: "note", reason: "approved", operationKey: "p10-r-1" })).response.status, 200);
    assert.equal((await request("POST", `/grape-receptions/${id}/corrections`, ["production:read"], { field: "observations", newValue: "note", reason: "blocked", operationKey: "p10-r-2" })).response.status, 403);
  });
  it("rejects unknown methods and malformed strict bodies", async () => {
    assert.equal((await request("PATCH", `/measurements/${id}/corrections`, ["production:measurement_correct"], {})).response.status, 404);
    assert.equal((await request("POST", `/measurements/${id}/corrections`, ["production:measurement_correct"], { field: "value", newValue: "1", reason: "x" })).response.status, 400);
  });
});