import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import {
  createGraphQLRequest,
  generateTestEmail,
  generateTestEmailVerification,
} from "../../helpers/auth"
import { cleanTestDatabase, setupTestDatabase } from "../../helpers/database"
import {
  makeRequest,
  startTestServer,
  waitForServer,
} from "../../helpers/server"
import "../../setup"

describe("Email Authentication", () => {
  let testServer: any

  beforeAll(async () => {
    await setupTestDatabase()
    testServer = await startTestServer()
    await waitForServer(testServer.url)
  })

  afterAll(async () => {
    if (testServer) {
      await testServer.shutdown()
    }
    await cleanTestDatabase()
  })

  describe("sendEmailVerificationCode mutation", () => {
    it("should send verification code for valid email", async () => {
      const email = generateTestEmail()

      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createGraphQLRequest(
          `
          mutation SendEmailVerificationCode($email: String!) {
            sendEmailVerificationCode(email: $email) {
              success
              blob
              error
            }
          }
        `,
          { email },
        ),
      )

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(body.data.sendEmailVerificationCode.success).toBe(true)
      expect(body.data.sendEmailVerificationCode.blob).toBeTruthy()
      expect(body.data.sendEmailVerificationCode.error).toBeNull()
    })

    it("should reject invalid email format", async () => {
      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createGraphQLRequest(
          `
          mutation SendEmailVerificationCode($email: String!) {
            sendEmailVerificationCode(email: $email) {
              success
              blob
              error
            }
          }
        `,
          { email: "invalid-email" },
        ),
      )

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(body.data.sendEmailVerificationCode.success).toBe(false)
      expect(body.data.sendEmailVerificationCode.blob).toBeNull()
      expect(body.data.sendEmailVerificationCode.error).toBe(
        "Invalid email format",
      )
    })

    it("should reject empty email", async () => {
      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createGraphQLRequest(
          `
          mutation SendEmailVerificationCode($email: String!) {
            sendEmailVerificationCode(email: $email) {
              success
              blob
              error
            }
          }
        `,
          { email: "" },
        ),
      )

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.data.sendEmailVerificationCode.success).toBe(false)
      expect(body.data.sendEmailVerificationCode.error).toBe(
        "Invalid email format",
      )
    })
  })

  describe("authenticateWithEmail mutation", () => {
    it("should authenticate with valid code and blob", async () => {
      const email = generateTestEmail()
      const { code, blob } = await generateTestEmailVerification(email)

      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createGraphQLRequest(
          `
          mutation AuthenticateWithEmail($email: String!, $code: String!, $blob: String!) {
            authenticateWithEmail(email: $email, code: $code, blob: $blob) {
              success
              token
              web3Wallet
              error
            }
          }
        `,
          { email, code, blob },
        ),
      )

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(body.data.authenticateWithEmail.success).toBe(true)
      expect(body.data.authenticateWithEmail.token).toBeTruthy()
      expect(body.data.authenticateWithEmail.web3Wallet).toBeNull()
      expect(body.data.authenticateWithEmail.error).toBeNull()
    })

    it("should reject incorrect verification code", async () => {
      const email = generateTestEmail()
      const { blob } = await generateTestEmailVerification(email)

      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createGraphQLRequest(
          `
          mutation AuthenticateWithEmail($email: String!, $code: String!, $blob: String!) {
            authenticateWithEmail(email: $email, code: $code, blob: $blob) {
              success
              token
              web3Wallet
              error
            }
          }
        `,
          { email, code: "000000", blob },
        ),
      )

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.data.authenticateWithEmail.success).toBe(false)
      expect(body.data.authenticateWithEmail.token).toBeNull()
      expect(body.data.authenticateWithEmail.error).toBe(
        "Incorrect verification code",
      )
    })

    it("should reject mismatched email", async () => {
      const email = generateTestEmail()
      const differentEmail = generateTestEmail()
      const { code, blob } = await generateTestEmailVerification(email)

      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createGraphQLRequest(
          `
          mutation AuthenticateWithEmail($email: String!, $code: String!, $blob: String!) {
            authenticateWithEmail(email: $email, code: $code, blob: $blob) {
              success
              token
              web3Wallet
              error
            }
          }
        `,
          { email: differentEmail, code, blob },
        ),
      )

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.data.authenticateWithEmail.success).toBe(false)
      expect(body.data.authenticateWithEmail.error).toBe("Email mismatch")
    })

    it("should reject invalid blob", async () => {
      const email = generateTestEmail()

      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createGraphQLRequest(
          `
          mutation AuthenticateWithEmail($email: String!, $code: String!, $blob: String!) {
            authenticateWithEmail(email: $email, code: $code, blob: $blob) {
              success
              token
              web3Wallet
              error
            }
          }
        `,
          { email, code: "123456", blob: "invalid-blob-data" },
        ),
      )

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.data.authenticateWithEmail.success).toBe(false)
      expect(body.data.authenticateWithEmail.error).toBe(
        "Invalid verification data",
      )
    })

    it("should return same user for same email on subsequent auth", async () => {
      const email = generateTestEmail()

      // First authentication
      const { code: code1, blob: blob1 } =
        await generateTestEmailVerification(email)

      const response1 = await makeRequest(
        `${testServer.url}/graphql`,
        createGraphQLRequest(
          `
          mutation AuthenticateWithEmail($email: String!, $code: String!, $blob: String!) {
            authenticateWithEmail(email: $email, code: $code, blob: $blob) {
              success
              token
              web3Wallet
              error
            }
          }
        `,
          { email, code: code1, blob: blob1 },
        ),
      )

      const body1 = await response1.json()
      expect(body1.data.authenticateWithEmail.success).toBe(true)
      expect(body1.data.authenticateWithEmail.token).toBeTruthy()

      // Second authentication with same email
      const { code: code2, blob: blob2 } =
        await generateTestEmailVerification(email)

      const response2 = await makeRequest(
        `${testServer.url}/graphql`,
        createGraphQLRequest(
          `
          mutation AuthenticateWithEmail($email: String!, $code: String!, $blob: String!) {
            authenticateWithEmail(email: $email, code: $code, blob: $blob) {
              success
              token
              web3Wallet
              error
            }
          }
        `,
          { email, code: code2, blob: blob2 },
        ),
      )

      const body2 = await response2.json()
      expect(body2.data.authenticateWithEmail.success).toBe(true)
      expect(body2.data.authenticateWithEmail.token).toBeTruthy()
    })

    it("should handle email case insensitively", async () => {
      const baseEmail = generateTestEmail()
      const upperEmail = baseEmail.toUpperCase()

      // First auth with lowercase
      const { code: code1, blob: blob1 } =
        await generateTestEmailVerification(baseEmail)

      const response1 = await makeRequest(
        `${testServer.url}/graphql`,
        createGraphQLRequest(
          `
          mutation AuthenticateWithEmail($email: String!, $code: String!, $blob: String!) {
            authenticateWithEmail(email: $email, code: $code, blob: $blob) {
              success
              token
              web3Wallet
              error
            }
          }
        `,
          { email: baseEmail, code: code1, blob: blob1 },
        ),
      )

      const body1 = await response1.json()
      expect(body1.data.authenticateWithEmail.success).toBe(true)

      // Second auth with uppercase should work and return same user
      const { code: code2, blob: blob2 } =
        await generateTestEmailVerification(upperEmail)

      const response2 = await makeRequest(
        `${testServer.url}/graphql`,
        createGraphQLRequest(
          `
          mutation AuthenticateWithEmail($email: String!, $code: String!, $blob: String!) {
            authenticateWithEmail(email: $email, code: $code, blob: $blob) {
              success
              token
              web3Wallet
              error
            }
          }
        `,
          { email: upperEmail, code: code2, blob: blob2 },
        ),
      )

      const body2 = await response2.json()
      expect(body2.data.authenticateWithEmail.success).toBe(true)
    })
  })

  describe("Token validation after email auth", () => {
    it("should validate token from email auth", async () => {
      const email = generateTestEmail()
      const { code, blob } = await generateTestEmailVerification(email)

      // Authenticate
      const authResponse = await makeRequest(
        `${testServer.url}/graphql`,
        createGraphQLRequest(
          `
          mutation AuthenticateWithEmail($email: String!, $code: String!, $blob: String!) {
            authenticateWithEmail(email: $email, code: $code, blob: $blob) {
              success
              token
              web3Wallet
              error
            }
          }
        `,
          { email, code, blob },
        ),
      )

      const authBody = await authResponse.json()
      const token = authBody.data.authenticateWithEmail.token

      // Validate token
      const validateResponse = await makeRequest(
        `${testServer.url}/graphql`,
        createGraphQLRequest(
          `query { validateToken { valid web3Wallet } }`,
          undefined,
          token,
        ),
      )

      const validateBody = await validateResponse.json()
      expect(validateBody.data.validateToken.valid).toBe(true)
      expect(validateBody.data.validateToken.web3Wallet).toBeNull()
    })
  })

  describe("Disabled user handling", () => {
    it("should reject authentication for disabled email user", async () => {
      const email = generateTestEmail()

      // First, create the user via successful auth
      const { code: code1, blob: blob1 } =
        await generateTestEmailVerification(email)

      const response1 = await makeRequest(
        `${testServer.url}/graphql`,
        createGraphQLRequest(
          `
          mutation AuthenticateWithEmail($email: String!, $code: String!, $blob: String!) {
            authenticateWithEmail(email: $email, code: $code, blob: $blob) {
              success
              token
              web3Wallet
              error
            }
          }
        `,
          { email, code: code1, blob: blob1 },
        ),
      )

      const body1 = await response1.json()
      expect(body1.data.authenticateWithEmail.success).toBe(true)

      // Disable the user via the userAuth table join
      const { sql } = await import("drizzle-orm")
      const { dbManager } = await import("@server/db/connection")
      const db = dbManager.getDb()

      // Disable the user by finding them via their email auth identifier
      await db.execute(
        sql`UPDATE users SET disabled = true WHERE id = (SELECT user_id FROM user_auth WHERE auth_identifier = ${email.toLowerCase()})`,
      )

      // Now try to authenticate again - should fail
      const { code: code2, blob: blob2 } =
        await generateTestEmailVerification(email)

      const response2 = await makeRequest(
        `${testServer.url}/graphql`,
        createGraphQLRequest(
          `
          mutation AuthenticateWithEmail($email: String!, $code: String!, $blob: String!) {
            authenticateWithEmail(email: $email, code: $code, blob: $blob) {
              success
              token
              web3Wallet
              error
            }
          }
        `,
          { email, code: code2, blob: blob2 },
        ),
      )

      const body2 = await response2.json()
      expect(body2.data.authenticateWithEmail.success).toBe(false)
      expect(body2.data.authenticateWithEmail.error).toBe("Account is disabled")
    })
  })
})
