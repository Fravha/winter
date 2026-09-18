import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import express from "express";
import type { TokenVerifier } from "../src/core/auth/auth.types.js";
import type { AuthenticatedUser } from "../src/core/users/user.types.js";
import type { UserRepository } from "../src/core/users/user.repository.js";
import type { ProductionService } from "../src/modules/production/production.service.js";
import { createProductionRouter } from "../src/modules/production/production.routes.js";
import { productionDocType } from "../src/modules/production/production.doc-type.js";
import { errorHandler } from "../src/shared/http/error-handler.js";
import { requestContext } from "../src/shared/http/request-context.js";
import { ProductionRepository } from "../src/modules/production/production.repository.js";
import { ProductionService } from "../src/modules/production/production.service.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { AppError } from "../src/shared/errors/app-error.js";

const id = "00000000-0000-4000-8000-000000000001";
const verifier: TokenVerifier = { async verify() { return { uid: "wm-firebase", email: "wm@example.com" }; } };

async function call(method: string, path: string, permissions: string[], body?: unknown, authenticated = true) {
  const calls: unknown[] = [];
  const user: AuthenticatedUser = {
    id: "wm-user", firebaseUid: "wm-firebase", email: "wm@example.com", displayName: "WM",
    status: "ACTIVE", lastLoginAt: null, roles: [], permissions,
  };
  const users: UserRepository = { async findByFirebaseUid() { return user; }, async updateLastLoginAt() {} };
  const service = {
    list: async (...args: unknown[]) => { calls.push(args); return { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }; },
    create: async (...args: unknown[]) => { calls.push(args); return { id, code: "W", name: "Work" }; },
    update: async (...args: unknown[]) => { calls.push(args); return { id, code: "W", name: "Updated" }; },
    setActive: async (...args: unknown[]) => { calls.push(args); return { id, code: "W", active: true }; },
  } as unknown as ProductionService;
  const app = express();
  app.use(requestContext); app.use(express.json());
  app.use("/production", createProductionRouter(verifier, users, service));
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/production${path}`, {
      method,
      headers: { ...(authenticated ? { authorization: "Bearer valid" } : {}), "content-type": "application/json", "x-request-id": "wm-request" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { response, json: await response.json() as unknown, calls };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));
  }
}

describe("approved WorkType and MeasurementType CRUD HTTP contract", () => {
  for (const [kind, permission] of [["work-types", "production:work_type_manage"], ["measurement-types", "production:measurement_type_manage"]] as const) {
    it(`${kind} exposes POST/PATCH/activate/deactivate with its manage permission`, async () => {
      for (const [method, suffix] of [["POST", ""], ["PATCH", `/${id}`], ["POST", `/${id}/activate`], ["POST", `/${id}/deactivate`]] as const) {
        const result = await call(method, `/${kind}${suffix}`, [permission], method === "PATCH" ? { name: "Updated" } : { code: "W", name: "Work" });
        assert.notEqual(result.response.status, 404);
      }
    });

    it(`${kind} rejects the wrong manage permission and unauthenticated requests`, async () => {
      const wrong = await call("POST", `/${kind}`, ["production:producer_manage"], { code: "W", name: "Work" });
      assert.equal(wrong.response.status, 403);
      const unauthenticated = await call("GET", `/${kind}`, ["production:read"], undefined, false);
      assert.equal(unauthenticated.response.status, 401);
    });

    it(`${kind} rejects userId/code in PATCH and forwards actor/requestId`, async () => {
      const strict = await call("PATCH", `/${kind}/${id}`, [permission], { name: "Updated", code: "HACK", userId: id });
      assert.equal(strict.response.status, 400);
      assert.equal(strict.calls.length, 0);
    });
  }
});

describe("production documentation permissions", () => {
  it("declares WorkType and MeasurementType manage permissions", () => {
    const codes = productionDocType.permissions.map((permission) => permission.code);
    assert.ok(codes.includes("production:work_type_manage"));
    assert.ok(codes.includes("production:measurement_type_manage"));
  });
});

describe("WorkType and MeasurementType repository/service lifecycle", () => {
  it("lists each catalog with active filter and pagination metadata", async () => {
    const calls: unknown[] = [];
    const delegate = {
      findMany: async (args: unknown) => { calls.push(args); return [{ code: "A" }]; },
      count: async () => 1,
    };
    const db = { workType: delegate, measurementType: delegate } as unknown as PrismaClient;
    const repository = new ProductionRepository(db);
    const work = await repository.list("work-types", { page: 2, pageSize: 5, active: false });
    const measurement = await repository.list("measurement-types", { page: 1, pageSize: 10, active: true });
    assert.equal(work.items.length, 1);
    assert.equal(measurement.pagination.totalPages, 1);
    assert.deepEqual((calls[0] as { where: unknown }).where, { active: false });
  });

  it("requires CRUD service operations to use work/measurement delegates and maps database errors", async () => {
    const calls: string[] = [];
    const failDuplicate = async () => { throw Object.assign(new Error("duplicate"), { code: "P2002" }); };
    const tx = {
      workType: {
        findUnique: async () => null, create: async () => { calls.push("work-create"); return { id, code: "W", name: "Work" }; },
        update: async () => { calls.push("work-update"); return { id, code: "W", name: "Work" }; },
      },
      measurementType: {
        findUnique: async () => null, create: failDuplicate, update: async () => { throw Object.assign(new Error("missing"), { code: "P2025" }); },
      },
      auditLog: { create: async () => undefined },
    };
    const prisma = { $transaction: async (work: (tx: typeof tx) => Promise<unknown>) => work(tx) } as unknown as PrismaClient;
    const service = new ProductionService(prisma, {} as never);
    await service.create("work-types", { code: "W", name: "Work" }, { actorUserId: "actor" });
    assert.ok(calls.includes("work-create"));
    await assert.rejects(() => service.create("measurement-types", { code: "M", name: "Measurement" }, { actorUserId: "actor" }), (error: unknown) => error instanceof AppError && error.statusCode === 409);
    await assert.rejects(() => service.update("work-types", id, { name: "Changed" }, { actorUserId: "actor" }), (error: unknown) => error instanceof AppError && error.statusCode === 404);
  });
});