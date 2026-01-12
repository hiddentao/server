import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test"
import { setupTestDatabase } from "../../helpers/database"
import { testLogger } from "../../helpers/logger"
import {
  clearMockFirebaseTokens,
  disableFirebaseTestMode,
  enableFirebaseTestMode,
  generateMockFirebaseToken,
  registerMockFirebaseToken,
} from "../../helpers/mockFirebase"
import {
  makeRequest,
  startTestServer,
  waitForServer,
} from "../../helpers/server"
import "../../setup"

describe("GraphQL Firebase Authentication", () => {
  let testServer: any

  beforeAll(async () => {
    testServer = await startTestServer()
    await waitForServer(testServer.url)
  })

  beforeEach(async () => {
    await setupTestDatabase()
    enableFirebaseTestMode()
  })

  afterEach(() => {
    clearMockFirebaseTokens()
  })

  afterAll(async () => {
    disableFirebaseTestMode()
    if (testServer) {
      await testServer.shutdown()
    }
  })

  describe("authenticateWithFirebase", () => {
    it("should authenticate a new user with phone number", async () => {
      const mockToken = await generateMockFirebaseToken({
        uid: "firebase-uid-123",
        phoneNumber: "+1234567890",
      })

      registerMockFirebaseToken(mockToken.idToken, {
        uid: mockToken.uid,
        phoneNumber: mockToken.phoneNumber,
      })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            mutation AuthenticateWithFirebase($idToken: String!) {
              authenticateWithFirebase(idToken: $idToken) {
                success
                token
                error
              }
            }
          `,
          variables: {
            idToken: mockToken.idToken,
          },
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.errors) {
        testLogger.error("authenticateWithFirebase failed:", body.errors)
        throw new Error(body.errors[0].message)
      }

      expect(body.data.authenticateWithFirebase).toBeDefined()
      expect(body.data.authenticateWithFirebase.success).toBe(true)
      expect(body.data.authenticateWithFirebase.token).toBeDefined()
      expect(body.data.authenticateWithFirebase.error).toBeNull()
    })

    it("should return token on repeat authentication", async () => {
      const mockToken = await generateMockFirebaseToken({
        uid: "firebase-uid-repeat",
        phoneNumber: "+9876543210",
      })

      registerMockFirebaseToken(mockToken.idToken, {
        uid: mockToken.uid,
        phoneNumber: mockToken.phoneNumber,
      })

      const firstResponse = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            mutation AuthenticateWithFirebase($idToken: String!) {
              authenticateWithFirebase(idToken: $idToken) {
                success
                token
              }
            }
          `,
          variables: {
            idToken: mockToken.idToken,
          },
        }),
      })

      const firstBody = await firstResponse.json()
      expect(firstBody.data.authenticateWithFirebase.success).toBe(true)
      const _firstToken = firstBody.data.authenticateWithFirebase.token

      const secondResponse = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            mutation AuthenticateWithFirebase($idToken: String!) {
              authenticateWithFirebase(idToken: $idToken) {
                success
                token
              }
            }
          `,
          variables: {
            idToken: mockToken.idToken,
          },
        }),
      })

      const secondBody = await secondResponse.json()
      expect(secondResponse.status).toBe(200)

      if (secondBody.errors) {
        testLogger.error(
          "second authenticateWithFirebase failed:",
          secondBody.errors,
        )
        throw new Error(secondBody.errors[0].message)
      }

      expect(secondBody.data.authenticateWithFirebase.success).toBe(true)
      expect(secondBody.data.authenticateWithFirebase.token).toBeDefined()
    })

    it("should reject invalid token", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            mutation AuthenticateWithFirebase($idToken: String!) {
              authenticateWithFirebase(idToken: $idToken) {
                success
                token
                error
              }
            }
          `,
          variables: {
            idToken: "invalid-token-that-is-not-registered",
          },
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.data.authenticateWithFirebase.success).toBe(false)
      expect(body.data.authenticateWithFirebase.error).toBeDefined()
    })

    it("should reject authentication without phone number", async () => {
      const mockToken = await generateMockFirebaseToken({
        uid: "firebase-email-uid",
        email: "test@example.com",
      })

      registerMockFirebaseToken(mockToken.idToken, {
        uid: mockToken.uid,
        email: mockToken.email,
      })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            mutation AuthenticateWithFirebase($idToken: String!) {
              authenticateWithFirebase(idToken: $idToken) {
                success
                error
              }
            }
          `,
          variables: {
            idToken: mockToken.idToken,
          },
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.data.authenticateWithFirebase.success).toBe(false)
      expect(body.data.authenticateWithFirebase.error).toContain("Phone number")
    })
  })

  describe("Token Usage", () => {
    it("should be able to use returned token for authenticated requests", async () => {
      const mockToken = await generateMockFirebaseToken({
        uid: "firebase-uid-token-test",
        phoneNumber: "+1111111111",
      })

      registerMockFirebaseToken(mockToken.idToken, {
        uid: mockToken.uid,
        phoneNumber: mockToken.phoneNumber,
      })

      const authResponse = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            mutation AuthenticateWithFirebase($idToken: String!) {
              authenticateWithFirebase(idToken: $idToken) {
                success
                token
              }
            }
          `,
          variables: {
            idToken: mockToken.idToken,
          },
        }),
      })

      const authBody = await authResponse.json()

      if (authBody.errors) {
        testLogger.error("authenticateWithFirebase failed:", authBody.errors)
        throw new Error(authBody.errors[0].message)
      }

      expect(authBody.data.authenticateWithFirebase.success).toBe(true)
      const jwtToken = authBody.data.authenticateWithFirebase.token

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify({
          query: `
            query GetMyUnreadNotificationsCount {
              getMyUnreadNotificationsCount
            }
          `,
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.errors) {
        testLogger.error("authenticated query failed:", body.errors)
        throw new Error(body.errors[0].message)
      }

      expect(typeof body.data.getMyUnreadNotificationsCount).toBe("number")
    })
  })
})
