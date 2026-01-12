/**
 * WebSocket Connection Limits Integration Tests
 *
 * Tests the WebSocket connection limit enforcement:
 * - Total connection limit (SOCKET_MAX_TOTAL_CONNECTIONS)
 * - Per-user connection limit (SOCKET_MAX_CONNECTIONS_PER_USER)
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { serverConfig } from "../../../src/shared/config/server"
import {
  WebSocketErrorCode,
  WebSocketMessageType,
} from "../../../src/shared/websocket/types"
import { createAuthenticatedTestUser } from "../../helpers/auth"
import {
  cleanTestDatabase,
  closeTestDb,
  setupTestDatabase,
} from "../../helpers/database"
import { testLogger } from "../../helpers/logger"
import type { TestServer } from "../../helpers/server"
import { startTestServer, waitForServer } from "../../helpers/server"
import {
  createTestWebSocketClient,
  disconnectAllClients,
  type TestWebSocketClient,
  waitForErrorCode,
} from "../../helpers/websocket"
import "../../setup"

describe("WebSocket Connection Limits", () => {
  let testServer: TestServer | null = null
  let clients: TestWebSocketClient[] = []

  // Helper to clean up clients after each test
  const cleanupClients = () => {
    disconnectAllClients(clients)
    clients = []
  }

  beforeAll(async () => {
    await setupTestDatabase()
    testServer = await startTestServer({ workerCountOverride: 0 })
    await waitForServer(testServer.url)

    testLogger.info(
      `Test config: MAX_CONNECTIONS_PER_USER=${serverConfig.SOCKET_MAX_CONNECTIONS_PER_USER}, MAX_TOTAL=${serverConfig.SOCKET_MAX_TOTAL_CONNECTIONS}`,
    )
  })

  afterAll(async () => {
    cleanupClients()

    if (testServer) {
      await testServer.shutdown()
    }

    await cleanTestDatabase()
    await closeTestDb()
  })

  describe("Basic WebSocket Connection", () => {
    it("should connect and receive connected message", async () => {
      if (!testServer) throw new Error("Test server not initialized")

      const client = await createTestWebSocketClient(testServer.url, {
        autoRegister: false,
      })
      clients.push(client)

      // Should receive connected message immediately
      const connectedMsg = await client.waitForMessage(
        WebSocketMessageType.Connected,
      )
      expect(connectedMsg.type).toBe(WebSocketMessageType.Connected)
      expect((connectedMsg.data as any).message).toContain("established")
    })

    it("should register successfully with valid JWT", async () => {
      if (!testServer) throw new Error("Test server not initialized")

      const authUser = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      const client = await createTestWebSocketClient(testServer.url, {
        autoRegister: true,
        jwtToken: authUser.token,
      })
      clients.push(client)

      // Wait for both connected and registered messages
      await client.waitForMessage(WebSocketMessageType.Connected)
      const registeredMsg = await client.waitForMessage(
        WebSocketMessageType.Registered,
      )

      expect(registeredMsg.type).toBe(WebSocketMessageType.Registered)
      expect((registeredMsg.data as any).userId).toBeDefined()
    })
  })

  describe("Per-User Connection Limits", () => {
    it("should enforce per-user connection limit", async () => {
      if (!testServer) throw new Error("Test server not initialized")

      const maxPerUser = serverConfig.SOCKET_MAX_CONNECTIONS_PER_USER

      // Create authenticated user
      const authUser = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      // Create connections up to the limit
      const userClients: TestWebSocketClient[] = []
      for (let i = 0; i < maxPerUser; i++) {
        const client = await createTestWebSocketClient(testServer.url, {
          autoRegister: true,
          jwtToken: authUser.token,
        })
        userClients.push(client)
        clients.push(client)

        // Wait for registration to complete
        await client.waitForMessage(WebSocketMessageType.Connected)
        await client.waitForMessage(WebSocketMessageType.Registered)
      }

      // Try to create one more connection - should be rejected
      const extraClient = await createTestWebSocketClient(testServer.url, {
        autoRegister: true,
        jwtToken: authUser.token,
      })
      clients.push(extraClient)

      // Wait for connection
      await extraClient.waitForMessage(WebSocketMessageType.Connected)

      // Should receive per-user limit error
      const hasError = await waitForErrorCode(
        extraClient,
        WebSocketErrorCode.CONNECTION_LIMIT_PER_USER_EXCEEDED,
        3000,
      )
      expect(hasError).toBe(true)

      // Clean up user clients
      disconnectAllClients(userClients)
    })

    it("should allow different users to each have max connections", async () => {
      if (!testServer) throw new Error("Test server not initialized")

      const maxPerUser = serverConfig.SOCKET_MAX_CONNECTIONS_PER_USER

      // Create two different users
      const user1 = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })
      const user2 = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      // Create max connections for each user
      const user1Clients: TestWebSocketClient[] = []
      const user2Clients: TestWebSocketClient[] = []

      for (let i = 0; i < maxPerUser; i++) {
        const client1 = await createTestWebSocketClient(testServer.url, {
          autoRegister: true,
          jwtToken: user1.token,
        })
        user1Clients.push(client1)
        clients.push(client1)

        const client2 = await createTestWebSocketClient(testServer.url, {
          autoRegister: true,
          jwtToken: user2.token,
        })
        user2Clients.push(client2)
        clients.push(client2)
      }

      // All should be connected successfully
      expect(user1Clients.length).toBe(maxPerUser)
      expect(user2Clients.length).toBe(maxPerUser)

      // Clean up
      disconnectAllClients(user1Clients)
      disconnectAllClients(user2Clients)
    })
  })

  describe("Total Connection Limits", () => {
    it("should track connected clients count", async () => {
      if (!testServer) throw new Error("Test server not initialized")

      // Clean up any leftover clients from previous tests
      cleanupClients()
      await new Promise((resolve) => setTimeout(resolve, 100))

      const { socketManager } = testServer.serverApp

      // Get initial count
      const initialCount = socketManager.getConnectedClientsCount!()

      // Create a new client
      const client = await createTestWebSocketClient(testServer.url, {
        autoRegister: true,
      })
      clients.push(client)

      await client.waitForMessage(WebSocketMessageType.Connected)

      // Wait a bit for registration to complete
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Count should increase by 1
      const newCount = socketManager.getConnectedClientsCount!()
      expect(newCount).toBe(initialCount + 1)

      // Disconnect
      client.disconnect()
      clients = [] // Remove from cleanup list since we disconnected manually

      // Wait for disconnect to be processed
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Count should decrease
      const finalCount = socketManager.getConnectedClientsCount!()
      expect(finalCount).toBe(initialCount)
    })

    it("should track connected users count", async () => {
      if (!testServer) throw new Error("Test server not initialized")

      // Clean up any leftover clients from previous tests
      cleanupClients()
      await new Promise((resolve) => setTimeout(resolve, 100))

      const { socketManager } = testServer.serverApp

      // Get initial count
      const initialCount = socketManager.getConnectedUsersCount!()

      // Create authenticated user
      const authUser = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      // Create a new client with auth
      const client = await createTestWebSocketClient(testServer.url, {
        autoRegister: true,
        jwtToken: authUser.token,
      })
      clients.push(client)

      await client.waitForMessage(WebSocketMessageType.Connected)
      await client.waitForMessage(WebSocketMessageType.Registered)

      // Wait a bit for registration to complete
      await new Promise((resolve) => setTimeout(resolve, 100))

      // User count should increase by 1
      const newCount = socketManager.getConnectedUsersCount!()
      expect(newCount).toBe(initialCount + 1)

      // Disconnect
      client.disconnect()
      clients = [] // Remove from cleanup list since we disconnected manually

      // Wait for disconnect to be processed
      await new Promise((resolve) => setTimeout(resolve, 100))

      // User count should decrease
      const finalCount = socketManager.getConnectedUsersCount!()
      expect(finalCount).toBe(initialCount)
    })
  })

  describe("Unauthenticated Connections", () => {
    it("should allow unauthenticated connections", async () => {
      if (!testServer) throw new Error("Test server not initialized")

      const client = await createTestWebSocketClient(testServer.url, {
        autoRegister: true,
        // No JWT token
      })
      clients.push(client)

      // Should receive connected message
      await client.waitForMessage(WebSocketMessageType.Connected)

      // Should not receive registered message (no auth)
      const registeredMsgs = client.getReceivedMessages(
        WebSocketMessageType.Registered,
      )
      expect(registeredMsgs.length).toBe(0)
    })
  })
})
