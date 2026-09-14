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

const isSerializationConflict = (error: unknown): boolean => (
  typeof error === "object"
  && error !== null
  && "code" in error
  && (error as { code?: unknown }).code === "P2034"
);

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