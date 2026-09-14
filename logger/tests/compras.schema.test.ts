import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cancelCompraSchema, createCompraSchema, receiveCompraSchema } from "../src/modules/compras/compra.schema.js";

const articuloId = "00000000-0000-4000-8000-000000000001";
const warehouseId = "00000000-0000-4000-8000-000000000002";

describe("Compras request schemas", () => {
  it("requires at least one item and rejects client-controlled fields", () => {
    const missingItems = createCompraSchema.safeParse({
      supplierName: "Proveedor",
    });
    assert.equal(missingItems.success, false);

    const forbiddenField = createCompraSchema.safeParse({
      supplierName: "Proveedor",
      createdByUserId: "attacker",
      items: [{ articuloId, requestedQuantity: "1", unit: "UNIDAD" }],
    });
    assert.equal(forbiddenField.success, false);
  });

  it("rejects invalid decimal precision and accepts approved optional fields", () => {
    const invalid = createCompraSchema.safeParse({
      supplierName: "Proveedor",
      items: [{ articuloId, requestedQuantity: "1.0001", unit: "UNIDAD" }],
    });
    assert.equal(invalid.success, false);

    const valid = createCompraSchema.safeParse({
      supplierName: "Proveedor",
      supplierTaxId: "NIT-1",
      currency: "BOB",
      items: [{ articuloId, requestedQuantity: "2", unit: "UNIDAD", unitPrice: "4.125" }],
    });
    assert.equal(valid.success, true);
  });

  it("keeps receive and cancellation contracts narrow", () => {
    const receive = receiveCompraSchema.safeParse({
      warehouseId,
      items: [{ compraItemId: articuloId }],
      idempotencyKey: "client-controlled",
    });
    assert.equal(receive.success, false);

    assert.equal(cancelCompraSchema.safeParse({ reason: "Proveedor canceló" }).success, true);
    assert.equal(cancelCompraSchema.safeParse({ observations: "wrong field" }).success, false);
  });
});