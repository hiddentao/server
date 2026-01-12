import type { PgTransaction } from "drizzle-orm/pg-core"
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { startSpan } from "../lib/logger"
import type * as schema from "./schema"

export class TransactionSerializationError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
  ) {
    super(message)
    this.name = "TransactionSerializationError"
  }
}

export type Database = PostgresJsDatabase<typeof schema> & {
  startSpan: typeof startSpan
}

export type Transaction = PgTransaction<any, typeof schema> & {
  startSpan: typeof startSpan
}

export type DatabaseOrTransaction = Database | Transaction

const MAX_RETRIES = 7
const INITIAL_RETRY_DELAY_MS = 50
const JITTER_FACTOR = 0.5

function isSerializationError(error: any): boolean {
  const errs = [error, error?.cause]

  for (const err of errs) {
    if (err) {
      const name = err.name || ""
      const code = err.code || ""
      const msg = err.message || ""
      if (
        name === "PostgresError" &&
        (code === "40001" ||
          code === "40P01" ||
          msg.includes("could not serialize") ||
          msg.includes("transaction is aborted"))
      ) {
        return true
      }
    }
  }

  return false
}

/**
 * Execute a function within a transaction context with automatic retry on serialization failures.
 * If the provided database context is already a transaction, use it directly (no retry).
 * Otherwise, create a new transaction with retry logic for concurrent access scenarios.
 *
 * Retries up to MAX_RETRIES times with exponential backoff + jitter when encountering
 * PostgreSQL serialization failures (40001) or deadlocks (40P01).
 */
export async function withTransaction<T>(
  db: DatabaseOrTransaction,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  if ("rollback" in db) {
    const tx = db as Transaction
    if (!tx.startSpan) {
      ;(tx as any).startSpan = startSpan
    }
    return fn(tx)
  }

  let lastError: any
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await (db as Database).transaction(
        (tx) => {
          ;(tx as any).startSpan = startSpan
          return fn(tx as any as Transaction)
        },
        { isolationLevel: "serializable" },
      )
    } catch (error) {
      lastError = error

      if (isSerializationError(error)) {
        if (attempt < MAX_RETRIES - 1) {
          const baseDelay = INITIAL_RETRY_DELAY_MS * 2 ** attempt
          const jitter = Math.random() * baseDelay * JITTER_FACTOR
          const delayMs = Math.round(baseDelay + jitter)
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          continue
        }

        throw new TransactionSerializationError(
          `Transaction failed after ${MAX_RETRIES} retries due to serialization conflicts`,
          error instanceof Error ? error : new Error(String(error)),
        )
      }

      throw error
    }
  }

  throw lastError
}
