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

const containsRetryableSqlState = (
  value: unknown,
  seen = new Set<object>(),
  depth = 0,
): boolean => {
  if (depth > 8 || value === null || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  for (const [key, nested] of Object.entries(value)) {
    if (
      (key === "code" || key === "originalCode" || key === "sqlState" || key === "sqlstate" || key === "postgresCode")
      && (nested === "40001" || nested === "40P01")
    ) return true;
    if (containsRetryableSqlState(nested, seen, depth + 1)) return true;
  }
  return false;
};

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
  if (containsRetryableSqlState(error)) return true;
  if (candidate.code === "P2010") {
    if (typeof candidate.meta !== "object" || candidate.meta === null) return false;
    const adapter = (candidate.meta as { driverAdapterError?: unknown }).driverAdapterError;
    if (typeof adapter !== "object" || adapter === null) return false;
    const nestedCause = (adapter as { cause?: unknown }).cause;
    if (typeof nestedCause !== "object" || nestedCause === null) return false;
    const structuredCause = nestedCause as { originalCode?: unknown; code?: unknown; sqlState?: unknown; sqlstate?: unknown };
    return [structuredCause.originalCode, structuredCause.code, structuredCause.sqlState, structuredCause.sqlstate].some(
      (code) => code === "40001" || code === "40P01",
    );
  }
  if (candidate.name !== "DriverAdapterError" && candidate.name !== "PrismaClientKnownRequestError") return false;
  if (candidate.kind === "TransactionWriteConflict" || candidate.message === "TransactionWriteConflict") return true;
  if ([candidate.code, candidate.sqlState, candidate.sqlstate, candidate.postgresCode, candidate.originalCode].some(
    (code) => code === "40001" || code === "40P01",
  )) return true;
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
    const maxRetries = options.maxSerializationRetries === undefined
      ? 3
      : Number.isSafeInteger(options.maxSerializationRetries) && options.maxSerializationRetries >= 0
        ? options.maxSerializationRetries
        : 3;

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