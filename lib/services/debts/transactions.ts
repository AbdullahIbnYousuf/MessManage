import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const MAX_SERIALIZABLE_ATTEMPTS = 3;

function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2034"
  );
}

export async function withSerializableRetry<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_ATTEMPTS; attempt++) {
    try {
      return await db.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 30_000,
      });
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === MAX_SERIALIZABLE_ATTEMPTS) {
        throw error;
      }
    }
  }

  throw lastError;
}
