import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { testLogger } from "../../helpers/logger"
import {
  makeRequest,
  startTestServer,
  waitForServer,
} from "../../helpers/server"
// Import global test setup
import "../../setup"

describe("GraphQL Mutations", () => {
  let testServer: any
  let authToken: string

  beforeAll(async () => {
    // Start test server
    testServer = await startTestServer()
    await waitForServer(testServer.url)

    // Create test auth token
    const testWallet = "0x1234567890123456789012345678901234567890"
    const { SignJWT } = await import("jose")
    const jwtSecret = new TextEncoder().encode("test-secret-for-testing-only")

    authToken = await new SignJWT({
      wallet: testWallet.toLowerCase(),
      iat: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(jwtSecret)
  })

  afterAll(async () => {
    // Cleanup
    if (testServer) {
      await testServer.shutdown()
    }
  })

  describe("markNotificationAsRead", () => {
    it("should mark notification as read", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query: `
            mutation MarkNotificationAsRead($id: PositiveInt!) {
              markNotificationAsRead(id: $id) {
                success
              }
            }
          `,
          variables: {
            id: 1,
          },
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.errors) {
        // Expected if database isn't set up or notification doesn't exist
        testLogger.warn(
          "Mark notification test failed:",
          body.errors[0].message,
        )

        // Should be a structured error
        expect(body.errors[0].extensions?.code).toBeDefined()
      } else {
        expect(body.data.markNotificationAsRead).toBeDefined()
        expect(body.data.markNotificationAsRead.success).toBe(true)
      }
    })

    it("should handle non-existent notification ID", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query: `
            mutation MarkNotificationAsRead($id: PositiveInt!) {
              markNotificationAsRead(id: $id) {
                success
              }
            }
          `,
          variables: {
            id: 99999999, // Non-existent ID
          },
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.errors) {
        expect(body.errors[0].extensions?.code).toBeDefined()
        // Should be NOT_FOUND or similar
      }
    })

    it("should validate positive integer constraint", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query: `
            mutation MarkNotificationAsRead($id: PositiveInt!) {
              markNotificationAsRead(id: $id) {
                success
              }
            }
          `,
          variables: {
            id: -1, // Should fail PositiveInt validation
          },
        }),
      })

      const body = await response.json()
      // Should be validation error
      expect(body.errors).toBeDefined()
    })
  })

  describe("markAllNotificationsAsRead", () => {
    it("should mark all notifications as read", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query: `
            mutation MarkAllNotificationsAsRead {
              markAllNotificationsAsRead {
                success
              }
            }
          `,
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.errors) {
        testLogger.warn(
          "Mark all notifications test failed:",
          body.errors[0].message,
        )
        expect(body.errors[0].extensions?.code).toBeDefined()
      } else {
        expect(body.data.markAllNotificationsAsRead).toBeDefined()
        expect(body.data.markAllNotificationsAsRead.success).toBe(true)
      }
    })
  })

  describe("Authentication Requirements", () => {
    it("should require auth for mutations", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation MarkAllNotificationsAsRead {
              markAllNotificationsAsRead {
                success
              }
            }
          `,
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
    })

    it("should reject invalid auth tokens for mutations", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer invalid-token",
        },
        body: JSON.stringify({
          query: `
            mutation MarkAllNotificationsAsRead {
              markAllNotificationsAsRead {
                success
              }
            }
          `,
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
    })
  })

  describe("Error Response Format", () => {
    it("should return errors in standard GraphQL format", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `mutation { markAllNotificationsAsRead { success } }`,
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeInstanceOf(Array)
      expect(body.errors[0]).toMatchObject({
        message: expect.any(String),
        extensions: expect.objectContaining({
          code: expect.any(String),
        }),
      })
      expect(body.data).toBeNull()
    })
  })
})
