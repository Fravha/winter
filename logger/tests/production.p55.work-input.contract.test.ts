import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { workInputReversalSchema, workInputSchema } from "../src/modules/production/production.schema.js";
import { canonicalProductionWorkInputRequest, canonicalProductionWorkInputReversalRequest } from "../src/modules/production/production.work.js";

const stableSerialize = (value: unknown): string => value === null || typeof value !== "object"
  ? JSON.stringify(value)
  : Array.isArray(value)
    ? `[${value.map(stableSerialize).join(",")}]`
    : `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`).join(",")}}`;
const sha256 = (value: unknown) => createHash("sha256").update(stableSerialize(value)).digest("hex");

test("P5.5A canonical create hash matches browser stableSerialize contract", () => {
  const body = workInputSchema.parse({
    articuloId: "11111111-1111-4111-8111-111111111111",
    warehouseId: "22222222-2222-4222-8222-222222222222",
    quantity: "2.000", unit: "KG", operationKey: "bentonita-1",
    requestHash: "pending",
  });
  const canonical = canonicalProductionWorkInputRequest(body);
  assert.deepEqual(canonical, {
    articuloId: body.articuloId, warehouseId: body.warehouseId, inventoryLotId: null,
    quantity: "2.000", unit: "KG", observations: null,
    authorizeNegativeStock: false, negativeStockReason: null,
  });
  assert.notEqual(sha256(canonical), sha256({ ...canonical, operationKey: "different" }));
});

test("P5.5A canonical reversal hash excludes route IDs and operation key", () => {
  const body = workInputReversalSchema.parse({ reason: "  corregir  ", operationKey: "reverse-1", requestHash: "pending" });
  assert.deepEqual(canonicalProductionWorkInputReversalRequest(body), { reason: "corregir" });
  assert.equal(stableSerialize(canonicalProductionWorkInputReversalRequest(body)), '{"reason":"corregir"}');
});