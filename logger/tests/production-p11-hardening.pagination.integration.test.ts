import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import express from "express";
import { after, before, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { AuditService } from "../src/core/audit/audit.service.js";
import { PrismaAuditRepository } from "../src/core/audit/prisma-audit.repository.js";
import type { TokenVerifier } from "../src/core/auth/auth.types.js";
import type { AuthenticatedUser } from "../src/core/users/user.types.js";
import type { UserRepository } from "../src/core/users/user.repository.js";
import { ProductionService } from "../src/modules/production/production.service.js";
import { createProductionRouter } from "../src/modules/production/production.routes.js";
import { errorHandler } from "../src/shared/http/error-handler.js";
import { requestContext } from "../src/shared/http/request-context.js";
import { createTemporaryProductionDatabaseResource } from "./helpers/production-test-database.js";

const database = createTemporaryProductionDatabaseResource("P11_HARDENING_DATABASE_URL", connectionString => ({
  connectionString,
  createClient: () => new PrismaClient({ adapter: new PrismaPg({ connectionString }) }),
}));
const integrationOptions = database ? {} : { skip: "requires P11_HARDENING_DATABASE_URL" };
const verifier: TokenVerifier = { async verify() { return { uid: "p11-pagination" }; } };
const actor: AuthenticatedUser = {
  id: "00000000-0000-4000-8000-000000000011", firebaseUid: "p11-pagination",
  email: "p11-pagination@example.test", displayName: "P11", status: "ACTIVE",
  lastLoginAt: null, roles: [], permissions: ["production:read"],
};

describe("P11 real PostgreSQL production pagination", () => {
  const prisma = database?.createClient();
  const service = prisma ? new ProductionService(prisma, new AuditService(new PrismaAuditRepository(prisma))) : undefined;
  const seededIds: string[] = [];

  before(async () => {
    if (!prisma) return;
    await prisma.productionOrder.deleteMany({ where: { code: { startsWith: "P11-PAGE-" } } });
    const rows = await Promise.all([
      prisma.productionOrder.create({ data: { code: "P11-PAGE-A", startDate: new Date("2026-01-02T00:00:00.000Z"), status: "OPEN" } }),
      prisma.productionOrder.create({ data: { code: "P11-PAGE-B", startDate: new Date("2026-01-02T00:00:00.000Z"), status: "OPEN" } }),
      prisma.productionOrder.create({ data: { code: "P11-PAGE-C", startDate: new Date("2026-01-01T00:00:00.000Z"), status: "OPEN" } }),
    ]);
    seededIds.push(...rows.map((row) => row.id));
  });

  after(async () => {
    if (!prisma) return;
    await prisma.productionOrder.deleteMany({ where: { id: { in: seededIds } } });
    await prisma.$disconnect();
  });

  it("applies filters, pagination, deterministic tie ordering, empty results, and HTTP max page size", integrationOptions, async () => {
    assert.ok(prisma && service);
    const users: UserRepository = {
      async findByFirebaseUid() { return actor; },
      async updateLastLoginAt() {},
    };
    const app = express();
    app.use(requestContext);
    app.use(express.json());
    app.use("/production", createProductionRouter(verifier, users, service));
    app.use(errorHandler);
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    try {
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/production/orders`;
      const page = await fetch(`${base}?status=OPEN&page=1&pageSize=2`, { headers: { authorization: "Bearer valid" } });
      assert.equal(page.status, 200);
      const pageBody = await page.json() as { data: Array<{ code: string }>; meta: { page: number; pageSize: number; total: number; totalPages: number } };
      assert.deepEqual(pageBody.data.map((row) => row.code), ["P11-PAGE-A", "P11-PAGE-B"]);
      assert.deepEqual(pageBody.meta, { page: 1, pageSize: 2, total: 3, totalPages: 2 });

      const secondPage = await fetch(`${base}?status=OPEN&page=2&pageSize=2`, { headers: { authorization: "Bearer valid" } });
      assert.deepEqual((await secondPage.json() as { data: Array<{ code: string }> }).data.map((row) => row.code), ["P11-PAGE-C"]);

      const empty = await fetch(`${base}?status=CLOSED&page=1&pageSize=100`, { headers: { authorization: "Bearer valid" } });
      assert.equal(empty.status, 200);
      const emptyBody = await empty.json() as { data: unknown[]; meta: { total: number } };
      assert.deepEqual(emptyBody.data, []);
      assert.equal(emptyBody.meta.total, 0);

      const tooLarge = await fetch(`${base}?page=1&pageSize=101`, { headers: { authorization: "Bearer valid" } });
      assert.equal(tooLarge.status, 400);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});