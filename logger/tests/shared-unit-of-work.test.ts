import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { SharedUnitOfWork } from "../src/core/database/shared-unit-of-work.js";

describe("SharedUnitOfWork", () => {
  it("retries the complete workflow after P2034", async () => {
    let attempts = 0;
    let callbackRuns = 0;
    const fakeClient = {
      $transaction: async <T>(
        work: (transaction: unknown) => Promise<T>,
      ): Promise<T> => {
        attempts++;
        const result = await work(undefined);
        if (attempts < 3) {
          throw Object.assign(new Error("serialization conflict"), { code: "P2034" });
        }
        return result;
      },
    };
    const uow = new SharedUnitOfWork(fakeClient as unknown as PrismaClient);
    const result = await uow.execute(async () => {
      callbackRuns++;
      return `attempt-${attempts}`;
    });
    assert.equal(result, "attempt-3");
    assert.equal(attempts, 3);
    assert.equal(callbackRuns, 3);
  });

  it("retries TransactionWriteConflict from the Prisma driver adapter", async () => {
    let attempts = 0;
    const fakeClient = {
      $transaction: async <T>(
        work: (transaction: unknown) => Promise<T>,
      ): Promise<T> => {
        attempts++;
        const result = await work(undefined);
        if (attempts === 1) {
          throw Object.assign(new Error("TransactionWriteConflict"), {
            name: "DriverAdapterError",
          });
        }
        return result;
      },
    };
    const result = await new SharedUnitOfWork(fakeClient as unknown as PrismaClient)
      .execute(async () => "completed");
    assert.equal(result, "completed");
    assert.equal(attempts, 2);
  });

  it("stops after its bounded retry policy", async () => {
    let attempts = 0;
    const fakeClient = {
      $transaction: async <T>(
        work: (transaction: unknown) => Promise<T>,
      ): Promise<T> => {
        attempts++;
        await work(undefined);
        throw Object.assign(new Error("serialization conflict"), { code: "P2034" });
      },
    };
    const uow = new SharedUnitOfWork(fakeClient as unknown as PrismaClient);
    let callbackRuns = 0;
    await assert.rejects(uow.execute(async () => {
      callbackRuns++;
      return "workflow";
    }));
    assert.equal(attempts, 4);
    assert.equal(callbackRuns, 4);
  });
});