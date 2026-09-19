import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError } from "../src/shared/errors/app-error.js";
import {
  formatInventoryQuantity,
  inventoryRequestFingerprint,
  parseInventoryQuantity,
  parsePositiveInventoryQuantity,
  InventoryService,
} from "../src/modules/inventory/inventory.service.js";
import { warehouseUpdateSchema } from "../src/modules/inventory/inventory.schema.js";

describe("Inventory quantity rules", () => {
  it("represents DECIMAL(18,3) without floating point", () => {
    assert.equal(parseInventoryQuantity("12.345"), 12345n);
    assert.equal(parseInventoryQuantity("-0.125"), -125n);
    assert.equal(formatInventoryQuantity(-125n), "-0.125");
  });

  it("rejects zero, negative and excess precision for movement quantities", () => {
    for (const value of ["0", "-1", "1.0001"]) {
      assert.throws(
        () => parsePositiveInventoryQuantity(value),
        (error: unknown) =>
          error instanceof AppError && error.code === "INVALID_QUANTITY",
      );
    }
  });

  it("requires integer quantities for UNIDAD", () => {
    assert.equal(parsePositiveInventoryQuantity("2", "UNIDAD"), 2000n);
    assert.throws(
      () => parsePositiveInventoryQuantity("2.5", "UNIDAD"),
      (error: unknown) =>
        error instanceof AppError && error.code === "INVALID_QUANTITY",
    );
  });
});

describe("Inventory idempotency fingerprint", () => {
  it("is deterministic regardless of object key order", () => {
    const first = inventoryRequestFingerprint({
      articuloId: "a",
      quantity: "1.000",
      nested: { warehouseId: "w", lot: null },
    });
    const second = inventoryRequestFingerprint({
      nested: { lot: null, warehouseId: "w" },
      quantity: "1.000",
      articuloId: "a",
    });

    assert.equal(first, second);
  });

  it("changes when the command payload changes", () => {
    assert.notEqual(
      inventoryRequestFingerprint({ quantity: "1.000" }),
      inventoryRequestFingerprint({ quantity: "2.000" }),
    );
  });
});

describe("Warehouse PATCH contract", () => {
  it("accepts the mutable fields without requiring codigo", () => {
    const parsed = warehouseUpdateSchema.parse({
      nombre: "  Bodega actualizada  ",
      ubicacion: "Nave 2",
      encargadoUserId: "11111111-1111-4111-8111-111111111111",
      observaciones: "Conteo anual",
    });

    assert.deepEqual(parsed, {
      nombre: "Bodega actualizada",
      ubicacion: "Nave 2",
      encargadoUserId: "11111111-1111-4111-8111-111111111111",
      observaciones: "Conteo anual",
    });
  });

  it("rejects codigo so warehouse identity remains immutable", () => {
    assert.throws(
      () => warehouseUpdateSchema.parse({ codigo: "BOD-NUEVO", nombre: "Bodega" }),
      /Unrecognized key/,
    );
  });

  it("rejects invalid PATCH payloads", () => {
    assert.throws(() => warehouseUpdateSchema.parse({ nombre: "   " }));
    assert.throws(() => warehouseUpdateSchema.parse({ nombre: "Bodega", encargadoUserId: "not-a-uuid" }));
    assert.throws(() => warehouseUpdateSchema.parse({}));
  });

  it("updates mutable fields, preserves codigo and audits the actor at service level", async () => {
    const updateCalls: Array<{ where: { id: string }; data: Record<string, unknown> }> = [];
    const auditCalls: Array<{ data: Record<string, unknown> }> = [];
    const storedWarehouse = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      codigo: "BOD-ESTABLE",
      nombre: "Bodega actualizada",
      ubicacion: "Nave 2",
      encargadoUserId: "11111111-1111-4111-8111-111111111111",
      observaciones: "Conteo anual",
      activo: true,
    };
    const transaction = {
      warehouse: {
        update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
          updateCalls.push(args);
          return storedWarehouse;
        },
      },
      auditLog: {
        create: async (args: { data: Record<string, unknown> }) => {
          auditCalls.push(args);
          return args.data;
        },
      },
    };
    const fakePrisma = {
      $transaction: async (work: (tx: typeof transaction) => Promise<unknown>) => work(transaction),
    } as unknown as ConstructorParameters<typeof InventoryService>[0];
    const service = new InventoryService(fakePrisma);

    const result = await service.updateWarehouse(
      storedWarehouse.id,
      {
        nombre: "Bodega actualizada",
        ubicacion: "Nave 2",
        encargadoUserId: storedWarehouse.encargadoUserId,
        observaciones: "Conteo anual",
      },
      { actorUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", permissions: ["inventory:warehouse_update"] },
    );

    assert.deepEqual(result, storedWarehouse);
    assert.deepEqual(updateCalls, [{
      where: { id: storedWarehouse.id },
      data: {
        nombre: "Bodega actualizada",
        ubicacion: "Nave 2",
        encargadoUserId: storedWarehouse.encargadoUserId,
        observaciones: "Conteo anual",
      },
    }]);
    assert.equal("codigo" in updateCalls[0]!.data, false);
    assert.deepEqual(auditCalls, [{
      data: {
        actorUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        action: "INVENTORY_WAREHOUSE_UPDATED",
        resourceType: "Warehouse",
        resourceId: storedWarehouse.id,
      },
    }]);

    await service.updateWarehouse(
      storedWarehouse.id,
      {
        codigo: "BOD-INTENTO-CAMBIO",
        nombre: "Bodega actualizada 2",
        ubicacion: "Nave 3",
      } as never,
      { actorUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", permissions: ["inventory:warehouse_update"] },
    );

    assert.equal("codigo" in updateCalls[1]!.data, false);
    assert.equal(updateCalls[1]!.data.nombre, "Bodega actualizada 2");
    assert.equal(updateCalls[1]!.data.ubicacion, "Nave 3");
  });
});