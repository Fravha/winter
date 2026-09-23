import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { InventoryService } from "../src/modules/inventory/inventory.service.js";
import { movementHistoryQuerySchema } from "../src/modules/inventory/inventory.schema.js";
import { AppError } from "../src/shared/errors/app-error.js";

const validationError = (error: unknown) =>
  error instanceof AppError
  && error.code === "VALIDATION_ERROR"
  && error.statusCode === 400;

describe("Main Inventory regression", () => {
  it("normalizes warehouse pagination strings and rejects invalid values", async () => {
    let query: unknown;
    const prisma = {
      warehouse: {
        findMany: async (input: unknown) => {
          query = input;
          return [];
        },
      },
    } as unknown as PrismaClient;
    const service = new InventoryService(prisma);

    await service.listWarehouses({ page: "2", pageSize: "5" });
    assert.deepEqual(query, {
      skip: 5,
      take: 5,
      orderBy: { codigo: "asc" },
    });

    for (const page of ["0", "-1", "1.5", "not-a-number"]) {
      assert.throws(() => service.listWarehouses({ page }), validationError);
    }
    for (const pageSize of ["0", "-1", "1.5", "not-a-number"]) {
      assert.throws(
        () => service.listWarehouses({ pageSize }),
        validationError,
      );
    }
  });

  it("requires articuloId and coerces positive movement pagination", () => {
    assert.equal(movementHistoryQuerySchema.safeParse({}).success, false);
    assert.equal(
      movementHistoryQuerySchema.safeParse({
        articuloId: "11111111-1111-4111-8111-111111111111",
        page: "2",
        pageSize: "25",
      }).success,
      true,
    );
    assert.equal(
      movementHistoryQuerySchema.safeParse({
        articuloId: "11111111-1111-4111-8111-111111111111",
        page: "0",
      }).success,
      false,
    );
  });

  it("applies movement filters, stable ordering and readable relations", async () => {
    let countQuery: unknown;
    let listQuery: unknown;
    const createdAt = new Date("2026-09-23T12:00:00.000Z");
    const prisma = {
      inventoryMovement: {
        count: async (input: unknown) => {
          countQuery = input;
          return 6;
        },
        findMany: async (input: unknown) => {
          listQuery = input;
          return [{
            id: "movement-1",
            type: "TRANSFER",
            source: "MANUAL",
            reason: null,
            quantity: "2.500",
            unit: "KG",
            stockBefore: "10.000",
            resultingStock: "7.500",
            createdAt,
            articulo: { id: "article-1", codigo: "ART-1", nombre: "Article" },
            warehouse: { id: "warehouse-1", codigo: "W-1", nombre: "Origin" },
            destinationWarehouse: {
              id: "warehouse-2",
              codigo: "W-2",
              nombre: "Destination",
            },
            lot: { id: "lot-1", lotCode: "LOT-001" },
          }];
        },
      },
      $transaction: async (operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
    } as unknown as PrismaClient;
    const service = new InventoryService(prisma);

    const result = await service.listMovements({
      articuloId: "article-1",
      warehouseId: "warehouse-1",
      inventoryLotId: "lot-1",
      type: "TRANSFER",
      page: "2",
      pageSize: "3",
    });

    const where = {
      articuloId: "article-1",
      warehouseId: "warehouse-1",
      inventoryLotId: "lot-1",
      type: "TRANSFER",
    };
    assert.deepEqual(countQuery, { where });
    assert.deepEqual(listQuery, {
      where,
      skip: 3,
      take: 3,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        type: true,
        source: true,
        reason: true,
        quantity: true,
        unit: true,
        stockBefore: true,
        resultingStock: true,
        createdAt: true,
        articulo: { select: { id: true, codigo: true, nombre: true } },
        warehouse: { select: { id: true, codigo: true, nombre: true } },
        destinationWarehouse: {
          select: { id: true, codigo: true, nombre: true },
        },
        lot: { select: { id: true, lotCode: true } },
      },
    });
    assert.deepEqual(result.pagination, {
      page: 2,
      pageSize: 3,
      total: 6,
      totalPages: 2,
    });
    assert.equal(result.items[0]?.destinationWarehouse?.codigo, "W-2");
    assert.equal(result.items[0]?.lot?.lotCode, "LOT-001");
    assert.equal(result.items[0]?.createdAt, createdAt.toISOString());
  });

  it("keeps the movement-history route protected by inventory:read", async () => {
    const source = await readFile(
      new URL("../src/modules/inventory/inventory.routes.ts", import.meta.url),
      "utf8",
    );
    assert.match(
      source,
      /router\.get\(\s*["']\/movements["'][\s\S]*?requirePermission\(["']inventory:read["']\)[\s\S]*?movementHistoryQuerySchema/,
    );
  });
});