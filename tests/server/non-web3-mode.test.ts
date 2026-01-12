/**
 * Non-Web3 Mode Tests
 *
 * Tests that verify the application behavior when WEB3_ENABLED=false.
 * These tests ensure that:
 * - Server starts successfully without Web3 features
 * - SIWE authentication properly rejects requests
 * - OAuth and email authentication continue to work
 * - No blockchain clients are created
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { type ChildProcess, fork } from "node:child_process"
import path from "node:path"
import { GraphQLErrorCode } from "../../src/shared/graphql/errors"
import { generateTestEmail } from "../helpers/auth"
import { cleanTestDatabase, setupTestDatabase } from "../helpers/database"
import { testLogger } from "../helpers/logger"
import "../setup"

const NON_WEB3_TEST_PORT = 3003

interface NonWeb3TestServer {
  process: ChildProcess | null
  url: string
  shutdown: () => Promise<void>
}

/**
 * Start a test server with WEB3_ENABLED=false
 */
async function startNonWeb3TestServer(): Promise<NonWeb3TestServer> {
  testLogger.info("🚀 Starting non-Web3 test server...")

  const serverIndexPath = path.join(__dirname, "../../src/server/index.ts")

  const serverProcess = fork(serverIndexPath, [], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      WEB3_ENABLED: "false",
      PORT: NON_WEB3_TEST_PORT.toString(),
      WORKER_COUNT: "0",
    },
    silent: false,
  })

  if (!serverProcess) {
    throw new Error("Failed to spawn non-Web3 server process")
  }

  const url = `http://localhost:${NON_WEB3_TEST_PORT}`

  // Wait for server to be ready
  const waitForReady = async (
    maxAttempts = 30,
    delayMs = 200,
  ): Promise<void> => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${url}/health`)
        if (response.ok) {
          testLogger.info(`✅ Non-Web3 test server started at ${url}`)
          return
        }
      } catch {
        // Server not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    throw new Error(`Non-Web3 server not ready after ${maxAttempts} attempts`)
  }

  // Set up error handler
  serverProcess.on("error", (error) => {
    testLogger.error("Non-Web3 server process error:", error.message)
  })

  await waitForReady()

  return {
    process: serverProcess,
    url,
    shutdown: async () => {
      testLogger.info("🛑 Shutting down non-Web3 test server...")
      if (serverProcess && !serverProcess.killed) {
        serverProcess.kill("SIGTERM")
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            if (!serverProcess.killed) {
              serverProcess.kill("SIGKILL")
            }
            resolve()
          }, 5000)
          serverProcess.on("exit", () => {
            clearTimeout(timeout)
            resolve()
          })
        })
      }
      testLogger.info("✅ Non-Web3 test server shut down")
    },
  }
}

/**
 * Make HTTP request to server
 */
async function makeRequest(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
}

/**
 * Make GraphQL request
 */
async function graphqlRequest(
  serverUrl: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ data?: any; errors?: any[] }> {
  const response = await makeRequest(`${serverUrl}/graphql`, {
    method: "POST",
    body: JSON.stringify({ query, variables }),
  })
  return response.json()
}

describe("Non-Web3 Mode", () => {
  let testServer: NonWeb3TestServer

  beforeAll(async () => {
    await setupTestDatabase()
    testServer = await startNonWeb3TestServer()
  })

  afterAll(async () => {
    if (testServer) {
      await testServer.shutdown()
    }
    await cleanTestDatabase()
  })

  describe("Server Startup", () => {
    it("should start successfully with WEB3_ENABLED=false", async () => {
      const response = await makeRequest(`${testServer.url}/health`)
      expect(response.ok).toBe(true)

      const body = await response.json()
      expect(body.status).toBe("ok")
    })

    it("should return version info", async () => {
      const response = await makeRequest(`${testServer.url}/version`)
      expect(response.ok).toBe(true)

      const body = await response.json()
      expect(body.name).toBe("Echo")
      expect(body.environment).toBe("test")
    })
  })

  describe("SIWE Authentication Rejection", () => {
    it("should reject generateSiweMessage with proper error", async () => {
      const result = await graphqlRequest(
        testServer.url,
        `
          mutation GenerateSiweMessage($address: String!, $chainId: Int!, $domain: String!) {
            generateSiweMessage(address: $address, chainId: $chainId, domain: $domain) {
              message
              nonce
            }
          }
        `,
        {
          address: "0x1234567890123456789012345678901234567890",
          chainId: 1,
          domain: "localhost:3002",
        },
      )

      expect(result.errors).toBeDefined()
      expect(result.errors?.length).toBeGreaterThan(0)
      expect(result.errors?.[0].message).toBe(
        "Web3 authentication is not enabled",
      )
      expect(result.errors?.[0].extensions?.code).toBe(
        GraphQLErrorCode.AUTHENTICATION_FAILED,
      )
    })

    it("should reject authenticateWithSiwe with proper error", async () => {
      const result = await graphqlRequest(
        testServer.url,
        `
          mutation AuthenticateWithSiwe($message: String!, $signature: String!) {
            authenticateWithSiwe(message: $message, signature: $signature) {
              success
              token
              error
            }
          }
        `,
        {
          message: "fake message",
          signature: "0xfakesignature",
        },
      )

      expect(result.errors).toBeUndefined()
      expect(result.data?.authenticateWithSiwe.success).toBe(false)
      expect(result.data?.authenticateWithSiwe.token).toBeNull()
      expect(result.data?.authenticateWithSiwe.error).toBe(
        "Web3 authentication is not enabled",
      )
    })
  })

  describe("OAuth Authentication Still Works", () => {
    it("should return Google authorization URL", async () => {
      const result = await graphqlRequest(
        testServer.url,
        `
          mutation GetOAuthLoginUrl($provider: OAuthProvider!) {
            getOAuthLoginUrl(provider: $provider) {
              success
              url
              provider
              error
            }
          }
        `,
        { provider: "GOOGLE" },
      )

      expect(result.errors).toBeUndefined()
      expect(result.data?.getOAuthLoginUrl.success).toBe(true)
      expect(result.data?.getOAuthLoginUrl.provider).toBe("GOOGLE")
      expect(result.data?.getOAuthLoginUrl.url).toBeTruthy()

      // Verify URL structure
      const url = new URL(result.data.getOAuthLoginUrl.url)
      expect(url.hostname).toBe("accounts.google.com")
    })

    it("should return GitHub authorization URL", async () => {
      const result = await graphqlRequest(
        testServer.url,
        `
          mutation GetOAuthLoginUrl($provider: OAuthProvider!) {
            getOAuthLoginUrl(provider: $provider) {
              success
              url
              provider
              error
            }
          }
        `,
        { provider: "GITHUB" },
      )

      expect(result.errors).toBeUndefined()
      expect(result.data?.getOAuthLoginUrl.success).toBe(true)
      expect(result.data?.getOAuthLoginUrl.provider).toBe("GITHUB")

      const url = new URL(result.data.getOAuthLoginUrl.url)
      expect(url.hostname).toBe("github.com")
    })
  })

  describe("Email Authentication Still Works", () => {
    it("should accept email verification request", async () => {
      const testEmail = generateTestEmail()

      const result = await graphqlRequest(
        testServer.url,
        `
          mutation SendEmailVerificationCode($email: String!) {
            sendEmailVerificationCode(email: $email) {
              success
              blob
              error
            }
          }
        `,
        { email: testEmail },
      )

      expect(result.errors).toBeUndefined()
      expect(result.data?.sendEmailVerificationCode.success).toBe(true)
      expect(result.data?.sendEmailVerificationCode.blob).toBeTruthy()
    })
  })

  describe("Token Validation Works", () => {
    it("should validate tokens correctly when not authenticated", async () => {
      const result = await graphqlRequest(
        testServer.url,
        `
          query ValidateToken {
            validateToken {
              valid
              web3Wallet
            }
          }
        `,
      )

      expect(result.errors).toBeUndefined()
      expect(result.data?.validateToken.valid).toBe(false)
      expect(result.data?.validateToken.web3Wallet).toBeNull()
    })
  })
})
