import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import express from "express";
import type { TokenVerifier } from "../src/core/auth/auth.types.js";
import type { AuthenticatedUser } from "../src/core/users/user.types.js";
import type { UserRepository } from "../src/core/users/user.repository.js";
import type { ProductionService } from "../src/modules/production/production.service.js";

process.env.NODE_ENV = "test";
process.env.WINTER_DATABASE_URL ??= "postgresql://127.0.0.1:5432/p55b_routes_test";
process.env.FIREBASE_WEB_API_KEY ??= "p55b-test-key";
process.env.FIREBASE_PROJECT_ID ??= "p55b-test-project";
process.env.FIREBASE_CLIENT_EMAIL ??= "p55b@example.test";
process.env.FIREBASE_PRIVATE_KEY ??= "p55b-test-private-key";

const id = "00000000-0000-4000-8000-000000000001";
const destination = "00000000-0000-4000-8000-000000000002";
const body = { batchId: id, quantity: "1.000", operationKey: "p55b-route", requestHash: "a".repeat(64) };
const verifier: TokenVerifier = { async verify() { return { uid: "p55b-firebase", email: "p55b@example.test" }; } };

async function request(path: string, permissions: string[], payload: unknown = body) {
  const [{ createProductionRouter }, { errorHandler }, { requestContext }] = await Promise.all([
    import("../src/modules/production/production.routes.js"),
    import("../src/shared/http/error-handler.js"),
    import("../src/shared/http/request-context.js"),
  ]);
  const calls: { method: string; args: unknown[] }[] = [];
  const user: AuthenticatedUser = { id: id, firebaseUid: "p55b-firebase", email: "p55b@example.test", displayName: "P5.5B", status: "ACTIVE", lastLoginAt: null, roles: [], permissions };
  const users: UserRepository = { async findByFirebaseUid() { return user; }, async updateLastLoginAt() {} };
  const record = (method: string) => async (...args: unknown[]) => { calls.push({ method, args }); return { id }; };
  const service = {
    assignBatchToContainer: record("assignBatchToContainer"),
    transferBatchBetweenContainers: record("transferBatchBetweenContainers"),
    transferBatchPartiallyBetweenContainers: record("transferBatchPartiallyBetweenContainers"),
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
      method: "POST", headers: { authorization: "Bearer valid", "content-type": "application/json", "x-request-id": "p55b-request" }, body: JSON.stringify(payload),
    });
    return { response, calls };
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

describe("P5.5B container movement HTTP contract", () => {
  it("enforces separate assign and transfer permissions", async () => {
    assert.equal((await request(`/containers/${destination}/assign`, [])).response.status, 403);
    assert.equal((await request(`/containers/${id}/transfers`, [])).response.status, 403);
    assert.equal((await request(`/containers/${id}/transfers/partial`, [])).response.status, 403);
  });

  it("rejects malformed bodies before invoking movement services", async () => {
    const result = await request(`/containers/${destination}/assign`, ["production:container_assign"], { ...body, requestHash: "short" });
    assert.equal(result.response.status, 400);
    assert.equal(result.calls.length, 0);
  });

  it("derives destination/source ids from paths and forwards authenticated context", async () => {
    const assign = await request(`/containers/${destination}/assign`, ["production:container_assign"]);
    assert.equal(assign.response.status, 201);
    assert.equal(assign.calls[0]?.method, "assignBatchToContainer");
    assert.equal((assign.calls[0]?.args[0] as Record<string, unknown>).destinationContainerId, destination);
    const assignContext = assign.calls[0]?.args[1] as Record<string, unknown>;
    assert.equal(assignContext.actorUserId, id);
    assert.equal(assignContext.requestId, "p55b-request");

    const { quantity: _quantity, ...transferBody } = body;
    const transfer = await request(`/containers/${id}/transfers`, ["production:container_transfer"], { ...transferBody, destinationContainerId: destination });
    assert.equal(transfer.response.status, 200);
    assert.equal((transfer.calls[0]?.args[0] as Record<string, unknown>).sourceContainerId, id);
    const partial = await request(`/containers/${id}/transfers/partial`, ["production:container_transfer"], { ...body, destinationContainerId: destination, childCode: "B-NEW" });
    assert.equal(partial.response.status, 200);
    assert.equal((partial.calls[0]?.args[0] as Record<string, unknown>).sourceContainerId, id);
  });
});