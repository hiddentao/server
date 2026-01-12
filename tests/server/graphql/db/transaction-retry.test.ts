import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { dbManager } from "@server/db/connection"
import { withTransaction } from "@server/db/shared"
import { cleanTestDatabase, setupTestDatabase } from "@tests/helpers/database"

describe("Transaction Retry Logic", () => {
  beforeAll(async () => {
    await setupTestDatabase()
  })

  afterAll(async () => {
    await cleanTestDatabase()
  })

  describe("Basic Functionality", () => {
    it("should execute transaction successfully", async () => {
      const result = await withTransaction(dbManager.getDb(), async (tx) => {
        return { success: true }
      })

      expect(result).toEqual({ success: true })
    })

    it("should return transaction result value", async () => {
      const result = await withTransaction(dbManager.getDb(), async (tx) => {
        return 42
      })

      expect(result).toBe(42)
    })

    it("should handle async operations within transaction", async () => {
      const result = await withTransaction(dbManager.getDb(), async (tx) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return "async-result"
      })

      expect(result).toBe("async-result")
    })

    it("should throw errors from transaction function", async () => {
      await expect(async () => {
        await withTransaction(dbManager.getDb(), async (tx) => {
          throw new Error("Test error")
        })
      }).toThrow("Test error")
    })
  })

  describe("Nested Transaction Handling", () => {
    it("should detect and use existing transaction", async () => {
      const result = await withTransaction(dbManager.getDb(), async (tx1) => {
        const nestedResult = await withTransaction(tx1, async (tx2) => {
          return "nested"
        })
        return nestedResult
      })

      expect(result).toBe("nested")
    })

    it("should not retry nested transactions", async () => {
      let attemptCount = 0

      await expect(async () => {
        await withTransaction(dbManager.getDb(), async (tx1) => {
          await withTransaction(tx1, async (tx2) => {
            attemptCount++
            throw new Error("Nested error")
          })
        })
      }).toThrow("Nested error")

      expect(attemptCount).toBe(1)
    })

    it("should allow multiple nested transaction calls", async () => {
      const result = await withTransaction(dbManager.getDb(), async (tx1) => {
        const result1 = await withTransaction(tx1, async (tx2) => {
          return "first"
        })

        const result2 = await withTransaction(tx1, async (tx2) => {
          return "second"
        })

        return [result1, result2]
      })

      expect(result).toEqual(["first", "second"])
    })
  })

  describe("Serialization Error Detection", () => {
    it("should detect 40001 error code", async () => {
      let attemptCount = 0

      await expect(async () => {
        await withTransaction(dbManager.getDb(), async (tx) => {
          attemptCount++
          const error: any = new Error("Serialization failure")
          error.name = "PostgresError"
          error.code = "40001"
          throw error
        })
      }).toThrow("Transaction failed after 7 retries")

      expect(attemptCount).toBe(7)
    })

    it("should detect 40P01 error code", async () => {
      let attemptCount = 0

      await expect(async () => {
        await withTransaction(dbManager.getDb(), async (tx) => {
          attemptCount++
          const error: any = new Error("Deadlock detected")
          error.name = "PostgresError"
          error.code = "40P01"
          throw error
        })
      }).toThrow("Transaction failed after 7 retries")

      expect(attemptCount).toBe(7)
    })

    it("should detect 'could not serialize' in error message", async () => {
      let attemptCount = 0

      await expect(async () => {
        await withTransaction(dbManager.getDb(), async (tx) => {
          attemptCount++
          const error = new Error(
            "Operation failed: could not serialize access",
          )
          ;(error as any).name = "PostgresError"
          throw error
        })
      }).toThrow("Transaction failed after 7 retries")

      expect(attemptCount).toBe(7)
    })

    it("should detect 'transaction is aborted' in error message", async () => {
      let attemptCount = 0

      await expect(async () => {
        await withTransaction(dbManager.getDb(), async (tx) => {
          attemptCount++
          const error = new Error("transaction is aborted")
          ;(error as any).name = "PostgresError"
          throw error
        })
      }).toThrow("Transaction failed after 7 retries")

      expect(attemptCount).toBe(7)
    })

    it("should not retry non-serialization errors", async () => {
      let attemptCount = 0

      await expect(async () => {
        await withTransaction(dbManager.getDb(), async (tx) => {
          attemptCount++
          throw new Error("Regular error")
        })
      }).toThrow("Regular error")

      expect(attemptCount).toBe(1)
    })

    it("should detect error code in cause property", async () => {
      let attemptCount = 0

      await expect(async () => {
        await withTransaction(dbManager.getDb(), async (tx) => {
          attemptCount++
          const cause: any = new Error("Postgres error")
          cause.name = "PostgresError"
          cause.code = "40001"
          const error = new Error("Wrapper error", { cause })
          throw error
        })
      }).toThrow("Transaction failed after 7 retries")

      expect(attemptCount).toBe(7)
    })
  })

  describe("Retry Logic", () => {
    it("should retry up to MAX_RETRIES times", async () => {
      let attemptCount = 0

      await expect(async () => {
        await withTransaction(dbManager.getDb(), async (tx) => {
          attemptCount++
          const error: any = new Error("Serialization error")
          error.name = "PostgresError"
          error.code = "40001"
          throw error
        })
      }).toThrow("Transaction failed after 7 retries")

      expect(attemptCount).toBe(7)
    })

    it("should succeed on second attempt", async () => {
      let attemptCount = 0

      const result = await withTransaction(dbManager.getDb(), async (tx) => {
        attemptCount++
        if (attemptCount === 1) {
          const error: any = new Error("Temporary serialization error")
          error.name = "PostgresError"
          error.code = "40001"
          throw error
        }
        return "success"
      })

      expect(result).toBe("success")
      expect(attemptCount).toBe(2)
    })

    it("should succeed on third attempt", async () => {
      let attemptCount = 0

      const result = await withTransaction(dbManager.getDb(), async (tx) => {
        attemptCount++
        if (attemptCount < 3) {
          const error: any = new Error("Temporary serialization error")
          error.name = "PostgresError"
          error.code = "40001"
          throw error
        }
        return "success-after-retries"
      })

      expect(result).toBe("success-after-retries")
      expect(attemptCount).toBe(3)
    })

    it("should use exponential backoff delays with jitter", async () => {
      let attemptCount = 0
      const timestamps: number[] = []

      await expect(async () => {
        await withTransaction(dbManager.getDb(), async (tx) => {
          attemptCount++
          timestamps.push(Date.now())

          const error: any = new Error("Serialization error")
          error.name = "PostgresError"
          error.code = "40001"
          throw error
        })
      }).toThrow("Transaction failed after 7 retries")

      expect(attemptCount).toBe(7)
      expect(timestamps.length).toBe(7)

      // With jitter factor 0.5, delays can vary significantly
      // Base delays: 50, 100, 200, 400, 800, 1600 ms
      // With jitter: each delay is base + random(0, base * 0.5)
      const delay1 = timestamps[1]! - timestamps[0]!
      const delay2 = timestamps[2]! - timestamps[1]!

      // First delay: 50ms base + up to 25ms jitter (50-75ms)
      expect(delay1).toBeGreaterThanOrEqual(40)
      expect(delay1).toBeLessThan(100)

      // Second delay: 100ms base + up to 50ms jitter (100-150ms)
      expect(delay2).toBeGreaterThanOrEqual(80)
      expect(delay2).toBeLessThan(200)
    })
  })

  describe("Concurrency", () => {
    it("should handle multiple concurrent transactions", async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        withTransaction(dbManager.getDb(), async (tx) => {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 10),
          )
          return i
        }),
      )

      const results = await Promise.all(promises)
      expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    })

    it("should retry concurrent transactions independently", async () => {
      const attemptCounts = [0, 0, 0]

      const promises = [
        withTransaction(dbManager.getDb(), async (tx) => {
          attemptCounts[0]!++
          if (attemptCounts[0] === 1) {
            const error: any = new Error("Serialization error 1")
            error.name = "PostgresError"
            error.code = "40001"
            throw error
          }
          return "result-1"
        }),
        withTransaction(dbManager.getDb(), async (tx) => {
          attemptCounts[1]!++
          if (attemptCounts[1]! < 3) {
            const error: any = new Error("Serialization error 2")
            error.name = "PostgresError"
            error.code = "40001"
            throw error
          }
          return "result-2"
        }),
        withTransaction(dbManager.getDb(), async (tx) => {
          attemptCounts[2]!++
          return "result-3"
        }),
      ]

      const results = await Promise.all(promises)

      expect(results).toEqual(["result-1", "result-2", "result-3"])
      expect(attemptCounts[0]).toBe(2)
      expect(attemptCounts[1]).toBe(3)
      expect(attemptCounts[2]).toBe(1)
    })
  })

  describe("Error Propagation", () => {
    it("should throw TransactionSerializationError after exhausting retries", async () => {
      let attemptCount = 0

      try {
        await withTransaction(dbManager.getDb(), async (tx) => {
          attemptCount++
          const error: any = new Error(
            `Serialization error attempt ${attemptCount}`,
          )
          error.name = "PostgresError"
          error.code = "40001"
          throw error
        })
      } catch (error: any) {
        expect(error.name).toBe("TransactionSerializationError")
        expect(error.message).toContain("Transaction failed after 7 retries")
        expect(error.originalError).toBeDefined()
        expect(error.originalError.message).toBe(
          "Serialization error attempt 7",
        )
      }

      expect(attemptCount).toBe(7)
    })

    it("should immediately throw non-retryable errors", async () => {
      let attemptCount = 0

      await expect(async () => {
        await withTransaction(dbManager.getDb(), async (tx) => {
          attemptCount++
          throw new Error("Constraint violation")
        })
      }).toThrow("Constraint violation")

      expect(attemptCount).toBe(1)
    })

    it("should preserve error properties", async () => {
      try {
        await withTransaction(dbManager.getDb(), async (tx) => {
          const error: any = new Error("Custom error")
          error.code = "CUSTOM_CODE"
          error.customProperty = "custom-value"
          throw error
        })
      } catch (error: any) {
        expect(error.message).toBe("Custom error")
        expect(error.code).toBe("CUSTOM_CODE")
        expect(error.customProperty).toBe("custom-value")
      }
    })
  })
})
