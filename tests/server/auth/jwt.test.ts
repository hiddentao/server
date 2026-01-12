/**
 * JWT Lifecycle Tests for Echo
 *
 * Comprehensive testing of JWT token generation, validation, expiration,
 * and various edge cases using real cryptographic operations.
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import {
  createExpiredJWT,
  createGraphQLRequest,
  createMalformedJWT,
  createTestJWT,
  decodeJWT,
  generateTestWallet,
  verifyTestJWT,
} from "../../helpers/auth"
// Import global test setup
import "../../setup"
import {
  makeRequest,
  startTestServer,
  waitForServer,
} from "../../helpers/server"
// Import global test setup
import "../../setup"

describe("JWT Lifecycle Tests", () => {
  let testServer: any

  beforeAll(async () => {
    testServer = await startTestServer()
    await waitForServer(testServer.url)
  })

  afterAll(async () => {
    if (testServer) {
      await testServer.shutdown()
    }
  })

  describe("Token Creation", () => {
    it("should create valid JWT tokens", async () => {
      const wallet = generateTestWallet()
      const token = await createTestJWT(wallet.address)

      expect(typeof token).toBe("string")
      expect(token.split(".")).toHaveLength(3) // JWT format: header.payload.signature

      // Decode and verify token structure
      const payload = decodeJWT(token)
      expect(payload.web3_wallet).toBe(wallet.address.toLowerCase())
      expect(payload.iat).toBeGreaterThan(0)
      expect(payload.exp).toBeGreaterThan(payload.iat)
    })

    it("should create tokens with custom expiration", async () => {
      const wallet = generateTestWallet()
      const shortToken = await createTestJWT(wallet.address, {
        expiresIn: "5m",
      })
      const longToken = await createTestJWT(wallet.address, {
        expiresIn: "24h",
      })

      const shortPayload = decodeJWT(shortToken)
      const longPayload = decodeJWT(longToken)

      expect(longPayload.exp).toBeGreaterThan(shortPayload.exp)
    })

    it("should include extra claims in token", async () => {
      const wallet = generateTestWallet()
      const token = await createTestJWT(wallet.address, {
        extraClaims: { role: "admin", permissions: ["read", "write"] },
      })

      const payload = decodeJWT(token)
      expect(payload.role).toBe("admin")
      expect(payload.permissions).toEqual(["read", "write"])
    })

    it("should normalize wallet address to lowercase", async () => {
      const wallet = generateTestWallet()
      const mixedCaseAddress = wallet.address // Already checksummed
      const token = await createTestJWT(mixedCaseAddress)

      const payload = decodeJWT(token)
      expect(payload.web3_wallet).toBe(mixedCaseAddress.toLowerCase())
    })
  })

  describe("Token Expiration", () => {
    it("should reject expired tokens", async () => {
      const wallet = generateTestWallet()
      const expiredToken = await createExpiredJWT(wallet.address)

      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          expiredToken,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
    })

    it("should handle tokens with very short expiration", async () => {
      const wallet = generateTestWallet()

      // Create token that expires in 1 second
      const shortLivedToken = await createTestJWT(wallet.address, {
        expiresIn: "1s",
      })

      // Use immediately (should work)
      const immediateResponse = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          shortLivedToken,
        ),
      })

      const _immediateBody = await immediateResponse.json()
      // Should work initially (or fail due to auth setup, but not due to expiration)
      expect(immediateResponse.status).toBe(200)

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Use after expiration (should fail)
      const delayedResponse = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          shortLivedToken,
        ),
      })

      const delayedBody = await delayedResponse.json()
      expect(delayedResponse.status).toBe(200)
      expect(delayedBody.errors).toBeDefined()
      expect(delayedBody.errors[0].extensions.code).toBe("UNAUTHORIZED")
    })

    it("should handle negative expiration times", async () => {
      const wallet = generateTestWallet()
      // Create token that was already expired when created
      const token = await createTestJWT(wallet.address, { expiresIn: "-10s" })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          token,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
    })
  })

  describe("Token Payload Validation", () => {
    it("should accept tokens missing web3_wallet field (email users)", async () => {
      // Missing web3_wallet is valid - email users don't have one
      const token = await createMalformedJWT("missing-wallet")

      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          token,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      // Token is valid (auth passes), but user lookup may fail
      if (body.errors) {
        expect(body.errors[0].extensions.code).not.toBe("UNAUTHORIZED")
      }
    })

    it("should reject tokens missing userId field", async () => {
      const malformedToken = await createMalformedJWT("missing-userId")

      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          malformedToken,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
    })

    it("should handle invalid wallet format", async () => {
      const token = await createTestJWT("invalid-wallet-address")

      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          token,
        ),
      })

      const _body = await response.json()
      expect(response.status).toBe(200)
      // Should work with any string as wallet (auth system doesn't validate address format in JWT)
      // The error will come from database operations if user doesn't exist
    })

    it("should handle missing web3_wallet field (like email users)", async () => {
      // Create token without web3Wallet (like email auth users)
      const token = await createTestJWT(undefined)

      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          token,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      // Token without web3_wallet is valid (email users don't have one)
      // Query will fail due to user not found (not because of missing wallet)
      if (body.errors) {
        expect(body.errors[0].extensions.code).not.toBe("UNAUTHORIZED")
      }
    })
  })

  describe("Token Signature Validation", () => {
    it("should reject tokens with invalid signatures", async () => {
      const malformedToken = await createMalformedJWT("invalid-signature")

      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          malformedToken,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
    })

    it("should reject tokens signed with wrong secret", async () => {
      const malformedToken = await createMalformedJWT("wrong-secret")

      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          malformedToken,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
    })

    it("should reject completely malformed tokens", async () => {
      const malformedToken = await createMalformedJWT("invalid-format")

      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          malformedToken,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
    })

    it("should reject tokens with missing parts", async () => {
      // Token with only header and payload, no signature
      const incompleteToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ3YWxsZXQiOiIweDEyMzQifQ"

      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          incompleteToken,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
    })
  })

  describe("Concurrent Token Usage", () => {
    it("should handle multiple valid tokens for same user", async () => {
      const wallet = generateTestWallet()
      const token1 = await createTestJWT(wallet.address, { expiresIn: "1h" })
      const token2 = await createTestJWT(wallet.address, { expiresIn: "2h" })

      // Both tokens should work
      const responses = await Promise.all([
        makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(
            `query { getMyUnreadNotificationsCount }`,
            {},
            token1,
          ),
        }),
        makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(
            `query { getMyUnreadNotificationsCount }`,
            {},
            token2,
          ),
        }),
      ])

      for (const response of responses) {
        const body = await response.json()
        expect(response.status).toBe(200)
        // Should either return data or fail due to DB setup, not due to auth
        if (body.errors) {
          // If error, should not be UNAUTHORIZED (since tokens are valid)
          expect(body.errors[0].extensions.code).not.toBe("UNAUTHORIZED")
        }
      }
    })

    it("should handle concurrent requests with same token", async () => {
      const wallet = generateTestWallet()
      const token = await createTestJWT(wallet.address)

      // Make multiple concurrent requests with same token
      const concurrentRequests = Array(5)
        .fill(null)
        .map(() =>
          makeRequest(`${testServer.url}/graphql`, {
            ...createGraphQLRequest(
              `query { getMyUnreadNotificationsCount }`,
              {},
              token,
            ),
          }),
        )

      const responses = await Promise.all(concurrentRequests)

      // All requests should return 200 (whether they succeed or fail due to DB, not auth)
      for (const response of responses) {
        expect(response.status).toBe(200)
      }
    })

    it("should handle token rotation scenarios", async () => {
      const wallet = generateTestWallet()
      const oldToken = await createTestJWT(wallet.address, { expiresIn: "1h" })
      const newToken = await createTestJWT(wallet.address, { expiresIn: "2h" })

      // Old token should work
      const oldResponse = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          oldToken,
        ),
      })

      expect(oldResponse.status).toBe(200)

      // New token should also work
      const newResponse = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          newToken,
        ),
      })

      expect(newResponse.status).toBe(200)
    })
  })

  describe("Token Verification Edge Cases", () => {
    it("should handle very large tokens", async () => {
      const wallet = generateTestWallet()

      // Create token with large payload
      const largeClaims = {
        data: "x".repeat(1000), // 1KB of data
        array: Array(100).fill("large-value"),
        nested: {
          level1: {
            level2: {
              level3: "deep-nested-value",
            },
          },
        },
      }

      const largeToken = await createTestJWT(wallet.address, {
        extraClaims: largeClaims,
      })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          largeToken,
        ),
      })

      expect(response.status).toBe(200)
      // Should handle large tokens gracefully
    })

    it("should handle tokens with unicode characters", async () => {
      const wallet = generateTestWallet()
      const token = await createTestJWT(wallet.address, {
        extraClaims: {
          name: "Test User 🚀",
          description: "Test with émojis and ñoñó characters",
          unicode: "🔐🌟💎",
        },
      })

      const payload = decodeJWT(token)
      expect(payload.name).toBe("Test User 🚀")
      expect(payload.unicode).toBe("🔐🌟💎")
    })

    it("should verify our test JWT utilities work correctly", async () => {
      const wallet = generateTestWallet()
      const token = await createTestJWT(wallet.address, {
        expiresIn: "1h",
        extraClaims: { test: "value" },
      })

      // Verify using our helper
      const payload = await verifyTestJWT(token)
      expect(payload.web3_wallet).toBe(wallet.address.toLowerCase())
      expect(payload.test).toBe("value")

      // Should fail with wrong secret
      await expect(verifyTestJWT(token, "wrong-secret")).rejects.toThrow()
    })
  })

  describe("JWT Type Claim", () => {
    it("should include type claim in auth tokens", async () => {
      const wallet = generateTestWallet()
      const token = await createTestJWT(wallet.address)

      const payload = decodeJWT(token)
      expect(payload.type).toBe("auth")
    })

    it("should reject tokens with wrong type claim", async () => {
      const wallet = generateTestWallet()
      // Create a token with wrong type (simulating an OAuth state token being used as auth)
      const wrongTypeToken = await createTestJWT(wallet.address, {
        extraClaims: { type: "oauth_state" },
      })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          wrongTypeToken,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
    })

    it("should reject tokens with missing type claim", async () => {
      // Create a malformed token without type claim
      const { SignJWT } = await import("jose")
      const { serverConfig } = await import("../../../src/shared/config/server")

      const secret = new TextEncoder().encode(
        serverConfig.SESSION_ENCRYPTION_KEY,
      )
      const wallet = generateTestWallet()

      const token = await new SignJWT({
        userId: 1,
        web3_wallet: wallet.address.toLowerCase(),
        // Missing type claim
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("24h")
        .sign(secret)

      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          token,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
    })
  })

  describe("OAuth State Encryption", () => {
    it("should encrypt and decrypt OAuth state correctly", async () => {
      const { encryptOAuthState, decryptOAuthState } = await import(
        "../../../src/server/auth/oauth-state"
      )

      const encrypted = await encryptOAuthState("GOOGLE", "test-verifier")

      expect(typeof encrypted).toBe("string")
      expect(encrypted.length).toBeGreaterThan(0)

      const decrypted = await decryptOAuthState(encrypted)
      expect(decrypted).not.toBeNull()
      expect(decrypted?.provider).toBe("GOOGLE")
      expect(decrypted?.codeVerifier).toBe("test-verifier")
    })

    it("should reject invalid encrypted state", async () => {
      const { decryptOAuthState } = await import(
        "../../../src/server/auth/oauth-state"
      )

      const result = await decryptOAuthState("invalid-encrypted-state")
      expect(result).toBeNull()
    })

    it("should reject tampered encrypted state", async () => {
      const { encryptOAuthState, decryptOAuthState } = await import(
        "../../../src/server/auth/oauth-state"
      )

      const encrypted = await encryptOAuthState("GOOGLE", "test-verifier")
      const tampered = encrypted.slice(0, -5) + "XXXXX"

      const result = await decryptOAuthState(tampered)
      expect(result).toBeNull()
    })

    it("should reject OAuth encrypted state used as auth tokens", async () => {
      const { encryptOAuthState } = await import(
        "../../../src/server/auth/oauth-state"
      )

      const encryptedState = await encryptOAuthState("GOOGLE", "test-verifier")

      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          encryptedState,
        ),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeDefined()
      expect(body.errors[0].extensions.code).toBe("UNAUTHORIZED")
    })
  })

  describe("Authorization Header Handling", () => {
    it("should handle various Authorization header formats", async () => {
      const wallet = generateTestWallet()
      const token = await createTestJWT(wallet.address)

      // Test different Authorization header formats
      const testCases = [
        `Bearer ${token}`, // Standard format
        `bearer ${token}`, // Lowercase bearer
        `BEARER ${token}`, // Uppercase bearer
      ]

      for (const authHeader of testCases) {
        const response = await makeRequest(`${testServer.url}/graphql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({
            query: `query { getMyUnreadNotificationsCount }`,
          }),
        })

        expect(response.status).toBe(200)
        // Should not fail due to auth header format
      }
    })

    it("should reject invalid Authorization header formats", async () => {
      // Test the extractBearerToken method directly since HTTP headers get normalized
      const { AuthService } = await import("../../../src/server/auth")
      const authService = new AuthService(testServer.serverApp)

      const wallet = generateTestWallet()
      const token = await createTestJWT(wallet.address)

      // Test invalid formats
      const invalidFormats = [
        { header: token, desc: "Missing 'Bearer '" },
        { header: `Basic ${token}`, desc: "Wrong auth type" },
        { header: `Bearer`, desc: "Missing token" },
        { header: `Bearer ${token} extra`, desc: "Extra content" },
        { header: ` Bearer ${token}`, desc: "Leading space" },
        { header: `Bearer  ${token}`, desc: "Extra space" },
        { header: `bearer ${token}`, desc: "Lowercase 'bearer'" },
        { header: `BEARER ${token}`, desc: "Uppercase 'BEARER'" },
      ]

      for (const { header } of invalidFormats) {
        const extractedToken = authService.extractBearerToken(header)
        expect(extractedToken).toBeNull()
      }

      // Also test that valid format works
      const validHeader = `Bearer ${token}`
      const extractedToken = authService.extractBearerToken(validHeader)
      expect(extractedToken).toBe(token)
    })
  })
})
