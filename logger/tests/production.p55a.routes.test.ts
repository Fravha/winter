import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import express from "express";
import type { TokenVerifier } from "../src/core/auth/auth.types.js";
import type { AuthenticatedUser } from "../src/core/users/user.types.js";
import type { UserRepository } from "../src/core/users/user.repository.js";
import type { ProductionService } from "../src/modules/production/production.service.js";

process.env.NODE_ENV = "test";
process.env.WINTER_DATABASE_URL ??= "postgresql://127.0.0.1:5432/p55a_routes_test";
process.env.FIREBASE_WEB_API_KEY ??= "p55a-test-key";
process.env.FIREBASE_PROJECT_ID ??= "p55a-test-project";
process.env.FIREBASE_CLIENT_EMAIL ??= "p55a@example.test";
process.env.FIREBASE_PRIVATE_KEY ??= "p55a-test-private-key";

const workId = "00000000-0000-4000-8000-000000000001";
const inputId = "00000000-0000-4000-8000-000000000002";
const articuloId = "00000000-0000-4000-8000-000000000003";
const warehouseId = "00000000-0000-4000-8000-000000000004";
const verifier: TokenVerifier = { async verify() { return { uid: "p55a-firebase", email: "p55a@example.com" }; } };

async function request(method: string, path: string, permissions: string[], body: unknown) {
  const [{ createProductionRouter }, { errorHandler }, { requestContext }] = await Promise.all([
    import("../src/modules/production/production.routes.js"),
    import("../src/shared/http/error-handler.js"),
    import("../src/shared/http/request-context.js"),
  ]);
  const calls: { method: string; args: unknown[] }[] = [];
  const user: AuthenticatedUser = {
    id: "p55a-user", firebaseUid: "p55a-firebase", email: "p55a@example.com",
    displayName: "P5.5A", status: "ACTIVE", lastLoginAt: null, roles: [], permissions,
  };
  const users: UserRepository = { async findByFirebaseUid() { return user; }, async updateLastLoginAt() {} };
  const record = (name: string) => async (...args: unknown[]) => {
    calls.push({ method: name, args });
    return { id: inputId };
  };
  const service = {
    createWorkInput: record("createWorkInput"),
    reverseWorkInput: record("reverseWorkInput"),
  } as unknown as ProductionService;
  const app = express();
  app.use(requestContext);
  app.use(express.json());
  app.use("/production", createProductionRouter(verifier, users, service));
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/production${path}`, {
      method, headers: { authorization: "Bearer valid", "content-type": "application/json", "x-request-id": "p55a-request" },
      body: JSON.stringify(body),
    });
    return { response, json: await response.json() as { error?: { code?: string } }, calls };
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

const createBody = {
  articuloId, warehouseId, quantity: "2.000", unit: "KG",
  operationKey: "p55a-create", requestHash: "hash",
};
const reverseBody = { reason: "corregir", operationKey: "p55a-reverse", requestHash: "hash" };

describe("P5.5A work-input HTTP contract", () => {
  it("requires the dedicated create and reverse permissions", async () => {
    const create = await request("POST", `/works/${workId}/inputs`, [], createBody);
    assert.equal(create.response.status, 403);
    const reverse = await request("POST", `/works/${workId}/inputs/${inputId}/reverse`, [], reverseBody);
    assert.equal(reverse.response.status, 403);
  });

  it("rejects malformed decimal, unit, and missing reversal reason before service calls", async () => {
    for (const body of [
      { ...createBody, quantity: "2.0000" },
      { ...createBody, unit: "TON" },
    ]) {
      const result = await request("POST", `/works/${workId}/inputs`, ["production:work_input_create"], body);
      assert.equal(result.response.status, 400);
      assert.equal(result.calls.length, 0);
    }
    const missingReason = await request("POST", `/works/${workId}/inputs/${inputId}/reverse`, ["production:work_input_reverse"], { ...reverseBody, reason: " " });
    assert.equal(missingReason.response.status, 400);
    assert.equal(missingReason.calls.length, 0);
  });

  it("invokes the exact service methods with the authenticated audit context", async () => {
    const create = await request("POST", `/works/${workId}/inputs`, ["production:work_input_create"], createBody);
    assert.equal(create.response.status, 201);
    assert.equal(create.calls[0]?.method, "createWorkInput");
    assert.deepEqual(create.calls[0]?.args.slice(0, 2), [workId, { ...createBody }]);
    const createContext = create.calls[0]?.args[2] as Record<string, unknown>;
    assert.equal(createContext.actorUserId, "p55a-user");
    assert.deepEqual(createContext.permissions, ["production:work_input_create"]);
    assert.equal(createContext.requestId, "p55a-request");

    const reverse = await request("POST", `/works/${workId}/inputs/${inputId}/reverse`, ["production:work_input_reverse"], reverseBody);
    assert.equal(reverse.response.status, 200);
    assert.equal(reverse.calls[0]?.method, "reverseWorkInput");
    assert.deepEqual(reverse.calls[0]?.args.slice(0, 3), [workId, inputId, reverseBody]);
    const reverseContext = reverse.calls[0]?.args[3] as Record<string, unknown>;
    assert.equal(reverseContext.actorUserId, "p55a-user");
    assert.deepEqual(reverseContext.permissions, ["production:work_input_reverse"]);
    assert.equal(reverseContext.requestId, "p55a-request");
  });
});