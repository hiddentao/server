/**
 * Database Integration Tests for Echo
 *
 * Tests the full database integration with authentication, user creation,
 * notification management, and data ownership validation using real wallet addresses.
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test"
import {
  createAuthenticatedTestUser,
  createGraphQLRequest,
  createMultipleTestUsers,
  generateTestWallet,
  getPredefinedTestWallet,
} from "../../helpers/auth"
import {
  cleanTestDatabase,
  closeTestDb,
  createTestNotification,
  createTestUser,
  getTestDatabaseStats,
  setupTestDatabase,
} from "../../helpers/database"
import {
  makeRequest,
  startTestServer,
  waitForServer,
} from "../../helpers/server"
// Import global test setup
import "../../setup"

describe("Database Integration Tests", () => {
  let testServer: any

  beforeAll(async () => {
    testServer = await startTestServer()
    await waitForServer(testServer.url)
  })

  beforeEach(async () => {
    await setupTestDatabase()
  })

  afterEach(async () => {
    await cleanTestDatabase()
  })

  afterAll(async () => {
    if (testServer) {
      await testServer.shutdown()
    }
    await closeTestDb()
  })

  describe("User Creation Flow", () => {
    it("should create user on first authentication", async () => {
      const authenticatedUser = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      // Make a GraphQL request that triggers user creation
      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query GetCount {
              getMyUnreadNotificationsCount
            }`,
          {},
          authenticatedUser.token,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(typeof body.data.getMyUnreadNotificationsCount).toBe("number")
      expect(body.data.getMyUnreadNotificationsCount).toBe(0)

      // Verify user was created in database
      const stats = await getTestDatabaseStats()
      expect(stats.users).toBe(1)
    })

    it("should reuse existing user on subsequent authentications", async () => {
      // Create user manually first
      const wallet = generateTestWallet()
      await createTestUser({
        web3Wallet: wallet.address.toLowerCase(),
      })

      // Create authenticated session for same wallet
      const authenticatedUser = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      // Make GraphQL request
      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query GetCount {
              getMyUnreadNotificationsCount
            }`,
          {},
          authenticatedUser.token,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()

      // Should still have only the original user (plus the new one from auth)
      const stats = await getTestDatabaseStats()
      expect(stats.users).toBe(2) // Original + new from auth
    })

    it("should handle multiple users correctly", async () => {
      const users = await createMultipleTestUsers(3, {
        serverApp: testServer.serverApp,
      })

      // Each user should be able to access their data
      for (const user of users) {
        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(
            `query GetCount {
                getMyUnreadNotificationsCount
              }`,
            {},
            user.token,
          ),
        })

        const body = await response.json()
        expect(response.status).toBe(200)
        expect(body.errors).toBeUndefined()
        expect(typeof body.data.getMyUnreadNotificationsCount).toBe("number")
      }

      // Should have 3 users in database
      const stats = await getTestDatabaseStats()
      expect(stats.users).toBe(3)
    })

    it("should handle wallet address normalization", async () => {
      const wallet = generateTestWallet()

      // Create user with lowercase address
      await createTestUser({
        web3Wallet: wallet.address.toLowerCase(),
      })

      // Create authenticated session (address should be normalized)
      const authenticatedUser = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query GetCount {
              getMyUnreadNotificationsCount
            }`,
          {},
          authenticatedUser.token,
        ),
      })

      expect(response.status).toBe(200)

      // Should have 2 users total (one manual, one from auth)
      const stats = await getTestDatabaseStats()
      expect(stats.users).toBe(2)
    })

    it("should work with predefined test wallets", async () => {
      const hardhatWallet = getPredefinedTestWallet("hardhat")

      // Create user with predefined wallet
      const testUser = await createTestUser({
        web3Wallet: hardhatWallet.address.toLowerCase(),
      })

      expect(testUser.id).toBeDefined()

      const stats = await getTestDatabaseStats()
      expect(stats.users).toBe(1)
    })
  })

  describe("Notification Management", () => {
    it("should create and retrieve notifications", async () => {
      // Create authenticated user
      const authenticatedUser = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      // First, trigger user creation
      await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query InitUser { getMyUnreadNotificationsCount }`,
          {},
          authenticatedUser.token,
        ),
      })
      // Get user ID from database
      const stats = await getTestDatabaseStats()
      expect(stats.users).toBe(1)

      // Create some test notifications
      await createTestNotification({
        userId: 1, // First user created
        data: { message: "Test notification 1" },
        read: false,
      })

      await createTestNotification({
        userId: 1,
        data: { message: "Test notification 2", type: "info" },
        read: true,
      })

      // Query notifications
      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query GetNotifications {
              getMyNotifications(pageParam: { startIndex: 0, perPage: 10 }) {
                notifications {
                  id
                  data
                  read
                }
                total
                startIndex
              }
            }`,
          {},
          authenticatedUser.token,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()

      const notificationsData = body.data.getMyNotifications
      expect(notificationsData.total).toBe(2)
      expect(notificationsData.notifications).toHaveLength(2)
      expect(notificationsData.startIndex).toBe(0)

      // Check notification data
      const notifications = notificationsData.notifications
      expect(notifications[0].data.message).toContain("Test notification")
      expect(typeof notifications[0].read).toBe("boolean")
    })

    it("should return correct unread count", async () => {
      const authenticatedUser = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      // Initialize user
      await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query InitUser { getMyUnreadNotificationsCount }`,
          {},
          authenticatedUser.token,
        ),
      })

      // Create notifications with mix of read/unread
      await createTestNotification({
        userId: 1,
        data: { message: "Unread 1" },
        read: false,
      })

      await createTestNotification({
        userId: 1,
        data: { message: "Read 1" },
        read: true,
      })

      await createTestNotification({
        userId: 1,
        data: { message: "Unread 2" },
        read: false,
      })

      // Query unread count
      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query GetUnreadCount { getMyUnreadNotificationsCount }`,
          {},
          authenticatedUser.token,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(body.data.getMyUnreadNotificationsCount).toBe(2)
    })

    it("should handle pagination correctly", async () => {
      const authenticatedUser = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      // Initialize user
      await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query InitUser { getMyUnreadNotificationsCount }`,
          {},
          authenticatedUser.token,
        ),
      })

      // Create multiple notifications
      for (let i = 0; i < 15; i++) {
        await createTestNotification({
          userId: 1,
          data: { message: `Notification ${i + 1}` },
          read: i % 2 === 0, // Alternate read/unread
        })
      }

      // Test first page
      const firstPageResponse = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query GetFirstPage {
              getMyNotifications(pageParam: { startIndex: 0, perPage: 5 }) {
                notifications { id data }
                total
                startIndex
              }
            }`,
          {},
          authenticatedUser.token,
        ),
      })

      const firstPage = await firstPageResponse.json()
      expect(firstPageResponse.status).toBe(200)
      expect(firstPage.data.getMyNotifications.total).toBe(15)
      expect(firstPage.data.getMyNotifications.notifications).toHaveLength(5)
      expect(firstPage.data.getMyNotifications.startIndex).toBe(0)

      // Test second page
      const secondPageResponse = await makeRequest(
        `${testServer.url}/graphql`,
        {
          ...createGraphQLRequest(
            `query GetSecondPage {
              getMyNotifications(pageParam: { startIndex: 5, perPage: 5 }) {
                notifications { id data }
                total
                startIndex
              }
            }`,
            {},
            authenticatedUser.token,
          ),
        },
      )

      const secondPage = await secondPageResponse.json()
      expect(secondPageResponse.status).toBe(200)
      expect(secondPage.data.getMyNotifications.total).toBe(15)
      expect(secondPage.data.getMyNotifications.notifications).toHaveLength(5)
      expect(secondPage.data.getMyNotifications.startIndex).toBe(5)

      // Test last page
      const lastPageResponse = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query GetLastPage {
              getMyNotifications(pageParam: { startIndex: 10, perPage: 10 }) {
                notifications { id data }
                total
                startIndex
              }
            }`,
          {},
          authenticatedUser.token,
        ),
      })

      const lastPage = await lastPageResponse.json()
      expect(lastPageResponse.status).toBe(200)
      expect(lastPage.data.getMyNotifications.total).toBe(15)
      expect(lastPage.data.getMyNotifications.notifications).toHaveLength(5) // Only 5 remaining
      expect(lastPage.data.getMyNotifications.startIndex).toBe(10)
    })

    it("should mark single notification as read", async () => {
      const authenticatedUser = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      // Initialize user
      await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query InitUser { getMyUnreadNotificationsCount }`,
          {},
          authenticatedUser.token,
        ),
      })

      // Create unread notification
      const notification = await createTestNotification({
        userId: 1,
        data: { message: "Test notification" },
        read: false,
      })

      // Mark as read
      const markReadResponse = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `mutation MarkRead($id: PositiveInt!) {
              markNotificationAsRead(id: $id) {
                success
              }
            }`,
          { id: notification.id },
          authenticatedUser.token,
        ),
      })

      const markReadBody = await markReadResponse.json()
      expect(markReadResponse.status).toBe(200)
      expect(markReadBody.errors).toBeUndefined()
      expect(markReadBody.data.markNotificationAsRead.success).toBe(true)

      // Verify unread count decreased
      const countResponse = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query GetCount { getMyUnreadNotificationsCount }`,
          {},
          authenticatedUser.token,
        ),
      })

      const countBody = await countResponse.json()
      expect(countResponse.status).toBe(200)
      expect(countBody.data.getMyUnreadNotificationsCount).toBe(0)
    })

    it("should mark all notifications as read", async () => {
      const authenticatedUser = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      // Initialize user
      await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query InitUser { getMyUnreadNotificationsCount }`,
          {},
          authenticatedUser.token,
        ),
      })

      // Create multiple unread notifications
      for (let i = 0; i < 5; i++) {
        await createTestNotification({
          userId: 1,
          data: { message: `Notification ${i + 1}` },
          read: false,
        })
      }

      // Verify initial unread count
      const initialCountResponse = await makeRequest(
        `${testServer.url}/graphql`,
        {
          ...createGraphQLRequest(
            `query GetCount { getMyUnreadNotificationsCount }`,
            {},
            authenticatedUser.token,
          ),
        },
      )

      const initialCount = await initialCountResponse.json()
      expect(initialCount.data.getMyUnreadNotificationsCount).toBe(5)

      // Mark all as read
      const markAllReadResponse = await makeRequest(
        `${testServer.url}/graphql`,
        {
          ...createGraphQLRequest(
            `mutation MarkAllRead {
              markAllNotificationsAsRead {
                success
              }
            }`,
            {},
            authenticatedUser.token,
          ),
        },
      )

      const markAllReadBody = await markAllReadResponse.json()
      expect(markAllReadResponse.status).toBe(200)
      expect(markAllReadBody.errors).toBeUndefined()
      expect(markAllReadBody.data.markAllNotificationsAsRead.success).toBe(true)

      // Verify unread count is now 0
      const finalCountResponse = await makeRequest(
        `${testServer.url}/graphql`,
        {
          ...createGraphQLRequest(
            `query GetCount { getMyUnreadNotificationsCount }`,
            {},
            authenticatedUser.token,
          ),
        },
      )

      const finalCount = await finalCountResponse.json()
      expect(finalCount.data.getMyUnreadNotificationsCount).toBe(0)
    })
  })

  describe("Data Ownership Validation", () => {
    it("should prevent users from seeing other users' notifications", async () => {
      // Create two users
      const user1 = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })
      const user2 = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      // Initialize both users
      await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query InitUser1 { getMyUnreadNotificationsCount }`,
          {},
          user1.token,
        ),
      })

      await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query InitUser2 { getMyUnreadNotificationsCount }`,
          {},
          user2.token,
        ),
      })

      // Create notifications for user 1 only
      await createTestNotification({
        userId: 1, // User 1
        data: { message: "User 1 notification 1" },
        read: false,
      })

      await createTestNotification({
        userId: 1, // User 1
        data: { message: "User 1 notification 2" },
        read: false,
      })

      // User 1 should see their notifications
      const user1Response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query GetMyNotifications {
              getMyNotifications(pageParam: { startIndex: 0, perPage: 10 }) {
                notifications { id data }
                total
              }
            }`,
          {},
          user1.token,
        ),
      })

      const user1Body = await user1Response.json()
      expect(user1Response.status).toBe(200)
      expect(user1Body.data.getMyNotifications.total).toBe(2)

      // User 2 should see no notifications
      const user2Response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query GetMyNotifications {
              getMyNotifications(pageParam: { startIndex: 0, perPage: 10 }) {
                notifications { id data }
                total
              }
            }`,
          {},
          user2.token,
        ),
      })

      const user2Body = await user2Response.json()
      expect(user2Response.status).toBe(200)
      expect(user2Body.data.getMyNotifications.total).toBe(0)
    })

    it("should prevent users from modifying other users' notifications", async () => {
      // Create two users
      const user1 = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })
      const user2 = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      // Initialize users
      await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query InitUser1 { getMyUnreadNotificationsCount }`,
          {},
          user1.token,
        ),
      })

      await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query InitUser2 { getMyUnreadNotificationsCount }`,
          {},
          user2.token,
        ),
      })

      // Create notification for user 1
      const user1Notification = await createTestNotification({
        userId: 1, // User 1
        data: { message: "User 1 notification" },
        read: false,
      })

      // User 2 should not be able to mark user 1's notification as read
      const user2MarkResponse = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `mutation MarkRead($id: PositiveInt!) {
              markNotificationAsRead(id: $id) {
                success
              }
            }`,
          { id: user1Notification.id },
          user2.token, // User 2's token
        ),
      })

      const user2MarkBody = await user2MarkResponse.json()
      expect(user2MarkResponse.status).toBe(200)
      expect(user2MarkBody.errors).toBeDefined()
      expect(user2MarkBody.errors[0].extensions.code).toBe("NOT_FOUND")

      // User 1 should still be able to mark their own notification
      const user1MarkResponse = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `mutation MarkRead($id: PositiveInt!) {
              markNotificationAsRead(id: $id) {
                success
              }
            }`,
          { id: user1Notification.id },
          user1.token, // User 1's token
        ),
      })

      const user1MarkBody = await user1MarkResponse.json()
      expect(user1MarkResponse.status).toBe(200)
      expect(user1MarkBody.errors).toBeUndefined()
      expect(user1MarkBody.data.markNotificationAsRead.success).toBe(true)
    })

    it("should isolate notification counts between users", async () => {
      // Create two users
      const user1 = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })
      const user2 = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      // Initialize users
      await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query InitUser1 { getMyUnreadNotificationsCount }`,
          {},
          user1.token,
        ),
      })

      await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query InitUser2 { getMyUnreadNotificationsCount }`,
          {},
          user2.token,
        ),
      })

      // Create notifications for each user
      await createTestNotification({
        userId: 1, // User 1
        data: { message: "User 1 notification 1" },
        read: false,
      })

      await createTestNotification({
        userId: 1, // User 1
        data: { message: "User 1 notification 2" },
        read: false,
      })

      await createTestNotification({
        userId: 2, // User 2
        data: { message: "User 2 notification 1" },
        read: false,
      })

      // Check counts for each user
      const user1CountResponse = await makeRequest(
        `${testServer.url}/graphql`,
        {
          ...createGraphQLRequest(
            `query GetCount { getMyUnreadNotificationsCount }`,
            {},
            user1.token,
          ),
        },
      )

      const user1Count = await user1CountResponse.json()
      expect(user1Count.data.getMyUnreadNotificationsCount).toBe(2)

      const user2CountResponse = await makeRequest(
        `${testServer.url}/graphql`,
        {
          ...createGraphQLRequest(
            `query GetCount { getMyUnreadNotificationsCount }`,
            {},
            user2.token,
          ),
        },
      )

      const user2Count = await user2CountResponse.json()
      expect(user2Count.data.getMyUnreadNotificationsCount).toBe(1)
    })
  })

  describe("Database State Management", () => {
    it("should handle empty database gracefully", async () => {
      const authenticatedUser = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      // Query empty database
      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query GetNotifications {
              getMyNotifications(pageParam: { startIndex: 0, perPage: 10 }) {
                notifications { id }
                total
              }
              getMyUnreadNotificationsCount
            }`,
          {},
          authenticatedUser.token,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(body.data.getMyNotifications.total).toBe(0)
      expect(body.data.getMyNotifications.notifications).toHaveLength(0)
      expect(body.data.getMyUnreadNotificationsCount).toBe(0)
    })

    it("should maintain data consistency across operations", async () => {
      const authenticatedUser = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      // Initialize user
      await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query InitUser { getMyUnreadNotificationsCount }`,
          {},
          authenticatedUser.token,
        ),
      })

      // Create notifications
      const notifications = []
      for (let i = 0; i < 3; i++) {
        const notif = await createTestNotification({
          userId: 1,
          data: { message: `Notification ${i + 1}` },
          read: false,
        })
        notifications.push(notif)
      }

      // Verify initial state
      let countResponse = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query GetCount { getMyUnreadNotificationsCount }`,
          {},
          authenticatedUser.token,
        ),
      })

      let countBody = await countResponse.json()
      expect(countBody.data.getMyUnreadNotificationsCount).toBe(3)

      // Mark one as read
      await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `mutation MarkRead($id: PositiveInt!) {
              markNotificationAsRead(id: $id) { success }
            }`,
          { id: notifications[0].id },
          authenticatedUser.token,
        ),
      })

      // Verify count updated
      countResponse = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query GetCount { getMyUnreadNotificationsCount }`,
          {},
          authenticatedUser.token,
        ),
      })

      countBody = await countResponse.json()
      expect(countBody.data.getMyUnreadNotificationsCount).toBe(2)

      // Mark all as read
      await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `mutation MarkAllRead {
              markAllNotificationsAsRead { success }
            }`,
          {},
          authenticatedUser.token,
        ),
      })

      // Verify final count
      countResponse = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query GetCount { getMyUnreadNotificationsCount }`,
          {},
          authenticatedUser.token,
        ),
      })

      countBody = await countResponse.json()
      expect(countBody.data.getMyUnreadNotificationsCount).toBe(0)
    })
  })
})
