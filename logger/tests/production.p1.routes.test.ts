import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import express from "express";
import type { TokenVerifier } from "../src/core/auth/auth.types.js";
import type { AuthenticatedUser } from "../src/core/users/user.types.js";
import type { UserRepository } from "../src/core/users/user.repository.js";
import type { ProductionService } from "../src/modules/production/production.service.js";
import { createProductionRouter } from "../src/modules/production/production.routes.js";
import { errorHandler } from "../src/shared/http/error-handler.js";
import { requestContext } from "../src/shared/http/request-context.js";

const id = "00000000-0000-4000-8000-000000000001";
const verifier: TokenVerifier = { async verify() { return { uid: "firebase", email: "test@example.com" }; } };

function service() {
  const calls: { method: string; args: unknown[] }[] = [];
  const record = (method: string, result: unknown) => async (...args: unknown[]) => {
    calls.push({ method, args });
    return result;
  };
  return {
    calls,
    service: {
      list: record("list", { items: [{ id, code: "P-1", name: "Participant" }], pagination: { page: 2, pageSize: 5, total: 6, totalPages: 2 } }),
      create: record("create", { id, code: "P-1", name: "Participant" }),
      update: record("update", { id, code: "P-1", name: "Updated" }),
      setActive: record("setActive", { id, code: "P-1", active: true }),
      listDefinitions: record("listDefinitions", []),
      createDefinition: record("createDefinition", { id }),
      updateDefinition: record("updateDefinition", { id }),
      setDefinitionActive: record("setDefinitionActive", { id }),
      setValue: record("setValue", { id }),
    } as unknown as ProductionService,
  };
}

async function request(method: string, path: string, permissions: string[], body?: unknown, authenticated = true) {
  const user: AuthenticatedUser = {
    id: "user-id", firebaseUid: "firebase", email: "test@example.com", displayName: "Test",
    status: "ACTIVE", lastLoginAt: null, roles: [], permissions,
  };
  const users: UserRepository = {
    async findByFirebaseUid() { return user; },
    async updateLastLoginAt() {},
  };
  const mock = service();
  const app = express();
  app.use(requestContext);
  app.use(express.json());
  app.use("/production", createProductionRouter(verifier, users, mock.service));
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/production${path}`, {
      method, headers: { ...(authenticated ? { authorization: "Bearer valid" } : {}), "content-type": "application/json", "x-request-id": "p1-route" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { response, json: await response.json() as unknown, calls: mock.calls };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  }
}

describe("Production P1 HTTP RBAC and contracts", () => {
  it("rejects requests without authentication", async () => {
    const result = await request("GET", "/participants", ["production:read"], undefined, false);
    assert.equal(result.response.status, 401);
  });

  const cases = [
    ["GET", "/participants", "production:read"],
    ["GET", "/producers", "production:read"],
    ["GET", "/grape-varieties", "production:read"],
    ["GET", "/work-types", "production:read"],
    ["GET", "/measurement-types", "production:read"],
    ["GET", "/custom-fields/definitions", "production:read"],
    ["POST", "/participants", "production:participant_manage"],
    ["PATCH", `/participants/${id}`, "production:participant_manage"],
    ["POST", `/participants/${id}/activate`, "production:participant_manage"],
    ["POST", `/participants/${id}/deactivate`, "production:participant_manage"],
    ["POST", "/custom-fields/definitions", "production:custom_fields_manage"],
    ["PATCH", `/custom-fields/definitions/${id}`, "production:custom_fields_manage"],
    ["POST", `/custom-fields/definitions/${id}/activate`, "production:custom_fields_manage"],
    ["POST", `/custom-fields/definitions/${id}/deactivate`, "production:custom_fields_manage"],
    ["PUT", "/custom-fields/values", "production:custom_fields_manage"],
  ] as const;
  for (const [method, path, permission] of cases) {
    it(`denies ${method} ${path} without ${permission}`, async () => {
      const result = await request(method, path, []);
      assert.equal(result.response.status, 403);
      assert.equal((result.json as { error: { code: string } }).error.code, "AUTH_FORBIDDEN");
    });
  }

  it("parses list filters and returns data/meta pagination", async () => {
    const result = await request("GET", "/participants?page=2&pageSize=5&search=red&active=false", ["production:read"]);
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.calls[0], { method: "list", args: ["participants", { page: 2, pageSize: 5, search: "red", active: false }] });
    assert.deepEqual(result.json, { data: [{ id, code: "P-1", name: "Participant" }], meta: { page: 2, pageSize: 5, total: 6, totalPages: 2 } });
  });

  it("enforces strict body and params before service invocation", async () => {
    const extra = await request("POST", "/participants", ["production:participant_manage"], { code: "P", name: "P", active: false });
    assert.equal(extra.response.status, 400);
    assert.equal(extra.calls.length, 0);
    const badId = await request("PATCH", "/participants/not-uuid", ["production:participant_manage"], { name: "P" });
    assert.equal(badId.response.status, 400);
    assert.equal(badId.calls.length, 0);
    for (const field of ["code", "entityType", "dataType"]) {
      const body = { [field]: field === "code" ? "HACK" : field === "entityType" ? "PRODUCER" : "TEXT" };
      const result = await request("PATCH", `/custom-fields/definitions/${id}`, ["production:custom_fields_manage"], body);
      assert.equal(result.response.status, 400);
      assert.equal(result.calls.length, 0);
    }
  });

  it("passes actor and request id to mutating service calls", async () => {
    const result = await request("POST", "/participants", ["production:participant_manage"], { code: "P", name: "P" });
    assert.equal(result.response.status, 201);
    const context = result.calls[0]?.args[2] as { actorUserId: string; requestId: string };
    assert.equal(context.actorUserId, "user-id");
    assert.equal(context.requestId, "p1-route");
  });

  it("uses the producer and grape-variety manage permissions independently", async () => {
    const producer = await request("POST", "/producers", ["production:producer_manage"], { code: "P", name: "P" });
    assert.equal(producer.response.status, 201);
    const producerWrong = await request("POST", "/producers", ["production:participant_manage"], { code: "P", name: "P" });
    assert.equal(producerWrong.response.status, 403);
    const grape = await request("POST", "/grape-varieties", ["production:grape_variety_manage"], { code: "G", name: "G" });
    assert.equal(grape.response.status, 201);
    const grapeWrong = await request("POST", "/grape-varieties", ["production:producer_manage"], { code: "G", name: "G" });
    assert.equal(grapeWrong.response.status, 403);
  });
});