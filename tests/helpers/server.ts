/**
 * Server test helpers for Echo
 *
 * Utilities for starting/stopping test servers, making requests,
 * and managing test server lifecycle.
 */

import { createApp } from "../../src/server/start-server"
import type { ServerApp } from "../../src/server/types"
import { testLogger } from "./logger"

export interface TestServer {
  app: any
  server: any
  serverApp: ServerApp
  url: string
  shutdown: () => Promise<void>
}

/**
 * Start a test server instance using the real server creation code
 */
export async function startTestServer(
  options: { workerCountOverride?: number } = {},
): Promise<TestServer> {
  testLogger.info("🚀 Starting test server...")

  // Use the real server creation code - this will automatically use test configuration
  // since NODE_ENV=test is set by the test runner
  const { app, server, serverApp } = await createApp(options)

  // The server will automatically start on the test port (3002)
  // because that's configured in .env.test
  const url = `http://localhost:3002`

  testLogger.info(`✅ Test server started at ${url}`)

  return {
    app,
    server,
    serverApp,
    url,
    shutdown: async () => {
      testLogger.info("🛑 Shutting down test server...")

      try {
        // Stop the server
        if (server && typeof server.stop === "function") {
          await server.stop()
        }

        // Stop workers if they exist
        if (serverApp.workerManager) {
          await serverApp.workerManager.shutdown()
        }

        testLogger.info("✅ Test server shut down")
      } catch (error) {
        testLogger.error("❌ Error shutting down test server:", error)
        throw error
      }
    },
  }
}

/**
 * Make HTTP request to test server
 */
export async function makeRequest(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  return response
}

/**
 * Wait for server to be ready
 */
export async function waitForServer(
  url: string,
  maxAttempts = 10,
  delayMs = 100,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await makeRequest(`${url}/health`)
      if (response.ok) {
        return
      }
    } catch {
      // Server not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  throw new Error(`Server not ready after ${maxAttempts} attempts`)
}
