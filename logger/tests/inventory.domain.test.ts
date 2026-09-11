import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppError } from "../src/shared/errors/app-error.js";
import {
  formatInventoryQuantity,
  inventoryRequestFingerprint,
  parseInventoryQuantity,
  parsePositiveInventoryQuantity,
} from "../src/modules/inventory/inventory.service.js";

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