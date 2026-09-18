import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

/**
 * The transaction client is intentionally an internal type.  It is passed
 * between trusted module APIs, never serialized as part of an HTTP request.
 */
export type SharedTransactionContext = Prisma.TransactionClient;

export interface SharedUnitOfWorkOptions {
  /**
   * Number of retries after the initial attempt.  Keeping the bound here
   * prevents an unavailable database from causing an unbounded request.
   */
  maxSerializationRetries?: number;
}

export const isSerializationConflict = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as {
    code?: unknown;
    name?: unknown;
    cause?: unknown;
    kind?: unknown;
    message?: unknown;
    sqlState?: unknown;
    sqlstate?: unknown;
    postgresCode?: unknown;
    originalCode?: unknown;
    meta?: unknown;
  };
  if (candidate.code === "P2034") return true;
  if (candidate.code === "P2010") {
    if (typeof candidate.meta !== "object" || candidate.meta === null) return false;
    const adapter = (candidate.meta as { driverAdapterError?: unknown }).driverAdapterError;
    if (typeof adapter !== "object" || adapter === null) return false;
    const nestedCause = (adapter as { cause?: unknown }).cause;
    if (typeof nestedCause !== "object" || nestedCause === null) return false;
    const structuredCause = nestedCause as { originalCode?: unknown; code?: unknown; sqlState?: unknown; sqlstate?: unknown };
    return [structuredCause.originalCode, structuredCause.code, structuredCause.sqlState, structuredCause.sqlstate].includes("40001");
  }
  if (candidate.name !== "DriverAdapterError" && candidate.name !== "PrismaClientKnownRequestError") return false;
  if (candidate.kind === "TransactionWriteConflict" || candidate.message === "TransactionWriteConflict") return true;
  if ([candidate.code, candidate.sqlState, candidate.sqlstate, candidate.postgresCode, candidate.originalCode].includes("40001")) return true;
  if (typeof candidate.cause === "object" && candidate.cause !== null) return isSerializationConflict({ name: "DriverAdapterError", ...(candidate.cause as object) });
  return false;
};

/**
 * Shared infrastructure for workflows that must atomically coordinate more
 * than one module.  Domain services own the callback; this class only owns
 * transaction boundaries, isolation and bounded serialization retries.
 */
export class SharedUnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  execute<T>(
    work: (transaction: SharedTransactionContext) => Promise<T>,
    options: SharedUnitOfWorkOptions = {},
  ): Promise<T> {
    const maxRetries = options.maxSerializationRetries ?? 3;

    const run = async (attempt: number): Promise<T> => {
      try {
        return await this.prisma.$transaction(
          (transaction) => work(transaction),
          { isolationLevel: "Serializable" },
        );
      } catch (error) {
        if (isSerializationConflict(error) && attempt < maxRetries) {
          return run(attempt + 1);
        }
        throw error;
      }
    };

    return run(0);
  }
}