/**
 * Worker process functionality
 * This file is imported by src/server/index.ts when running in worker mode
 */

import * as Sentry from "@sentry/node"
import { serverConfig } from "../shared/config/server"
import { createServerApp } from "./bootstrap"
import { createRootLogger, getLogLevel } from "./lib/logger"
import { initializeSentry } from "./lib/sentry"
import type { ServerApp } from "./types"
import { WorkerIPCMessageType } from "./workers/ipc-types"
import { WorkerSocketManager } from "./workers/socket-manager"
import { runWorker } from "./workers/worker"

export const startWorker = async (workerId: string) => {
  // Initialize Sentry for worker process if DSN is configured
  if (serverConfig.SENTRY_WORKER_DSN) {
    initializeSentry({
      dsn: serverConfig.SENTRY_WORKER_DSN,
      environment: serverConfig.NODE_ENV,
      tracesSampleRate: serverConfig.SENTRY_TRACES_SAMPLE_RATE,
      profileSessionSampleRate: serverConfig.SENTRY_PROFILE_SESSION_SAMPLE_RATE,
    })
  }
  // Create worker root logger instance
  const logger = createRootLogger(
    `worker-${workerId}`,
    getLogLevel(serverConfig.WORKER_LOG_LEVEL),
  )

  try {
    logger.info("Worker process starting")

    // Send startup message to parent process
    if (process.send) {
      process.send({
        type: WorkerIPCMessageType.WorkerStarted,
        pid: process.pid,
      })
    }

    // Create worker-side SocketManager
    const socketManager = new WorkerSocketManager(logger)

    // Create the server app context for the worker (without worker manager to avoid circular dependency)
    logger.debug("Worker creating database connection...")
    const baseServerApp = await createServerApp({
      includeWorkerManager: false,
      socketManager,
      rootLogger: logger,
    })
    logger.debug("Worker database connection created successfully")

    const serverApp: ServerApp = {
      ...baseServerApp,
      app: null as any, // Workers don't need the Elysia app
      workerManager: null as any, // Workers don't need the worker manager
    }

    // Set up graceful shutdown
    const shutdown = async () => {
      logger.info("Worker process shutting down")

      // Flush Sentry events if enabled
      if (serverConfig.SENTRY_WORKER_DSN) {
        await Sentry.close(2000)
        logger.info("Sentry events flushed")
      }

      if (process.send) {
        process.send({
          type: WorkerIPCMessageType.WorkerShutdown,
          pid: process.pid,
        })
      }
      process.exit(0)
    }

    process.on("SIGTERM", shutdown)
    process.on("SIGINT", shutdown)

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Worker uncaught exception:", error)
      Sentry.captureException(error)
      process.exit(1)
    })

    process.on("unhandledRejection", (reason) => {
      logger.error("Worker unhandled rejection:", reason)
      Sentry.captureException(reason)
      process.exit(1)
    })

    // Start the worker loop
    await runWorker(serverApp)
  } catch (err: any) {
    logger.error("Worker process error:", err)
    Sentry.captureException(err)
    if (process.send) {
      process.send({
        type: WorkerIPCMessageType.WorkerError,
        error: err.message,
        pid: process.pid,
      })
    }
    process.exit(1)
  }
}
