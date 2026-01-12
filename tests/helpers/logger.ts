/**
 * Test logger helper
 *
 * Provides a singleton logger instance for all test files
 * Uses the test-logger category with severity level from serverConfig
 */

import { createRootLogger } from "../../src/server/lib/logger"

// Singleton test logger instance
const rootLogger = createRootLogger("test")
export const testLogger = rootLogger.child("test-logger")
