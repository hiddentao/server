import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { serverConfig } from "../../shared/config/server"
import { createDummyLogger, type Logger, startSpan } from "../lib/logger"
import * as schema from "./schema"
import type { Database } from "./shared"

// Global logger state - starts as dummy, gets set by bootstrap
let logger: Logger = createDummyLogger()

// Global connection state to prevent multiple connections
let globalDb: Database | null = null
let globalClient: postgres.Sql | null = null
let globalConnectionPromise: Promise<void> | null = null
let isGloballyConnected = false
let connectionAttemptCount = 0

/**
 * Global singleton database connection manager
 * Prevents multiple connection pools from being created across processes
 */
class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager | null = null

  private constructor() {}

  static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager()
    }
    return DatabaseConnectionManager.instance
  }

  setLogger(newLogger: Logger): void {
    logger = newLogger
  }

  async connect(options?: {
    maxConnections?: number
    idleTimeout?: number
    connectTimeout?: number
    databaseUrl?: string
  }): Promise<Database> {
    // If already connected globally, return existing db
    if (isGloballyConnected && globalDb) {
      logger.debug("Reusing existing database connection")
      return globalDb
    }

    // If connection is in progress, wait for it
    if (globalConnectionPromise) {
      logger.debug("Waiting for existing connection attempt")
      await globalConnectionPromise
      if (globalDb) {
        return globalDb
      }
    }

    // For test environment, enforce strict connection limits
    const isTest = serverConfig.NODE_ENV === "test"
    if (isTest) {
      // In test mode, allow multiple connections for worker processes
      const finalOptions = {
        ...options,
        maxConnections: 3, // Allow server + worker + spare
        idleTimeout: 0, // Never timeout in tests
      }
      logger.debug(
        `Test mode: creating connection with max=${finalOptions.maxConnections} to ${finalOptions.databaseUrl}`,
      )
      globalConnectionPromise = this._createConnection(finalOptions)
    } else {
      // Normal connection creation for non-test environments
      logger.debug(
        `Production mode: creating connection with max=${options?.maxConnections} to ${options?.databaseUrl}`,
      )
      globalConnectionPromise = this._createConnection(options)
    }

    await globalConnectionPromise

    if (!globalDb) {
      throw new Error("Failed to create database connection")
    }

    return globalDb
  }

  private async _createConnection(options?: {
    maxConnections?: number
    idleTimeout?: number
    connectTimeout?: number
    databaseUrl?: string
  }): Promise<void> {
    try {
      const databaseUrl = options?.databaseUrl || serverConfig.DATABASE_URL
      const isTest = serverConfig.NODE_ENV === "test"

      connectionAttemptCount++
      logger.debug(
        `Creating new database connection pool... (attempt #${connectionAttemptCount})`,
      )

      // In test environment, log connection attempts for debugging
      if (isTest) {
        logger.debug(
          `Test environment connection attempt #${connectionAttemptCount}`,
        )
        if (connectionAttemptCount > 3) {
          logger.error(
            `Test environment: Too many connection attempts (${connectionAttemptCount}). This may indicate a problem.`,
          )
        }
      }

      // Determine connection pool size based on process type
      const isWorkerProcess = process.send !== undefined // Worker processes have IPC
      let maxConnections = options?.maxConnections

      if (!maxConnections) {
        if (isTest) {
          maxConnections = 1 // Very small for tests
        } else if (isWorkerProcess) {
          maxConnections = 2 // Small pool for worker processes
        } else {
          maxConnections = 10 // Normal pool for main server
        }
      }

      // Create postgres client with appropriate settings for environment
      globalClient = postgres(databaseUrl, {
        max: maxConnections,
        idle_timeout: options?.idleTimeout || (isTest ? 0 : 20), // Never timeout in tests
        connect_timeout: options?.connectTimeout || 10,
        onnotice: (notice) => {
          logger.debug(notice)
        },
      })

      // Create drizzle instance and attach startSpan method
      const baseDb = drizzle(globalClient, {
        schema,
        logger: {
          logQuery: (query, params) => {
            logger.debug(`Executing query: ${query}`, { params })
          },
        },
      })

      globalDb = Object.assign(baseDb, { startSpan }) as Database

      // Test the connection
      await globalClient`SELECT 1 as test`

      isGloballyConnected = true
      globalConnectionPromise = null

      logger.info(
        `Database connection established (max: ${globalClient.options.max} connections, attempt #${connectionAttemptCount})`,
      )
    } catch (error) {
      globalConnectionPromise = null
      logger.error("Failed to connect to database:", error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (globalClient && isGloballyConnected) {
        logger.debug("Disconnecting from database...")
        await globalClient.end()
        globalClient = null
        globalDb = null
        isGloballyConnected = false
        logger.info("Database disconnected")
      }
    } catch (error) {
      logger.error("Error disconnecting from database:", error)
      throw error
    }
  }

  getDb(): Database {
    if (!isGloballyConnected || !globalDb) {
      throw new Error("Database not connected. Call connect() first.")
    }
    return globalDb
  }

  isConnectionActive(): boolean {
    return isGloballyConnected && globalDb !== null
  }

  getConnectionStats(): {
    isConnected: boolean
    maxConnections: number | undefined
  } {
    return {
      isConnected: isGloballyConnected,
      maxConnections: globalClient?.options.max,
    }
  }
}

// Export singleton instance
export const dbManager = DatabaseConnectionManager.getInstance()

export { schema }
