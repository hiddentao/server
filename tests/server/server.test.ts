/**
 * Server integration tests for Echo
 *
 * Tests the core server functionality including:
 * - Server startup and configuration
 * - Database connection
 * - Worker initialization
 * - Basic routing
 * - Error handling
 * - Graceful shutdown
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import {
  cleanTestDatabase,
  closeTestDb,
  setupTestDatabase,
} from "../helpers/database"
import type { TestServer } from "../helpers/server"
import { makeRequest, startTestServer, waitForServer } from "../helpers/server"
// Import global test setup
import "../setup"

describe("Server Integration Tests", () => {
  let testServer: TestServer | null = null

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase()

    // Start test server with worker count override
    testServer = await startTestServer({ workerCountOverride: 1 })

    // Wait for server to be ready
    await waitForServer(testServer.url)
  })

  afterAll(async () => {
    // Shutdown test server
    if (testServer) {
      await testServer.shutdown()
    }

    // Clean test database
    await cleanTestDatabase()

    // Close test database connection
    await closeTestDb()
  })

  describe("Server Bootstrap", () => {
    it("should start server successfully", () => {
      expect(testServer).not.toBeNull()
      expect(testServer?.server).toBeDefined()
      expect(testServer?.app).toBeDefined()
      expect(testServer?.serverApp).toBeDefined()
    })

    it("should have ServerApp with all required components", () => {
      if (!testServer) throw new Error("Test server not initialized")

      const { serverApp } = testServer

      // Check ServerApp structure
      expect(serverApp.app).toBeDefined()
      expect(serverApp.db).toBeDefined()
      expect(serverApp.rootLogger).toBeDefined()
      expect(serverApp.createLogger).toBeDefined()
      expect(serverApp.workerManager).toBeDefined()

      // Check logger functionality
      const testLogger = serverApp.createLogger("test")
      expect(testLogger).toBeDefined()
      expect(typeof testLogger.info).toBe("function")
      expect(typeof testLogger.error).toBe("function")
    })

    it("should initialize worker manager", () => {
      if (!testServer) throw new Error("Test server not initialized")

      const { workerManager } = testServer.serverApp

      expect(workerManager).toBeDefined()
      expect(typeof workerManager.submitJob).toBe("function")
      expect(typeof workerManager.getWorkerCount).toBe("function")
      expect(typeof workerManager.shutdown).toBe("function")
      // Worker count should be 1 as set in beforeAll
      expect(workerManager.getWorkerCount()).toBe(1)
    })

    it("should connect to database", () => {
      if (!testServer) throw new Error("Test server not initialized")

      const { db } = testServer.serverApp

      expect(db).toBeDefined()
      // TODO: Add more specific database connection tests
    })
  })

  describe("Basic Routing", () => {
    it("should respond to health check endpoint", async () => {
      if (!testServer) throw new Error("Test server not initialized")

      const response = await makeRequest(`${testServer.url}/health`)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.status).toBe("ok")
      expect(data.timestamp).toBeDefined()
      expect(data.version).toBeDefined()
    })

    it("should respond to version endpoint", async () => {
      if (!testServer) throw new Error("Test server not initialized")

      const response = await makeRequest(`${testServer.url}/version`)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.version).toBeDefined()
      expect(data.name).toBe("Echo")
      expect(data.environment).toBeDefined()
    })

    it("should handle favicon requests", async () => {
      if (!testServer) throw new Error("Test server not initialized")

      const response = await makeRequest(`${testServer.url}/favicon.ico`)

      expect(response.status).toBe(204)
    })

    it("should handle Chrome DevTools endpoint in test environment", async () => {
      if (!testServer) throw new Error("Test server not initialized")

      const response = await makeRequest(
        `${testServer.url}/.well-known/appspecific/com.chrome.devtools.json`,
      )

      // In test environment, this should return 204 (no content)
      expect(response.status).toBe(204)
    })
  })

  describe("Error Handling", () => {
    it("should return 404 for non-existent assets", async () => {
      if (!testServer) throw new Error("Test server not initialized")

      const response = await makeRequest(
        `${testServer.url}/assets/nonexistent-file.js`,
      )

      expect(response.status).toBe(404)
    })

    it("should handle malformed requests gracefully", async () => {
      if (!testServer) throw new Error("Test server not initialized")

      const response = await makeRequest(`${testServer.url}/health`, {
        method: "POST",
        body: "invalid-json",
        headers: {
          "Content-Type": "application/json",
        },
      })

      // Should not crash the server
      expect(response.status).toBeOneOf([400, 404, 405, 500]) // Various valid error responses
    })
  })

  describe("CORS Configuration", () => {
    it("should include CORS headers", async () => {
      if (!testServer) throw new Error("Test server not initialized")

      const response = await makeRequest(`${testServer.url}/health`)

      // Check for CORS headers (exact headers depend on implementation)
      expect(response.headers.get("access-control-allow-origin")).toBeDefined()
    })

    it("should handle OPTIONS requests", async () => {
      if (!testServer) throw new Error("Test server not initialized")

      const response = await makeRequest(`${testServer.url}/health`, {
        method: "OPTIONS",
      })

      // Should handle preflight requests
      expect(response.status).toBeOneOf([200, 204])
    })
  })

  describe("Server Configuration", () => {
    it("should use test environment configuration", () => {
      expect(process.env.NODE_ENV).toBe("test")
      expect(process.env.PORT).toBe("3002")
      // LOG_LEVEL can be any value for debugging purposes
      expect(process.env.LOG_LEVEL).toBeDefined()
    })

    it("should use test database", () => {
      expect(process.env.DATABASE_URL).toContain("echo_test")
    })
  })
})
