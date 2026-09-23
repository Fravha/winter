import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import {
  canonicalContainerAssignmentRequest,
  canonicalContainerPartialTransferRequest,
  canonicalContainerTransferRequest,
} from "../src/modules/production/production.container.js";
import {
  containerAssignSchema,
  containerPartialTransferSchema,
  containerTransferSchema,
} from "../src/modules/production/production.schema.js";

const uuid = "00000000-0000-4000-8000-000000000001";
const destination = "00000000-0000-4000-8000-000000000002";
const hash = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");
const stable = (value: unknown): string => value === null || typeof value !== "object"
  ? JSON.stringify(value)
  : Array.isArray(value)
    ? `[${value.map(stable).join(",")}]`
    : `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;

describe("P5.5B canonical movement contracts", () => {
  it("hashes the frontend-normalized assign body without the route-derived destination id", () => {
    const body = { batchId: uuid, quantity: "1200.000", operationKey: "assign-1", requestHash: "ignored", observations: "  physical fill  ", productionWorkId: undefined, occurredAt: new Date("2026-01-02T03:04:05.000Z") };
    const canonical = canonicalContainerAssignmentRequest({ ...body, destinationContainerId: destination });
    assert.deepEqual(canonical, {
      batchId: uuid, quantity: "1200.000", observations: "physical fill",
      productionWorkId: null, occurredAt: "2026-01-02T03:04:05.000Z",
    });
    assert.equal(hash(canonical), hash(canonicalContainerAssignmentRequest({ ...body, destinationContainerId: uuid })));
  });

  it("normalizes optional values consistently for total and partial transfers", () => {
    const total = canonicalContainerTransferRequest({
      batchId: uuid, destinationContainerId: destination, operationKey: "t", requestHash: "",
      observations: " ", productionWorkId: undefined, occurredAt: undefined,
    });
    assert.deepEqual(total, { batchId: uuid, destinationContainerId: destination, observations: null, productionWorkId: null, occurredAt: null });
    const partial = canonicalContainerPartialTransferRequest({
      batchId: uuid, destinationContainerId: destination, quantity: "200.000", childCode: " B-NEW ",
      operationKey: "p", requestHash: "",
    });
    assert.equal(partial.childCode, "B-NEW");
    assert.equal(partial.observations, null);
    assert.equal(partial.productionWorkId, null);
    assert.equal(partial.occurredAt, null);
  });

  it("keeps route ids out of assign input and rejects duplicated/unknown fields", () => {
    const valid = { batchId: uuid, quantity: "1.000", operationKey: "a", requestHash: "a".repeat(64) };
    const transfer = { batchId: uuid, operationKey: "a", requestHash: "a".repeat(64), destinationContainerId: destination };
    assert.equal(containerAssignSchema.safeParse(valid).success, true);
    assert.equal(containerAssignSchema.safeParse({ ...valid, destinationContainerId: destination }).success, false);
    assert.equal(containerTransferSchema.safeParse(transfer).success, true);
    assert.equal(containerPartialTransferSchema.safeParse({ ...valid, destinationContainerId: destination, childCode: "child" }).success, true);
    assert.equal(containerTransferSchema.safeParse({ ...transfer, quantity: "1.000" }).success, false);
    assert.equal(containerPartialTransferSchema.safeParse({ ...valid, destinationContainerId: destination, childCode: "child", extra: true }).success, false);
  });
});