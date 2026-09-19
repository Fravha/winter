import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { SharedUnitOfWork, isSerializationConflict } from "../src/core/database/shared-unit-of-work.js";

describe("SharedUnitOfWork", () => {
  it("recognizes Prisma P2010 with nested PostgreSQL serialization SQLSTATE", () => {
    assert.equal(isSerializationConflict({ code: "P2010", meta: { driverAdapterError: { cause: { originalCode: "40001" } } } }), true);
    assert.equal(isSerializationConflict({ code: "P2010", meta: { driverAdapterError: { cause: { code: "40001" } } } }), true);
    assert.equal(isSerializationConflict({ code: "P2010", meta: { driverAdapterError: { cause: { originalCode: "40P01" } } } }), true);
    assert.equal(isSerializationConflict({ code: "P2010", meta: { driverAdapterError: { cause: { originalCode: "23505" } } } }), false);
    assert.equal(isSerializationConflict({ code: "P2010", meta: { driverAdapterError: { cause: { originalMessage: "could not serialize access" } } } }), false);
  });
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

  it("retries nested PostgreSQL deadlocks and completes the callback", async () => {
    let attempts = 0;
    let callbackRuns = 0;
    const fakeClient = {
      $transaction: async <T>(
        work: (transaction: unknown) => Promise<T>,
      ): Promise<T> => {
        attempts++;
        const result = await work(undefined);
        if (attempts === 1) {
          throw { code: "P2010", meta: { driverAdapterError: { cause: { originalCode: "40P01" } } } };
        }
        return result;
      },
    };
    const result = await new SharedUnitOfWork(fakeClient as unknown as PrismaClient)
      .execute(async () => {
        callbackRuns++;
        return "completed";
      });
    assert.equal(result, "completed");
    assert.equal(attempts, 2);
    assert.equal(callbackRuns, 2);
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

  it("stops nested PostgreSQL deadlock retries at the configured bound", async () => {
    let attempts = 0;
    const fakeClient = {
      $transaction: async <T>(
        work: (transaction: unknown) => Promise<T>,
      ): Promise<T> => {
        attempts++;
        await work(undefined);
        throw { code: "P2010", meta: { driverAdapterError: { cause: { originalCode: "40P01" } } } };
      },
    };
    await assert.rejects(new SharedUnitOfWork(fakeClient as unknown as PrismaClient)
      .execute(async () => "workflow", { maxSerializationRetries: 2 }));
    assert.equal(attempts, 3);
  });

  it("uses a finite safe retry default for invalid retry options", async () => {
    for (const value of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      let attempts = 0;
      const fakeClient = {
        $transaction: async <T>(
          work: (transaction: unknown) => Promise<T>,
        ): Promise<T> => {
          attempts++;
          await work(undefined);
          throw { code: "P2034" };
        },
      };
      await assert.rejects(new SharedUnitOfWork(fakeClient as unknown as PrismaClient)
        .execute(async () => "workflow", { maxSerializationRetries: value }));
      assert.equal(attempts, 4);
    }
    let boundedAttempts = 0;
    const boundedClient = {
      $transaction: async <T>(
        work: (transaction: unknown) => Promise<T>,
      ): Promise<T> => {
        boundedAttempts++;
        await work(undefined);
        throw { code: "P2034" };
      },
    };
    await assert.rejects(new SharedUnitOfWork(boundedClient as unknown as PrismaClient)
      .execute(async () => "workflow", { maxSerializationRetries: 0 }));
    assert.equal(boundedAttempts, 1);
  });
});