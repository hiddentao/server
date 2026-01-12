import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test"
import {
  createTestLegalContent,
  setupTestDatabase,
} from "../../helpers/database"
import { testLogger } from "../../helpers/logger"
import {
  makeRequest,
  startTestServer,
  waitForServer,
} from "../../helpers/server"
import "../../setup"

describe("GraphQL Legal Content", () => {
  let testServer: any

  beforeAll(async () => {
    testServer = await startTestServer()
    await waitForServer(testServer.url)
  })

  beforeEach(async () => {
    await setupTestDatabase()
  })

  afterAll(async () => {
    if (testServer) {
      await testServer.shutdown()
    }
  })

  describe("getPrivacyPolicy", () => {
    it("should return privacy policy when exists", async () => {
      await createTestLegalContent({
        type: "privacy_policy",
        title: "Privacy Policy",
        content: "<h1>Privacy Policy</h1><p>We value your privacy.</p>",
        version: "2.0",
        effectiveDate: new Date("2024-01-01"),
      })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query GetPrivacyPolicy {
              getPrivacyPolicy {
                title
                content
                version
                effectiveDate
              }
            }
          `,
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.errors) {
        testLogger.error("getPrivacyPolicy failed:", body.errors)
        throw new Error(body.errors[0].message)
      }

      expect(body.data.getPrivacyPolicy).toBeDefined()
      expect(body.data.getPrivacyPolicy.title).toBe("Privacy Policy")
      expect(body.data.getPrivacyPolicy.content).toContain(
        "We value your privacy",
      )
      expect(body.data.getPrivacyPolicy.version).toBe("2.0")
    })

    it("should return null when privacy policy does not exist", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query GetPrivacyPolicy {
              getPrivacyPolicy {
                title
              }
            }
          `,
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.errors) {
        testLogger.error("getPrivacyPolicy failed:", body.errors)
        throw new Error(body.errors[0].message)
      }

      expect(body.data.getPrivacyPolicy).toBeNull()
    })

    it("should not require authentication", async () => {
      await createTestLegalContent({ type: "privacy_policy" })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query GetPrivacyPolicy {
              getPrivacyPolicy {
                title
              }
            }
          `,
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(body.data.getPrivacyPolicy).toBeDefined()
    })
  })

  describe("getTermsAndConditions", () => {
    it("should return terms and conditions when exists", async () => {
      await createTestLegalContent({
        type: "terms_conditions",
        title: "Terms and Conditions",
        content:
          "<h1>Terms</h1><p>By using our service, you agree to these terms.</p>",
        version: "1.5",
        effectiveDate: new Date("2024-06-01"),
      })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query GetTermsAndConditions {
              getTermsAndConditions {
                title
                content
                version
                effectiveDate
              }
            }
          `,
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.errors) {
        testLogger.error("getTermsAndConditions failed:", body.errors)
        throw new Error(body.errors[0].message)
      }

      expect(body.data.getTermsAndConditions).toBeDefined()
      expect(body.data.getTermsAndConditions.title).toBe("Terms and Conditions")
      expect(body.data.getTermsAndConditions.content).toContain(
        "agree to these terms",
      )
      expect(body.data.getTermsAndConditions.version).toBe("1.5")
    })

    it("should return null when terms do not exist", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query GetTermsAndConditions {
              getTermsAndConditions {
                title
              }
            }
          `,
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)

      if (body.errors) {
        testLogger.error("getTermsAndConditions failed:", body.errors)
        throw new Error(body.errors[0].message)
      }

      expect(body.data.getTermsAndConditions).toBeNull()
    })

    it("should not require authentication", async () => {
      await createTestLegalContent({ type: "terms_conditions" })

      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            query GetTermsAndConditions {
              getTermsAndConditions {
                title
              }
            }
          `,
        }),
      })

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(body.data.getTermsAndConditions).toBeDefined()
    })
  })
})
