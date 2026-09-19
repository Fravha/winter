import assert from "node:assert/strict";
import { test } from "node:test";
import { AttachmentTargetAdapter } from "../src/modules/attachments/attachment.targets.js";

test("target adapter queries each and only each whitelisted production delegate", async () => {
  const calls: string[] = [];
  const delegate = (name: string) => ({ findUnique: async () => { calls.push(name); return { id: "11111111-1111-4111-8111-111111111111" }; } });
  const prisma = {
    grapeReception: delegate("grapeReception"), productionWork: delegate("productionWork"),
    productionMeasurement: delegate("productionMeasurement"), transformation: delegate("transformation"),
    productionLoss: delegate("productionLoss"),
  } as any;
  const adapter = new AttachmentTargetAdapter(prisma);
  for (const type of ["GRAPE_RECEPTION", "PRODUCTION_WORK", "MEASUREMENT", "TRANSFORMATION", "PRODUCTION_LOSS"]) {
    await adapter.assertExists(type as any, "11111111-1111-4111-8111-111111111111");
  }
  assert.deepEqual(calls, ["grapeReception", "productionWork", "productionMeasurement", "transformation", "productionLoss"]);
  await assert.rejects(adapter.assertExists("PURCHASE" as any, "11111111-1111-4111-8111-111111111111"), /Unsupported/);
});