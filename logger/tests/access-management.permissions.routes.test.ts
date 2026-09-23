import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import express from "express";
import type { AuditService } from "../src/core/audit/audit.service.js";
import type { TokenVerifier } from "../src/core/auth/auth.types.js";
import type { AuthenticatedUser } from "../src/core/users/user.types.js";
import { createPermissionRouter } from "../src/modules/access-management/permissions/permission.routes.js";
import { errorHandler } from "../src/shared/http/error-handler.js";
import { requestContext } from "../src/shared/http/request-context.js";

const permissionId = "62d78084-e485-4d93-9603-30f00b72115f";
const missingId = "72d78084-e485-4d93-9603-30f00b72115f";
const permission = {
  id: permissionId,
  code: "users:read",
  name: "Read users",
  description: "List users",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};
const publicPermission = {
  ...permission,
  createdAt: permission.createdAt.toISOString(),
  updatedAt: permission.updatedAt.toISOString(),
};

const verifier: TokenVerifier = {
  async verify(token) {
    assert.equal(token, "valid-token");
    return { uid: "firebase-id", email: "user@example.com" };
  },
};

async function requestPermission(
  path: string,
  permissions: string[],
) {
  const user: AuthenticatedUser = {
    id: "user-id",
    firebaseUid: "firebase-id",
    email: "user@example.com",
    displayName: "Logger User",
    status: "ACTIVE",
    lastLoginAt: null,
    roles: [],
    permissions,
  };
  const client = {
    permission: {
      findMany: async () => [permission],
      findUnique: async ({ where }: { where: { id?: string } }) =>
        where.id === permissionId ? permission : null,
    },
  };
  const userRepository = {
    async findByFirebaseUid() {
      return user;
    },
    async updateLastLoginAt() {},
  };
  const audit = { record: async () => {} } as unknown as AuditService;
  const app = express();
  app.use(requestContext);
  app.use(
    "/api/v1/permissions",
    createPermissionRouter(
      client as never,
      verifier,
      userRepository,
      audit,
    ),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/permissions${path}`, {
      headers: { authorization: "Bearer valid-token" },
    });
    return { response, body: await response.json() as unknown };
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
}

describe("Permission read HTTP RBAC", () => {
  it("requires rbac:read for listing and detail", async () => {
    const list = await requestPermission("/", []);
    const detail = await requestPermission(`/${permissionId}`, []);

    assert.equal(list.response.status, 403);
    assert.equal(detail.response.status, 403);
    assert.equal((list.body as { error: { code: string } }).error.code, "AUTH_FORBIDDEN");
    assert.equal((detail.body as { error: { code: string } }).error.code, "AUTH_FORBIDDEN");
  });

  it("returns {data: [...]} for GET /permissions with rbac:read", async () => {
    const { response, body } = await requestPermission("/", ["rbac:read"]);

    assert.equal(response.status, 200);
    assert.deepEqual(body, { data: [publicPermission] });
  });

  it("returns {data: item} for GET /permissions/:id with rbac:read", async () => {
    const { response, body } = await requestPermission(
      `/${permissionId}`,
      ["rbac:read"],
    );

    assert.equal(response.status, 200);
    assert.deepEqual(body, { data: publicPermission });
  });

  it("returns PERMISSION_NOT_FOUND for a valid missing id", async () => {
    const { response, body } = await requestPermission(`/${missingId}`, ["rbac:read"]);

    assert.equal(response.status, 404);
    assert.equal(
      (body as { error: { code: string } }).error.code,
      "PERMISSION_NOT_FOUND",
    );
  });
});