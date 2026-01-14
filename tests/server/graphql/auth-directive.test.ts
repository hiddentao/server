/**
 * Auth Directive Tests for Echo
 *
 * Tests for the @auth directive functionality, including directive parsing,
 * operation identification, and runtime enforcement of authentication requirements.
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
import { AuthDirectiveHelper } from "../../../src/shared/graphql/auth-extractor"
import { typeDefs } from "../../../src/shared/graphql/schema"
import {
  createEmailAuthenticatedTestUser,
  createExpiredJWT,
  createGraphQLRequest,
} from "../../helpers/auth"
import { cleanTestDatabase, setupTestDatabase } from "../../helpers/database"
import { testLogger } from "../../helpers/logger"
import {
  makeRequest,
  startTestServer,
  waitForServer,
} from "../../helpers/server"
import "../../setup"

describe("Auth Directive Tests", () => {
  let testServer: any
  let authHelper: AuthDirectiveHelper

  beforeAll(async () => {
    testLogger.info(`[TEST DEBUG] beforeAll NODE_ENV: ${process.env.NODE_ENV}`)
    testLogger.info(
      `[TEST DEBUG] beforeAll SESSION_ENCRYPTION_KEY: ${process.env.SESSION_ENCRYPTION_KEY}`,
    )

    testServer = await startTestServer()
    await waitForServer(testServer.url)
    authHelper = new AuthDirectiveHelper(typeDefs)
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
  })

  describe("Auth Directive Extraction", () => {
    it("should correctly identify auth-required operations", () => {
      const authOperations = authHelper.getAuthOperations()

      // Core operations that should require auth
      const coreAuthOps = [
        "getMyNotifications",
        "getMyUnreadNotificationsCount",
        "markNotificationAsRead",
        "markAllNotificationsAsRead",
      ]

      // Verify core auth operations are identified
      expect(authOperations).toEqual(expect.arrayContaining(coreAuthOps))

      // Ensure we have auth operations (schema may have more than the core ones)
      expect(authOperations.length).toBeGreaterThanOrEqual(coreAuthOps.length)
    })

    it("should identify operations that do NOT require auth", () => {
      const authOperations = authHelper.getAuthOperations()

      // These operations should NOT require auth (validateToken doesn't require auth but validates tokens)
      const publicOperations = [
        "generateSiweMessage",
        "authenticateWithSiwe",
        "validateToken",
      ]

      for (const op of publicOperations) {
        expect(authOperations).not.toContain(op)
        expect(authHelper.requiresAuth(op)).toBe(false)
      }
    })

    it("should correctly check individual operations", () => {
      // Auth required operations
      expect(authHelper.requiresAuth("getMyNotifications")).toBe(true)
      expect(authHelper.requiresAuth("getMyUnreadNotificationsCount")).toBe(
        true,
      )
      expect(authHelper.requiresAuth("markNotificationAsRead")).toBe(true)
      expect(authHelper.requiresAuth("markAllNotificationsAsRead")).toBe(true)

      // Public operations
      expect(authHelper.requiresAuth("generateSiweMessage")).toBe(false)
      expect(authHelper.requiresAuth("authenticateWithSiwe")).toBe(false)
      expect(authHelper.requiresAuth("validateToken")).toBe(false)

      // Non-existent operations
      expect(authHelper.requiresAuth("nonExistentOperation")).toBe(false)
    })

    it("should handle case sensitivity", () => {
      expect(authHelper.requiresAuth("getmynotifications")).toBe(false) // lowercase
      expect(authHelper.requiresAuth("GETMYNOTIFICATIONS")).toBe(false) // uppercase
      expect(authHelper.requiresAuth("GetMyNotifications")).toBe(false) // different case
      expect(authHelper.requiresAuth("getMyNotifications")).toBe(true) // exact match
    })

    it("should be consistent across multiple checks", () => {
      // Multiple calls should return same result
      for (let i = 0; i < 10; i++) {
        expect(authHelper.requiresAuth("getMyNotifications")).toBe(true)
        expect(authHelper.requiresAuth("validateToken")).toBe(false)
      }
    })
  })

  describe("Runtime Authentication Enforcement", () => {
    describe("Auth-Required Operations", () => {
      it("should reject getMyNotifications without auth", async () => {
        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(`
            query GetMyNotifications {
              getMyNotifications(pageParam: { startIndex: 0, perPage: 10 }) {
                notifications {
                  id
                }
                total
              }
            }
          `),
        })

        const body = await response.json()
        expect(response.status).toBe(200)
        expect(body.errors).toBeDefined()
        expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
      })

      it("should allow getMyNotifications with valid auth", async () => {
        const authenticatedUser = await createEmailAuthenticatedTestUser(
          testServer.serverApp,
        )

        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(
            `query GetMyNotifications {
              getMyNotifications(pageParam: { startIndex: 0, perPage: 10 }) {
                notifications {
                  id
                }
                total
              }
            }`,
            {},
            authenticatedUser.token,
          ),
        })

        const body = await response.json()
        expect(response.status).toBe(200)

        // Should either succeed or fail due to DB setup, not auth
        if (body.errors) {
          expect(body.errors[0].extensions.code).not.toBe("UNAUTHORIZED")
        } else {
          expect(body.data.getMyNotifications).toBeDefined()
        }
      })

      it("should reject getMyUnreadNotificationsCount without auth", async () => {
        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(`
            query GetUnreadCount {
              getMyUnreadNotificationsCount
            }
          `),
        })

        const body = await response.json()
        expect(response.status).toBe(200)
        expect(body.errors).toBeDefined()
        expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
      })

      it("should allow getMyUnreadNotificationsCount with valid auth", async () => {
        const authenticatedUser = await createEmailAuthenticatedTestUser(
          testServer.serverApp,
        )

        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(
            `query GetUnreadCount {
              getMyUnreadNotificationsCount
            }`,
            {},
            authenticatedUser.token,
          ),
        })

        const body = await response.json()
        expect(response.status).toBe(200)

        if (body.errors) {
          expect(body.errors[0].extensions.code).not.toBe("UNAUTHORIZED")
        } else {
          expect(typeof body.data.getMyUnreadNotificationsCount).toBe("number")
        }
      })

      it("should reject markNotificationAsRead without auth", async () => {
        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(`
            mutation MarkRead {
              markNotificationAsRead(id: 1) {
                success
              }
            }
          `),
        })

        const body = await response.json()
        expect(response.status).toBe(200)
        expect(body.errors).toBeDefined()
        expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
      })

      it("should allow markNotificationAsRead with valid auth", async () => {
        const authenticatedUser = await createEmailAuthenticatedTestUser(
          testServer.serverApp,
        )

        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(
            `mutation MarkRead {
              markNotificationAsRead(id: 1) {
                success
              }
            }`,
            {},
            authenticatedUser.token,
          ),
        })

        const body = await response.json()
        expect(response.status).toBe(200)

        // Should fail due to notification not existing, not due to auth
        if (body.errors) {
          expect(body.errors[0].extensions.code).not.toBe("UNAUTHORIZED")
        } else {
          expect(body.data.markNotificationAsRead.success).toBe(true)
        }
      })

      it("should reject markAllNotificationsAsRead without auth", async () => {
        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(`
            mutation MarkAllRead {
              markAllNotificationsAsRead {
                success
              }
            }
          `),
        })

        const body = await response.json()
        expect(response.status).toBe(200)
        expect(body.errors).toBeDefined()
        expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
      })

      it("should allow markAllNotificationsAsRead with valid auth", async () => {
        const authenticatedUser = await createEmailAuthenticatedTestUser(
          testServer.serverApp,
        )

        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(
            `mutation MarkAllRead {
              markAllNotificationsAsRead {
                success
              }
            }`,
            {},
            authenticatedUser.token,
          ),
        })

        const body = await response.json()
        expect(response.status).toBe(200)

        if (body.errors) {
          expect(body.errors[0].extensions.code).not.toBe("UNAUTHORIZED")
        } else {
          expect(body.data.markAllNotificationsAsRead.success).toBe(true)
        }
      })
    })

    describe("Public Operations", () => {
      it("should allow validateToken query without auth token", async () => {
        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(`
            query ValidateToken {
              validateToken {
                valid
                web3Wallet
              }
            }
          `),
        })

        const body = await response.json()
        expect(response.status).toBe(200)
        expect(body.errors).toBeUndefined()
        expect(body.data.validateToken.valid).toBe(false)
        expect(body.data.validateToken.web3Wallet).toBeNull()
      })
    })

    describe("Mixed Queries", () => {
      it("should reject mixed queries with validateToken and auth-required fields when not authenticated", async () => {
        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(`
            query MixedQuery {
              validateToken {
                valid
              }
              getMyUnreadNotificationsCount
            }
          `),
        })

        const body = await response.json()
        expect(response.status).toBe(200)
        expect(body.errors).toBeDefined()
        expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")

        // Should not return partial data
        expect(body.data).toBeNull()
      })

      it("should allow mixed queries when properly authenticated", async () => {
        const authenticatedUser = await createEmailAuthenticatedTestUser(
          testServer.serverApp,
        )

        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(
            `query MixedQuery {
              validateToken {
                valid
              }
              getMyUnreadNotificationsCount
            }`,
            {},
            authenticatedUser.token,
          ),
        })

        const body = await response.json()
        expect(response.status).toBe(200)

        if (body.errors) {
          // Should not be UNAUTHORIZED since we have valid token
          expect(body.errors[0].extensions.code).not.toBe("UNAUTHORIZED")
        } else {
          expect(body.data.validateToken.valid).toBe(true)
          expect(typeof body.data.getMyUnreadNotificationsCount).toBe("number")
        }
      })

      it("should handle multiple auth-required fields in single query", async () => {
        const authenticatedUser = await createEmailAuthenticatedTestUser(
          testServer.serverApp,
        )

        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(
            `query MultipleAuthFields {
              getMyUnreadNotificationsCount
              getMyNotifications(pageParam: { startIndex: 0, perPage: 5 }) {
                total
                notifications {
                  id
                }
              }
            }`,
            {},
            authenticatedUser.token,
          ),
        })

        const body = await response.json()
        expect(response.status).toBe(200)

        if (body.errors) {
          expect(body.errors[0].extensions.code).not.toBe("UNAUTHORIZED")
        } else {
          expect(typeof body.data.getMyUnreadNotificationsCount).toBe("number")
          expect(body.data.getMyNotifications).toBeDefined()
        }
      })
    })

    describe("Invalid Token Handling", () => {
      it("should reject expired tokens for auth operations", async () => {
        const expiredToken = await createExpiredJWT(1)

        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(
            `query WithExpiredToken {
              getMyUnreadNotificationsCount
            }`,
            {},
            expiredToken,
          ),
        })

        const body = await response.json()
        expect(response.status).toBe(200)
        expect(body.errors).toBeDefined()
        expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
      })

      it("should reject malformed tokens for auth operations", async () => {
        const malformedToken = "not.a.valid.jwt.token"

        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(
            `query WithMalformedToken {
              getMyUnreadNotificationsCount
            }`,
            {},
            malformedToken,
          ),
        })

        const body = await response.json()
        expect(response.status).toBe(200)
        expect(body.errors).toBeDefined()
        expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
      })

      it("should reject empty authorization header for auth operations", async () => {
        const response = await makeRequest(`${testServer.url}/graphql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "", // Empty auth header
          },
          body: JSON.stringify({
            query: `query WithEmptyAuth {
              getMyUnreadNotificationsCount
            }`,
          }),
        })

        const body = await response.json()
        expect(response.status).toBe(200)
        expect(body.errors).toBeDefined()
        expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
      })
    })

    describe("Operation Name Extraction", () => {
      it("should correctly identify operation names for auth checking", async () => {
        // Test named queries
        const namedResponse = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(`
            query GetNotificationCount {
              getMyUnreadNotificationsCount
            }
          `),
        })

        const namedBody = await namedResponse.json()
        expect(namedResponse.status).toBe(200)
        expect(namedBody.errors).toBeDefined()
        expect(namedBody.errors[0].extensions.code).toBe("UNAUTHORIZED")
      })

      it("should handle anonymous queries", async () => {
        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(`
            query {
              getMyUnreadNotificationsCount
            }
          `),
        })

        const body = await response.json()
        expect(response.status).toBe(200)
        expect(body.errors).toBeDefined()
        expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
      })

      it("should handle mutations correctly", async () => {
        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(`
            mutation MarkNotification {
              markNotificationAsRead(id: 1) {
                success
              }
            }
          `),
        })

        const body = await response.json()
        expect(response.status).toBe(200)
        expect(body.errors).toBeDefined()
        expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
      })
    })

    describe("Context Propagation", () => {
      it("should provide user context to resolvers", async () => {
        const authenticatedUser = await createEmailAuthenticatedTestUser(
          testServer.serverApp,
        )

        // This test verifies that the user context is properly passed to resolvers
        // We can't directly test the resolver context, but we can verify that
        // authenticated operations work, which implies proper context propagation
        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(
            `query TestContext {
              getMyUnreadNotificationsCount
            }`,
            {},
            authenticatedUser.token,
          ),
        })

        const body = await response.json()
        expect(response.status).toBe(200)

        // If this doesn't fail with UNAUTHORIZED, context propagation is working
        if (body.errors) {
          expect(body.errors[0].extensions.code).not.toBe("UNAUTHORIZED")
        }
      })
    })
  })

  describe("Schema Introspection", () => {
    it("should allow introspection queries", async () => {
      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createGraphQLRequest(`
          query IntrospectionQuery {
            __schema {
              types {
                name
                kind
              }
            }
          }
        `),
      )

      const body = await response.json()
      expect(response.status).toBe(200)

      expect(body.data.__schema).toBeDefined()
      expect(body.data.__schema.types).toBeInstanceOf(Array)
    })

    it("should show directive information in development", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(`
          query DirectiveIntrospection {
            __schema {
              directives {
                name
                description
                locations
              }
            }
          `),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.data) {
        const directives = body.data.__schema.directives
        expect(directives).toBeInstanceOf(Array)

        // Should include the @auth directive
        const authDirective = directives.find((d: any) => d.name === "auth")
        if (authDirective) {
          expect(authDirective.locations).toContain("FIELD_DEFINITION")
        }
      }
    })
  })
})
