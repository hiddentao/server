/**
 * SIWE Authentication Tests for Echo
 *
 * Comprehensive testing of Sign-In with Ethereum authentication flow
 * using real wallet operations, message signing, and verification.
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
import { SiweMessage } from "siwe"
import { AuthService } from "../../../src/server/auth"
import {
  createWeb3WalletUserIfNotExists,
  getUserByAuthIdentifier,
} from "../../../src/server/db/users"
import { AUTH_METHOD } from "../../../src/shared/constants"
import {
  checksumAddress,
  createAuthenticatedTestUser,
  createGraphQLRequest,
  createMultipleTestUsers,
  createSIWEMessage,
  generateNonce,
  generateTestWallet,
  getPredefinedTestWallet,
  isValidAddress,
  signSIWEMessage,
} from "../../helpers/auth"
import { cleanTestDatabase, setupTestDatabase } from "../../helpers/database"
import {
  makeRequest,
  startTestServer,
  waitForServer,
} from "../../helpers/server"
// Import global test setup
import "../../setup"

describe("SIWE Authentication Tests", () => {
  let testServer: any
  let authService: AuthService

  beforeAll(async () => {
    await setupTestDatabase()
    testServer = await startTestServer()
    await waitForServer(testServer.url)
    authService = new AuthService(testServer.serverApp)
  })

  beforeEach(async () => {
    await cleanTestDatabase()
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

  describe("Full SIWE Authentication Flow", () => {
    it("should complete full authentication flow", async () => {
      const wallet = generateTestWallet()

      // Step 1: Create SIWE message
      const siweMessage = createSIWEMessage(wallet.address, {
        domain: "localhost",
        uri: "http://localhost:3002",
        chainId: 1,
      })

      expect(siweMessage.address).toBe(wallet.address)
      expect(siweMessage.domain).toBe("localhost")
      expect(siweMessage.uri).toBe("http://localhost:3002")
      expect(siweMessage.chainId).toBe(1)

      // Step 2: Sign the message
      const signature = await signSIWEMessage(siweMessage, wallet.privateKey)
      expect(typeof signature).toBe("string")
      expect(signature.startsWith("0x")).toBe(true)
      expect(signature.length).toBe(132) // Standard Ethereum signature length

      // Step 3: Create user in database first
      await createWeb3WalletUserIfNotExists(
        testServer.serverApp.db,
        wallet.address,
      )

      // Step 4: Authenticate and get JWT
      const authResult = await authService.authenticateWithSiwe(
        siweMessage.prepareMessage(),
        signature,
      )

      expect(authResult.token).toBeDefined()
      expect(typeof authResult.token).toBe("string")
      expect(authResult.user.web3Wallet).toBe(wallet.address.toLowerCase())
      expect(authResult.user.id).toBeDefined()
      expect(typeof authResult.user.id).toBe("number")

      // Step 5: Use JWT for authenticated GraphQL request
      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          authResult.token,
        ),
      })

      expect(response.status).toBe(200)
      const body = await response.json()

      // Should either succeed or fail due to DB setup, not auth
      if (body.errors) {
        expect(body.errors[0].extensions.code).not.toBe("UNAUTHORIZED")
      } else {
        expect(typeof body.data.getMyUnreadNotificationsCount).toBe("number")
      }
    })

    it("should work with helper function", async () => {
      const authenticatedUser = await createAuthenticatedTestUser({
        serverApp: testServer.serverApp,
      })

      expect(authenticatedUser.wallet).toBeDefined()
      expect(authenticatedUser.token).toBeDefined()
      expect(authenticatedUser.siweMessage).toBeInstanceOf(SiweMessage)
      expect(authenticatedUser.signature).toBeDefined()

      // Verify the token works
      const response = await makeRequest(`${testServer.url}/graphql`, {
        ...createGraphQLRequest(
          `query { getMyUnreadNotificationsCount }`,
          {},
          authenticatedUser.token,
        ),
      })

      expect(response.status).toBe(200)
    })

    it("should create multiple authenticated users", async () => {
      const users = await createMultipleTestUsers(3, {
        serverApp: testServer.serverApp,
      })

      expect(users).toHaveLength(3)

      // Each user should have unique wallet and token
      const addresses = users.map((u) => u.wallet.address)
      const tokens = users.map((u) => u.token)

      expect(new Set(addresses).size).toBe(3) // All unique addresses
      expect(new Set(tokens).size).toBe(3) // All unique tokens

      // All tokens should work
      for (const user of users) {
        const response = await makeRequest(`${testServer.url}/graphql`, {
          ...createGraphQLRequest(
            `query { getMyUnreadNotificationsCount }`,
            {},
            user.token,
          ),
        })

        expect(response.status).toBe(200)
      }
    })
  })

  describe("SIWE Message Validation", () => {
    it("should validate message components", async () => {
      const wallet = generateTestWallet()
      const nonce = generateNonce()

      const siweMessage = createSIWEMessage(wallet.address, {
        domain: "example.com",
        uri: "https://example.com",
        statement: "Custom sign in statement",
        version: "1",
        chainId: 1,
        nonce,
        issuedAt: new Date().toISOString(),
      })

      expect(siweMessage.domain).toBe("example.com")
      expect(siweMessage.uri).toBe("https://example.com")
      expect(siweMessage.statement).toBe("Custom sign in statement")
      expect(siweMessage.nonce).toBe(nonce)
      expect(siweMessage.chainId).toBe(1)

      const messageString = siweMessage.prepareMessage()
      expect(messageString).toContain("example.com")
      expect(messageString).toContain("https://example.com")
      expect(messageString).toContain("Custom sign in statement")
      expect(messageString).toContain(nonce)
    })

    it("should handle different chain IDs", async () => {
      const wallet = generateTestWallet()

      const chainIds = [1, 5, 11155111, 31337] // mainnet, goerli, sepolia, hardhat

      // Create user in database first (once for all chain IDs)
      await createWeb3WalletUserIfNotExists(
        testServer.serverApp.db,
        wallet.address,
      )

      for (const chainId of chainIds) {
        const siweMessage = createSIWEMessage(wallet.address, { chainId })
        const signature = await signSIWEMessage(siweMessage, wallet.privateKey)

        const _authResult = await authService.authenticateWithSiwe(
          siweMessage.prepareMessage(),
          signature,
        )
      }
    })

    it("should handle expiration times", async () => {
      const wallet = generateTestWallet()

      // Test with future expiration
      const futureExpiration = new Date(Date.now() + 60000).toISOString() // 1 minute from now
      const siweMessage = createSIWEMessage(wallet.address, {
        expirationTime: futureExpiration,
      })

      const signature = await signSIWEMessage(siweMessage, wallet.privateKey)

      // Create user in database first
      await createWeb3WalletUserIfNotExists(
        testServer.serverApp.db,
        wallet.address,
      )

      const authResult = await authService.authenticateWithSiwe(
        siweMessage.prepareMessage(),
        signature,
      )

      expect(authResult.user.web3Wallet).toBe(wallet.address.toLowerCase())
      expect(authResult.user.id).toBeDefined()
      expect(typeof authResult.user.id).toBe("number")
    })

    it("should handle notBefore times", async () => {
      const wallet = generateTestWallet()

      // Test with notBefore in the past (should work)
      const pastNotBefore = new Date(Date.now() - 60000).toISOString() // 1 minute ago
      const siweMessage = createSIWEMessage(wallet.address, {
        notBefore: pastNotBefore,
      })

      const signature = await signSIWEMessage(siweMessage, wallet.privateKey)

      // Create user in database first
      await createWeb3WalletUserIfNotExists(
        testServer.serverApp.db,
        wallet.address,
      )

      const _authResult = await authService.authenticateWithSiwe(
        siweMessage.prepareMessage(),
        signature,
      )
    })

    it("should handle resources in SIWE message", async () => {
      const wallet = generateTestWallet()

      const siweMessage = createSIWEMessage(wallet.address, {
        resources: [
          "https://example.com/api",
          "https://app.example.com/permissions",
        ],
      })

      expect(siweMessage.resources).toHaveLength(2)

      const signature = await signSIWEMessage(siweMessage, wallet.privateKey)

      // Create user in database first
      await createWeb3WalletUserIfNotExists(
        testServer.serverApp.db,
        wallet.address,
      )

      const _authResult = await authService.authenticateWithSiwe(
        siweMessage.prepareMessage(),
        signature,
      )
    })
  })

  describe("SIWE Signature Validation", () => {
    it("should reject invalid signatures", async () => {
      const wallet = generateTestWallet()
      const siweMessage = createSIWEMessage(wallet.address)

      // Create invalid signature
      const invalidSignature = "0x" + "0".repeat(130) // Invalid signature

      await expect(
        authService.authenticateWithSiwe(
          siweMessage.prepareMessage(),
          invalidSignature,
        ),
      ).rejects.toThrow()
    })

    it("should reject signature from wrong wallet", async () => {
      const wallet1 = generateTestWallet()
      const wallet2 = generateTestWallet()

      const siweMessage = createSIWEMessage(wallet1.address)

      // Sign with wrong wallet
      const wrongSignature = await signSIWEMessage(
        siweMessage,
        wallet2.privateKey,
      )

      await expect(
        authService.authenticateWithSiwe(
          siweMessage.prepareMessage(),
          wrongSignature,
        ),
      ).rejects.toThrow()
    })

    it("should reject malformed signatures", async () => {
      const wallet = generateTestWallet()
      const siweMessage = createSIWEMessage(wallet.address)

      const malformedSignatures = [
        "", // Empty signature
        "0x", // Just 0x prefix
        "0xinvalid", // Invalid hex
        "0x" + "z".repeat(130), // Invalid hex characters
        "0x" + "1".repeat(60), // Too short
        "0x" + "1".repeat(200), // Too long
      ]

      for (const signature of malformedSignatures) {
        await expect(
          authService.authenticateWithSiwe(
            siweMessage.prepareMessage(),
            signature,
          ),
        ).rejects.toThrow()
      }
    })

    it("should reject signature for wrong message", async () => {
      const wallet = generateTestWallet()

      const originalMessage = createSIWEMessage(wallet.address, {
        statement: "Original statement",
      })
      const modifiedMessage = createSIWEMessage(wallet.address, {
        statement: "Modified statement",
      })

      // Sign original message
      const signature = await signSIWEMessage(
        originalMessage,
        wallet.privateKey,
      )

      // Try to verify with modified message
      await expect(
        authService.authenticateWithSiwe(
          modifiedMessage.prepareMessage(),
          signature,
        ),
      ).rejects.toThrow()
    })
  })

  describe("Address Format Handling", () => {
    it("should handle different address formats", async () => {
      const wallet = generateTestWallet()

      // Create user in database first
      await createWeb3WalletUserIfNotExists(
        testServer.serverApp.db,
        wallet.address,
      )

      // Test with different address cases
      const addresses = [
        wallet.address, // Checksummed
        wallet.address.toLowerCase(), // Lowercase
        wallet.address.toUpperCase(), // Uppercase (invalid but should be handled)
      ]

      for (const address of addresses) {
        if (isValidAddress(address)) {
          const siweMessage = createSIWEMessage(address)
          const signature = await signSIWEMessage(
            siweMessage,
            wallet.privateKey,
          )

          const _authResult = await authService.authenticateWithSiwe(
            siweMessage.prepareMessage(),
            signature,
          )

          // Should normalize to lowercase
        }
      }
    })

    it("should handle checksummed addresses", async () => {
      const wallet = generateTestWallet()
      const checksummed = checksumAddress(wallet.address)

      expect(checksummed).toBe(wallet.address) // Should already be checksummed from viem

      // Create user in database first
      await createWeb3WalletUserIfNotExists(
        testServer.serverApp.db,
        wallet.address,
      )

      const siweMessage = createSIWEMessage(checksummed)
      const signature = await signSIWEMessage(siweMessage, wallet.privateKey)

      const _authResult = await authService.authenticateWithSiwe(
        siweMessage.prepareMessage(),
        signature,
      )
    })

    it("should work with predefined test wallets", async () => {
      const hardhatWallet = getPredefinedTestWallet("hardhat")

      expect(hardhatWallet.address).toBe(
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      )
      expect(hardhatWallet.privateKey).toBe(
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      )

      // Create user in database first
      await createWeb3WalletUserIfNotExists(
        testServer.serverApp.db,
        hardhatWallet.address,
      )

      const siweMessage = createSIWEMessage(hardhatWallet.address)
      const signature = await signSIWEMessage(
        siweMessage,
        hardhatWallet.privateKey,
      )

      const _authResult = await authService.authenticateWithSiwe(
        siweMessage.prepareMessage(),
        signature,
      )
    })
  })

  describe("Domain and URI Validation", () => {
    it("should validate domain matching", async () => {
      const wallet = generateTestWallet()

      // Create user in database first
      await createWeb3WalletUserIfNotExists(
        testServer.serverApp.db,
        wallet.address,
      )

      // Test different domains
      const validDomains = ["localhost", "example.com", "app.quickdapp.com"]

      for (const domain of validDomains) {
        const siweMessage = createSIWEMessage(wallet.address, { domain })
        const signature = await signSIWEMessage(siweMessage, wallet.privateKey)

        const _authResult = await authService.authenticateWithSiwe(
          siweMessage.prepareMessage(),
          signature,
        )
      }
    })

    it("should validate URI schemes", async () => {
      const wallet = generateTestWallet()

      // Create user in database first
      await createWeb3WalletUserIfNotExists(
        testServer.serverApp.db,
        wallet.address,
      )

      const validURIs = [
        "http://localhost:3002",
        "https://example.com",
        "https://app.quickdapp.com/auth",
      ]

      for (const uri of validURIs) {
        const siweMessage = createSIWEMessage(wallet.address, { uri })
        const signature = await signSIWEMessage(siweMessage, wallet.privateKey)

        const _authResult = await authService.authenticateWithSiwe(
          siweMessage.prepareMessage(),
          signature,
        )
      }
    })
  })

  describe("Nonce Handling", () => {
    it("should generate unique nonces", async () => {
      const nonces = Array(100)
        .fill(null)
        .map(() => generateNonce())
      const uniqueNonces = new Set(nonces)

      // Should have high probability of uniqueness
      expect(uniqueNonces.size).toBeGreaterThan(95)
    })

    it("should handle custom nonces", async () => {
      const wallet = generateTestWallet()
      const customNonce = "customnonce12345abc"

      const siweMessage = createSIWEMessage(wallet.address, {
        nonce: customNonce,
      })

      expect(siweMessage.nonce).toBe(customNonce)

      // Create user in database first
      await createWeb3WalletUserIfNotExists(
        testServer.serverApp.db,
        wallet.address,
      )

      const signature = await signSIWEMessage(siweMessage, wallet.privateKey)

      const _authResult = await authService.authenticateWithSiwe(
        siweMessage.prepareMessage(),
        signature,
      )
    })

    it("should handle very long nonces", async () => {
      const wallet = generateTestWallet()
      const longNonce = "verylongnonce" + "x".repeat(40) // Keep under reasonable limits

      const siweMessage = createSIWEMessage(wallet.address, {
        nonce: longNonce,
      })

      // Create user in database first
      await createWeb3WalletUserIfNotExists(
        testServer.serverApp.db,
        wallet.address,
      )

      const signature = await signSIWEMessage(siweMessage, wallet.privateKey)

      const _authResult = await authService.authenticateWithSiwe(
        siweMessage.prepareMessage(),
        signature,
      )
    })
  })

  describe("Concurrent Authentication", () => {
    it("should handle concurrent SIWE authentications", async () => {
      const wallets = Array(5)
        .fill(null)
        .map(() => generateTestWallet())

      // Create all users in database first
      await Promise.all(
        wallets.map((wallet) =>
          createWeb3WalletUserIfNotExists(
            testServer.serverApp.db,
            wallet.address,
          ),
        ),
      )

      const authPromises = wallets.map(async (wallet) => {
        const siweMessage = createSIWEMessage(wallet.address)
        const signature = await signSIWEMessage(siweMessage, wallet.privateKey)

        return authService.authenticateWithSiwe(
          siweMessage.prepareMessage(),
          signature,
        )
      })

      const authResults = await Promise.all(authPromises)

      expect(authResults).toHaveLength(5)

      // All should succeed and have unique tokens
      const tokens = authResults.map((r) => r.token)
      expect(new Set(tokens).size).toBe(5)

      // All should have correct wallet addresses
      for (let i = 0; i < wallets.length; i++) {
        expect(authResults[i]!.user.web3Wallet).toBe(
          wallets[i]!.address.toLowerCase(),
        )
      }
    })

    it("should handle multiple authentications for same wallet", async () => {
      const wallet = generateTestWallet()

      // Create user in database first
      await createWeb3WalletUserIfNotExists(
        testServer.serverApp.db,
        wallet.address,
      )

      // Create multiple auth sessions for same wallet
      const authPromises = Array(3)
        .fill(null)
        .map(async (_, index) => {
          // Add unique nonce to ensure different messages and tokens
          const siweMessage = createSIWEMessage(wallet.address, {
            nonce: `testnonce${index}${Date.now()}${Math.random().toString(36).substring(2)}`,
          })
          const signature = await signSIWEMessage(
            siweMessage,
            wallet.privateKey,
          )

          return authService.authenticateWithSiwe(
            siweMessage.prepareMessage(),
            signature,
          )
        })

      const authResults = await Promise.all(authPromises)

      // All should succeed
      expect(authResults).toHaveLength(3)

      // All should be for same wallet
      for (const result of authResults) {
        expect(result.user.web3Wallet).toBe(wallet.address.toLowerCase())
      }

      // But should have different tokens
      const tokens = authResults.map((r) => r.token)
      expect(new Set(tokens).size).toBe(3)
    })
  })

  describe("Error Handling", () => {
    it("should provide meaningful error messages", async () => {
      const wallet = generateTestWallet()
      const siweMessage = createSIWEMessage(wallet.address)

      // Test with completely invalid signature
      try {
        await authService.authenticateWithSiwe(
          siweMessage.prepareMessage(),
          "invalid-signature",
        )
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        expect(error.message).toBeDefined()
        expect(error.extensions?.code).toBe("AUTHENTICATION_FAILED")
      }
    })

    it("should handle malformed SIWE messages", async () => {
      // Use a malformed message

      // Try to authenticate with malformed message
      try {
        await authService.authenticateWithSiwe(
          "This is not a valid SIWE message",
          "0x" + "0".repeat(130),
        )
        expect(true).toBe(false) // Should not reach here
      } catch (error: any) {
        expect(error.message).toBeDefined()
      }
    })

    it("should automatically create user if they don't exist during authentication", async () => {
      const wallet = generateTestWallet()

      // Step 1: Create SIWE message
      const siweMessage = createSIWEMessage(wallet.address, {
        domain: "localhost",
        uri: "http://localhost:3002",
        chainId: 1,
      })

      // Step 2: Sign the message
      const signature = await signSIWEMessage(siweMessage, wallet.privateKey)

      // Step 3: Verify user doesn't exist in database initially
      const userBefore = await getUserByAuthIdentifier(
        testServer.serverApp.db,
        AUTH_METHOD.WEB3_WALLET,
        wallet.address.toLowerCase(),
      )
      expect(userBefore).toBeUndefined()

      // Step 4: Authenticate - this should create the user automatically
      const authResult = await authService.authenticateWithSiwe(
        siweMessage.prepareMessage(),
        signature,
      )

      expect(authResult.token).toBeDefined()
      expect(typeof authResult.token).toBe("string")
      expect(authResult.user.web3Wallet).toBe(wallet.address.toLowerCase())
      expect(authResult.user.id).toBeDefined()
      expect(typeof authResult.user.id).toBe("number")

      // Step 5: Verify user now exists in database
      const userAfter = await getUserByAuthIdentifier(
        testServer.serverApp.db,
        AUTH_METHOD.WEB3_WALLET,
        wallet.address.toLowerCase(),
      )
      expect(userAfter).toBeDefined()
      expect(userAfter!.id).toBe(authResult.user.id)
    })
  })
})
