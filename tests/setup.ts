/**
 * Global test setup and teardown
 * Manages database connections and ensures proper cleanup
 */

import { afterAll, beforeAll } from "bun:test"
import { dbManager } from "../src/server/db/connection"
import { closeTestDb, initTestDb } from "./helpers/database"
import { testLogger } from "./helpers/logger"
import { killAllActiveWorkers } from "./helpers/worker"

// Global test setup - runs once before all tests
beforeAll(async () => {
  testLogger.info("🚀 Global test setup starting...")

  try {
    // Initialize shared test database connection
    await initTestDb()
    testLogger.info("✅ Global test database initialized")

    // Log connection stats for debugging
    const stats = dbManager.getConnectionStats()
    testLogger.info("📊 Database connection stats:", stats)
  } catch (error) {
    testLogger.error("❌ Global test setup failed:", error)
    throw error
  }
})

// Global test teardown - runs once after all tests
afterAll(async () => {
  testLogger.info("🧹 Global test teardown starting...")

  try {
    // Kill any remaining worker processes
    killAllActiveWorkers()

    // Close all database connections
    await closeTestDb()
    testLogger.info("✅ Global test database cleanup complete")
  } catch (error) {
    testLogger.error("❌ Global test teardown failed:", error)
    // Don't throw here to avoid masking test failures
  }
})

// Export connection monitoring utilities for tests
export const getConnectionStats = () => dbManager.getConnectionStats()
export const isDbConnected = () => dbManager.isConnectionActive()
