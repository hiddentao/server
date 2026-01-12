import path from "node:path"
import { cors } from "@elysiajs/cors"
import { staticPlugin } from "@elysiajs/static"
import * as Sentry from "@sentry/node"
import { serverConfig } from "@shared/config/server"
import { Elysia } from "elysia"
import { createOAuthRoutes } from "./auth/oauth-routes"
import { createServerApp } from "./bootstrap"
import { dbManager } from "./db/connection"
import { getPrivacyPolicy, getTermsAndConditions } from "./db/legalContent"
import { createGraphQLHandler } from "./graphql"
import { createRootLogger } from "./lib/logger"
import { initializeSentry } from "./lib/sentry"
import {
  renderLegalPage,
  renderPlaceholderLegalPage,
} from "./templates/legalPage"
import type { ServerApp } from "./types"
import { createWebSocket, SocketManager } from "./ws"

// Create and start the server
export const createApp = async (
  options: { workerCountOverride?: number } = {},
) => {
  // Initialize Sentry if DSN is provided
  if (serverConfig.SENTRY_DSN) {
    initializeSentry({
      dsn: serverConfig.SENTRY_DSN,
      environment: serverConfig.NODE_ENV,
      tracesSampleRate: serverConfig.SENTRY_TRACES_SAMPLE_RATE,
      profileSessionSampleRate: serverConfig.SENTRY_PROFILE_SESSION_SAMPLE_RATE,
    })
  }

  const startTime = performance.now()

  // Create root logger instance
  const logger = createRootLogger("server")

  // Handle graceful shutdown
  const handleShutdown = async () => {
    logger.info("Server shutting down...")

    try {
      // Disconnect from database
      await dbManager.disconnect()
      logger.info("Database disconnected")

      // Flush Sentry events if enabled
      if (serverConfig.SENTRY_DSN) {
        await Sentry.close(2000)
        logger.info("Sentry events flushed")
      }
    } catch (error) {
      logger.error("Error during shutdown:", error)
    }

    process.exit(0)
  }

  // Register shutdown handlers
  process.on("SIGINT", handleShutdown)
  process.on("SIGTERM", handleShutdown)

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception:", error)
    Sentry.captureException(error)
    process.exit(1)
  })

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled rejection at:", promise, "reason:", reason)
    Sentry.captureException(reason)
    process.exit(1)
  })

  logger.info("Starting Echo server...")

  // Create SocketManager
  const socketManager = new SocketManager(logger)

  // Create ServerApp with worker manager
  const bootstrapResult = await createServerApp({
    includeWorkerManager: true,
    workerCountOverride: options.workerCountOverride,
    socketManager,
    rootLogger: logger,
  })

  // Create base Elysia app
  const app = new Elysia({
    websocket: {
      idleTimeout: 120,
      perMessageDeflate: true,
    },
  })

  // Create the complete ServerApp instance
  const serverApp: ServerApp = {
    ...bootstrapResult,
    app,
    workerManager: bootstrapResult.workerManager!,
  }

  logger.info(
    `Worker manager initialized with ${serverConfig.WORKER_COUNT} workers`,
  )

  // Configure Elysia app
  app
    .onError(({ error, set, request }) => {
      // Handle NOT_FOUND errors as 404s
      if (
        (error as Error)?.message === "NOT_FOUND" ||
        (error as any)?.code === "NOT_FOUND"
      ) {
        set.status = 404
        return { error: "Not found" }
      }

      // Capture exception in Sentry
      Sentry.captureException(error)

      // Log and return 500 for actual server errors
      logger.error(`Unhandled error (Request: ${request.url}):`, error)
      set.status = 500
      return { error: "Internal server error" }
    })
    .use(
      cors({
        origin: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        credentials: true,
      }),
    )
    // Health check endpoint
    .get("/health", () => ({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: serverConfig.APP_VERSION,
    }))
    // Version endpoint
    .get("/version", () => ({
      version: serverConfig.APP_VERSION,
      name: "Echo",
      environment: serverConfig.NODE_ENV,
    }))
    // Chrome DevTools integration for development
    .get("/.well-known/appspecific/com.chrome.devtools.json", () => {
      if (serverConfig.NODE_ENV === "development") {
        return {
          workspace: {
            root: path.join(__dirname, "..", ".."),
            uuid: "echo-server",
          },
        }
      }
      return new Response(null, { status: 204 })
    })
    // Favicon handler
    .get("/favicon.ico", () => new Response(null, { status: 204 }))

  // Add GraphQL endpoint
  app.use(createGraphQLHandler(serverApp))

  // Add OAuth callback routes
  app.use(createOAuthRoutes(serverApp))

  // Add WebSocket endpoint
  app.use(createWebSocket(serverApp))

  // Serve static assets from Vite build (or configurable location)
  const staticDir =
    serverConfig.STATIC_ASSETS_FOLDER || path.join(import.meta.dir, "static")

  // Serve landing page at root
  app.get("/", async ({ set }) => {
    // First try landing.html from static-src (development) or static (production)
    const landingPaths = [
      path.join(import.meta.dir, "static-src", "landing.html"),
      path.join(staticDir, "landing.html"),
      path.join(staticDir, "index.html"),
    ]

    for (const landingPath of landingPaths) {
      const file = Bun.file(landingPath)
      if (await file.exists()) {
        set.headers["content-type"] = "text/html; charset=utf-8"
        return file
      }
    }

    set.status = 404
    return "Not found"
  })

  // Privacy policy page
  app.get("/privacy", async ({ set }) => {
    try {
      const content = await getPrivacyPolicy(serverApp.db)
      set.headers["content-type"] = "text/html; charset=utf-8"

      if (content) {
        return renderLegalPage({
          title: content.title,
          content: content.content,
          version: content.version,
          effectiveDate: content.effectiveDate,
        })
      }

      return renderPlaceholderLegalPage("privacy")
    } catch (error) {
      logger.error("Failed to render privacy policy:", error)
      return renderPlaceholderLegalPage("privacy")
    }
  })

  // Terms and conditions page
  app.get("/terms", async ({ set }) => {
    try {
      const content = await getTermsAndConditions(serverApp.db)
      set.headers["content-type"] = "text/html; charset=utf-8"

      if (content) {
        return renderLegalPage({
          title: content.title,
          content: content.content,
          version: content.version,
          effectiveDate: content.effectiveDate,
        })
      }

      return renderPlaceholderLegalPage("terms")
    } catch (error) {
      logger.error("Failed to render terms page:", error)
      return renderPlaceholderLegalPage("terms")
    }
  })

  app.use(
    staticPlugin({
      assets: staticDir,
      prefix: "",
      indexHTML: false,
      alwaysStatic: true,
    }),
  )

  // Start the server
  const server = app.listen(
    {
      port: serverConfig.PORT,
      hostname: serverConfig.HOST,
    },
    (server) => {
      const duration = performance.now() - startTime
      logger.info(
        `🚀 Echo server v${serverConfig.APP_VERSION} started in ${duration.toFixed(2)}ms`,
      )
      logger.info(`➜ Running at: ${server.url}`)
      logger.info(`➜ GraphQL endpoint: ${server.url}graphql`)
      logger.info(`➜ Environment: ${serverConfig.NODE_ENV}`)
    },
  )

  return { app, server, serverApp }
}
