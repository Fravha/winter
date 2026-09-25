import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import cors from "cors";
import express from "express";
import type { TokenVerifier } from "../src/core/auth/auth.types.js";
import type { AuthenticatedUser } from "../src/core/users/user.types.js";
import type { UserRepository } from "../src/core/users/user.repository.js";
import { createReportsRouter } from "../src/modules/reports/reports.routes.js";
import { reportsDocType } from "../src/modules/reports/reports.doc-type.js";
import type { ReportsApi } from "../src/modules/reports/reports.api.js";
import { AppError } from "../src/shared/errors/app-error.js";
import { createCorsOptions } from "../src/shared/http/cors-options.js";

const userId = "00000000-0000-4000-8000-000000000001";
const batchId = "00000000-0000-4000-8000-000000000002";
const contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const calls: string[] = [];

async function emptyWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Empty").addRow(["Heading"]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const testReports = Object.fromEntries([
  "exportStock",
  "exportInventoryMovements",
  "exportPurchases",
  "exportProductionWorks",
  "exportTransformations",
  "exportTraceability",
].map((method) => [method, async (...args: unknown[]) => {
  calls.push(method);
  const filters = args[0];
  (testReports as unknown as Record<string, (...values: unknown[]) => unknown>)[`${method}Filters`] = filters;
  return { filename: "report.xlsx", content: await emptyWorkbook() };
}]).concat([
  "listArticleOptions",
  "listWarehouseOptions",
  "listProductionOrderOptions",
  "listTransformationOrderOptions",
  "listBatchOptions",
  "listWorkTypeOptions",
  "listContainerOptions",
].map((method) => [method, async (...args: unknown[]) => {
  calls.push(method);
  const filters = args[0];
  (testReports as unknown as Record<string, (...values: unknown[]) => unknown>)[`${method}Filters`] = filters;
  return { items: [{ id: batchId, code: "OPTION-1" }], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } };
}]))) as unknown as ReportsApi & Record<string, unknown>;

const verifier: TokenVerifier = { async verify() { return { uid: "reports-user" }; } };
const authenticatedUser: AuthenticatedUser = {
  id: userId, firebaseUid: "reports-user", email: "reports@example.com",
  displayName: "Reports tester", status: "ACTIVE", lastLoginAt: null, roles: [], permissions: [],
};

async function request(path: string, options: { token?: boolean; permissions?: string[]; reports?: ReportsApi } = {}) {
  const reports = options.reports ?? testReports as ReportsApi;
  const users: UserRepository = {
    async findByFirebaseUid() { return { ...authenticatedUser, permissions: options.permissions ?? [] }; },
    async updateLastLoginAt() {},
  };
  const app = express();
  app.use(cors(createCorsOptions(["https://reports.example"])));
  app.use("/api/v1/reports", createReportsRouter(verifier, users, reports));
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof AppError) {
      response.status(error.statusCode).json({ error: { code: error.code, message: error.message } });
      return;
    }
    response.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const headers = options.token === false
      ? { origin: "https://reports.example" }
      : { authorization: "Bearer valid", origin: "https://reports.example" };
    return await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/reports${path}`, { headers });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe("Reports HTTP export contract", () => {
  it("registers reports:export as a business permission for idempotent admin seeding", () => {
    assert.equal(reportsDocType.name, "reports");
    assert.ok(reportsDocType.permissions.some((permission) => permission.code === "reports:export"));
    assert.deepEqual(reportsDocType.dependencies, ["articulos", "compras", "inventory", "production"]);
  });

  it("requires authentication and a local reports:export permission", async () => {
    const unauthenticated = await request("/stock/export", { token: false, permissions: ["reports:export"] });
    assert.equal(unauthenticated.status, 401);
    const forbidden = await request("/stock/export", { permissions: ["inventory:read"] });
    assert.equal(forbidden.status, 403);
  });

  it("serves all six exact routes as real binary XLSX attachments", async () => {
    calls.length = 0;
    const endpoints = [
      "/stock/export?warehouseId=00000000-0000-4000-8000-000000000001",
      "/inventory-movements/export?movementType=TRANSFER",
      "/purchases/export?status=RECEIVED",
      "/production-works/export?productionOrderId=00000000-0000-4000-8000-000000000001",
      "/transformations/export?from=2025-01-01&to=2025-01-31",
      `/traceability/export?productionBatchId=${batchId}`,
    ];
    for (const endpoint of endpoints) {
      const response = await request(endpoint, { permissions: ["reports:export"] });
      assert.equal(response.status, 200, endpoint);
      assert.equal(response.headers.get("content-type"), contentType);
      assert.match(response.headers.get("content-disposition") ?? "", /attachment; filename="[^"]+\.xlsx"/);
      assert.match(response.headers.get("access-control-expose-headers") ?? "", /Content-Disposition/i);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
      assert.equal(workbook.worksheets.length, 1);
      assert.equal(workbook.worksheets[0]?.name, "Empty");
    }
    assert.deepEqual(calls, [
      "exportStock", "exportInventoryMovements", "exportPurchases",
      "exportProductionWorks", "exportTransformations", "exportTraceability",
    ]);
  });

  it("serves seven authenticated, paginated selector endpoints", async () => {
    calls.length = 0;
    const endpoints = [
      "/options/articles", "/options/warehouses", "/options/production-orders",
      "/options/transformation-orders", "/options/batches", "/options/work-types", "/options/containers",
    ];
    for (const endpoint of endpoints) {
      const response = await request(`${endpoint}?page=2&pageSize=5&search=abc`, { permissions: ["reports:export"] });
      assert.equal(response.status, 200, endpoint);
      assert.deepEqual(await response.json(), {
        data: [{ id: batchId, code: "OPTION-1" }],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      });
    }
    assert.equal(calls.length, endpoints.length);
    const articleFilters = (testReports as unknown as Record<string, { page: number; pageSize: number; search?: string }>).listArticleOptionsFilters;
    assert.deepEqual(articleFilters, { page: 2, pageSize: 5, search: "abc" });
    assert.equal((await request("/options/articles", { permissions: ["inventory:read"] })).status, 403);
    assert.equal((await request("/options/articles?pageSize=101", { permissions: ["reports:export"] })).status, 400);
  });

  it("rejects a second simultaneous export with an explicit retryable 429", async () => {
    let entered!: () => void;
    let release!: () => void;
    const enteredExport = new Promise<void>((resolve) => { entered = resolve; });
    const exportGate = new Promise<void>((resolve) => { release = resolve; });
    const concurrentReports = {
      ...(testReports as unknown as Record<string, unknown>),
      async exportStock() {
        entered();
        await exportGate;
        return { filename: "report.xlsx", content: await emptyWorkbook() };
      },
    } as unknown as ReportsApi;
    const firstExport = request("/stock/export", { permissions: ["reports:export"], reports: concurrentReports });
    await enteredExport;
    const secondResponse = await request("/stock/export", { permissions: ["reports:export"], reports: concurrentReports });
    assert.equal(secondResponse.status, 429);
    assert.deepEqual(await secondResponse.json(), {
      error: {
        code: "REPORT_EXPORT_BUSY",
        message: "Another report export is already being generated. Retry when it has completed.",
      },
    });
    release();
    assert.equal((await firstExport).status, 200);
  });

  it("rejects malformed filters and does not allow actorUserId as caller-supplied identity", async () => {
    calls.length = 0;
    assert.equal((await request("/inventory-movements/export?from=2025-02-01&to=2025-01-01", { permissions: ["reports:export"] })).status, 400);
    assert.equal((await request("/stock/export?warehouseId=not-a-uuid", { permissions: ["reports:export"] })).status, 400);
    assert.equal((await request("/inventory-movements/export?movementType=NOT_REAL", { permissions: ["reports:export"] })).status, 400);
    assert.equal((await request(`/traceability/export?productionBatchId=${batchId}&actorUserId=${userId}`, { permissions: ["reports:export"] })).status, 400);
    assert.equal((await request("/traceability/export", { permissions: ["reports:export"] })).status, 400);
    assert.equal(calls.length, 0);
  });
});