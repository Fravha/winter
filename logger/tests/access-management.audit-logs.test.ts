import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import express from "express";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { TokenVerifier } from "../src/core/auth/auth.types.js";
import type { UserRepository } from "../src/core/users/user.repository.js";
import type { AuthenticatedUser } from "../src/core/users/user.types.js";
import { PrismaAuditRepository } from "../src/core/audit/prisma-audit.repository.js";
import { AppError } from "../src/shared/errors/app-error.js";
import { createAuditLogRouter } from "../src/modules/access-management/audit-logs/audit-log.routes.js";
import { AuditLogService } from "../src/modules/access-management/audit-logs/audit-log.service.js";
import { auditLogQuerySchema } from "../src/modules/access-management/audit-logs/audit-log.schema.js";

describe("Access Management audit log contract", () => {
  it("validates filters, defaults pagination, and enforces the date range", () => {
    const query = auditLogQuerySchema.parse({
      actorUserId: "00000000-0000-4000-8000-000000000001",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T23:59:59.999Z",
    });

    assert.equal(query.page, 1);
    assert.equal(query.pageSize, 20);
    assert.equal(query.from?.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.throws(
      () =>
        auditLogQuerySchema.parse({
          from: "2026-02-01T00:00:00.000Z",
          to: "2026-01-01T00:00:00.000Z",
        }),
      /from must be earlier/,
    );
    assert.throws(
      () => auditLogQuerySchema.parse({ page: "0" }),
      /Too small/,
    );
    assert.throws(
      () => auditLogQuerySchema.parse({ pageSize: "101" }),
      /Too big/,
    );
  });

  it("returns the exact public DTO and pagination envelope", async () => {
    const service = new AuditLogService({
      async list(query) {
        assert.equal(query.page, 2);
        assert.equal(query.pageSize, 1);
        return {
          total: 3,
          items: [
            {
              id: "00000000-0000-4000-8000-000000000002",
              actorUserId: null,
              action: "USER_CREATED",
              resourceType: "USER",
              resourceId: null,
              metadata: { email: "user@example.com" },
              ipAddress: null,
              requestId: "request-id",
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
            },
          ],
        };
      },
    });

    assert.deepEqual(
      await service.list({
        page: 2,
        pageSize: 1,
        action: "USER_CREATED",
      }),
      {
        data: [
          {
            id: "00000000-0000-4000-8000-000000000002",
            actorUserId: null,
            action: "USER_CREATED",
            resourceType: "USER",
            resourceId: null,
            metadata: { email: "user@example.com" },
            ipAddress: null,
            requestId: "request-id",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        meta: { page: 2, pageSize: 1, total: 3, totalPages: 3 },
      },
    );
  });

  it("applies all combined filters and requests newest-first pagination from Prisma", async () => {
    let findManyArgs: Record<string, unknown> | undefined;
    let countArgs: Record<string, unknown> | undefined;
    const repository = new PrismaAuditRepository({
      auditLog: {
        async findMany(args: Record<string, unknown>) {
          findManyArgs = args;
          return [];
        },
        async count(args: Record<string, unknown>) {
          countArgs = args;
          return 0;
        },
      },
    } as unknown as PrismaClient);

    const query = auditLogQuerySchema.parse({
      actorUserId: "00000000-0000-4000-8000-000000000001",
      action: "USER_CREATED",
      resourceType: "USER",
      resourceId: "resource-1",
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-31T23:59:59.999Z",
      page: "2",
      pageSize: "10",
    });
    await repository.list(query);

    const expectedWhere = {
      actorUserId: "00000000-0000-4000-8000-000000000001",
      action: "USER_CREATED",
      resourceType: "USER",
      resourceId: "resource-1",
      createdAt: {
        gte: new Date("2026-01-01T00:00:00.000Z"),
        lte: new Date("2026-01-31T23:59:59.999Z"),
      },
    };
    assert.deepEqual(findManyArgs?.where, expectedWhere);
    assert.deepEqual(countArgs?.where, expectedWhere);
    assert.deepEqual(findManyArgs?.orderBy, { createdAt: "desc" });
    assert.equal(findManyArgs?.skip, 10);
    assert.equal(findManyArgs?.take, 10);
  });

  it("requires audit:read and returns the HTTP pagination envelope", async () => {
    const user: AuthenticatedUser = {
      id: "00000000-0000-4000-8000-000000000001",
      firebaseUid: "firebase-id",
      email: "admin@example.com",
      displayName: "Admin",
      status: "ACTIVE",
      roles: ["admin"],
      permissions: [],
    };
    const rows = [
      {
        id: "00000000-0000-4000-8000-000000000002",
        actorUserId: user.id,
        action: "USER_CREATED",
        resourceType: "USER",
        resourceId: "00000000-0000-4000-8000-000000000003",
        metadata: { email: "new@example.com" },
        ipAddress: null,
        requestId: "request-id",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
    let listCalls = 0;
    const client = {
      auditLog: {
        async findMany() {
          listCalls += 1;
          return rows;
        },
        async count() {
          return 1;
        },
      },
    } as unknown as PrismaClient;
    const tokenVerifier: TokenVerifier = {
      async verify(token) {
        assert.equal(token, "valid-token");
        return { uid: "firebase-id" };
      },
    };
    const users: UserRepository = {
      async findByFirebaseUid() {
        return user;
      },
      async updateLastLoginAt() {},
    };
    const app = express();
    app.use("/api/v1/audit-logs", createAuditLogRouter(client, tokenVerifier, users));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const appError = error instanceof AppError
        ? error
        : new AppError("INTERNAL_ERROR", "Unexpected", 500);
      res.status(appError.statusCode).json({ error: { code: appError.code } });
    });
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;

    try {
      let response = await fetch(
        `http://127.0.0.1:${port}/api/v1/audit-logs`,
        { headers: { authorization: "Bearer valid-token" } },
      );
      assert.equal(response.status, 403);
      assert.equal(listCalls, 0);

      user.permissions = ["audit:read"];
      response = await fetch(
        `http://127.0.0.1:${port}/api/v1/audit-logs?actorUserId=${user.id}&action=USER_CREATED&resourceType=USER&resourceId=${rows[0]!.resourceId}&from=2026-01-01T00%3A00%3A00.000Z&to=2026-01-31T23%3A59%3A59.999Z&page=2&pageSize=10`,
        { headers: { authorization: "Bearer valid-token" } },
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        data: [{
          ...rows[0],
          createdAt: rows[0]!.createdAt.toISOString(),
        }],
        meta: { page: 2, pageSize: 10, total: 1, totalPages: 1 },
      });
      assert.equal(listCalls, 1);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()),
      );
    }
  });

  it("rejects invalid query filters before reaching the controller or repository", async () => {
    let listCalls = 0;
    const client = {
      auditLog: {
        async findMany() {
          listCalls += 1;
          return [];
        },
        async count() {
          listCalls += 1;
          return 0;
        },
      },
    } as unknown as PrismaClient;
    const user: AuthenticatedUser = {
      id: "00000000-0000-4000-8000-000000000001",
      firebaseUid: "firebase-id",
      email: "admin@example.com",
      displayName: null,
      status: "ACTIVE",
      roles: ["admin"],
      permissions: ["audit:read"],
    };
    const users: UserRepository = {
      async findByFirebaseUid() { return user; },
      async updateLastLoginAt() {},
    };
    const tokenVerifier: TokenVerifier = {
      async verify() { return { uid: "firebase-id" }; },
    };
    const app = express();
    app.use("/api/v1/audit-logs", createAuditLogRouter(client, tokenVerifier, users));
    app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const appError = error instanceof AppError
        ? error
        : new AppError("INTERNAL_ERROR", "Unexpected", 500);
      res.status(appError.statusCode).json({ error: { code: appError.code } });
    });
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const invalidQueries = [
        "actorUserId=not-a-uuid",
        "page=0",
        "pageSize=101",
        "from=not-a-date",
        "from=2026-02-01T00%3A00%3A00.000Z&to=2026-01-01T00%3A00%3A00.000Z",
      ];
      for (const query of invalidQueries) {
        const response = await fetch(
          `http://127.0.0.1:${port}/api/v1/audit-logs?${query}`,
          { headers: { authorization: "Bearer valid-token" } },
        );
        assert.equal(response.status, 400, query);
        assert.deepEqual(await response.json(), { error: { code: "VALIDATION_ERROR" } });
      }
      assert.equal(listCalls, 0);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()),
      );
    }
  });
});