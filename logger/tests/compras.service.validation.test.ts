import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { ArticulosApi } from "../src/modules/articulos/articulos.api.js";
import { CompraService } from "../src/modules/compras/compra.service.js";
import type { InventoryApi } from "../src/modules/inventory/inventory.api.js";
import { AppError } from "../src/shared/errors/app-error.js";

const context = { actorUserId: "actor-id" };
const articuloId = "00000000-0000-4000-8000-000000000001";
const inactiveId = "00000000-0000-4000-8000-000000000002";

function createSubject() {
  let transactions = 0;
  const prisma = {
    $transaction: async <T>(work: (transaction: unknown) => Promise<T>) => {
      transactions++;
      return work({});
    },
  } as unknown as PrismaClient;
  const articulos: ArticulosApi = {
    getArticulo: async () => {
      throw new Error("not needed");
    },
    listArticulos: async () => ({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    }),
    validateArticulo: async ({ articuloId: id }) => ({
      valid: id !== inactiveId,
      articulo: id === inactiveId ? null : {
        id,
        codigo: "A-1",
        codigoExterno: null,
        nombre: "Artículo",
        clasificacion: "MATERIA_PRIMA",
        unidadMedida: "KG",
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    validateArticuloInTransaction: async ({ articuloId: id }) => ({
      valid: id !== inactiveId,
      articulo: id === inactiveId ? null : {
        id,
        codigo: "A-1",
        codigoExterno: null,
        nombre: "Artículo",
        clasificacion: "MATERIA_PRIMA",
        unidadMedida: "KG",
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
  };
  const inventory = {} as InventoryApi;
  return { service: new CompraService(prisma, articulos, inventory), get transactions() { return transactions; } };
}

describe("CompraService validation", () => {
  it("rejects repeated articles before opening a transaction", async () => {
    const subject = createSubject();
    await assert.rejects(
      subject.service.create({
        supplierName: "Proveedor",
        items: [
          { articuloId, requestedQuantity: "1", unit: "KG" },
          { articuloId, requestedQuantity: "2", unit: "KG" },
        ],
      }, context),
      (error: unknown) => error instanceof AppError && error.code === "COMPRA_DUPLICATE_ITEM",
    );
    assert.equal(subject.transactions, 0);
  });

  it("rejects inactive articles, unit mismatches and non-integer UNIDAD", async () => {
    const subject = createSubject();
    await assert.rejects(
      subject.service.create({
        supplierName: "Proveedor",
        items: [{ articuloId: inactiveId, requestedQuantity: "1", unit: "KG" }],
      }, context),
      (error: unknown) => error instanceof AppError && error.code === "ARTICULO_INVALID",
    );
    await assert.rejects(
      subject.service.create({
        supplierName: "Proveedor",
        items: [{ articuloId, requestedQuantity: "1", unit: "G" }],
      }, context),
      (error: unknown) => error instanceof AppError && error.code === "UNIT_MISMATCH",
    );
    await assert.rejects(
      subject.service.create({
        supplierName: "Proveedor",
        items: [{ articuloId, requestedQuantity: "1.5", unit: "UNIDAD" }],
      }, context),
      (error: unknown) => error instanceof AppError && error.code === "INVALID_QUANTITY",
    );
    assert.equal(subject.transactions, 0);
  });
});