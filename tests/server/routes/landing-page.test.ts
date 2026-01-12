import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test"
import {
  createTestLegalContent,
  setupTestDatabase,
} from "../../helpers/database"
import {
  makeRequest,
  startTestServer,
  waitForServer,
} from "../../helpers/server"
import "../../setup"

describe("Server Routes", () => {
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

  describe("Landing Page (/)", () => {
    it("should return HTML landing page", async () => {
      const response = await makeRequest(testServer.url, {
        method: "GET",
      })

      expect(response.status).toBe(200)
      const contentType = response.headers.get("content-type")
      expect(contentType).toContain("text/html")

      const html = await response.text()
      expect(html).toContain("Echo")
    })
  })

  describe("Privacy Page (/privacy)", () => {
    it("should return HTML privacy page with content", async () => {
      await createTestLegalContent({
        type: "privacy_policy",
        title: "Privacy Policy",
        content: "<p>We respect your privacy.</p>",
        version: "1.0",
      })

      const response = await makeRequest(`${testServer.url}/privacy`, {
        method: "GET",
      })

      expect(response.status).toBe(200)
      const contentType = response.headers.get("content-type")
      expect(contentType).toContain("text/html")

      const html = await response.text()
      expect(html).toContain("Privacy Policy")
      expect(html).toContain("We respect your privacy")
    })

    it("should return placeholder page when no content exists", async () => {
      const response = await makeRequest(`${testServer.url}/privacy`, {
        method: "GET",
      })

      expect(response.status).toBe(200)
      const contentType = response.headers.get("content-type")
      expect(contentType).toContain("text/html")

      const html = await response.text()
      expect(html.toLowerCase()).toContain("privacy")
    })
  })

  describe("Terms Page (/terms)", () => {
    it("should return HTML terms page with content", async () => {
      await createTestLegalContent({
        type: "terms_conditions",
        title: "Terms and Conditions",
        content: "<p>By using our service, you agree to these terms.</p>",
        version: "1.0",
      })

      const response = await makeRequest(`${testServer.url}/terms`, {
        method: "GET",
      })

      expect(response.status).toBe(200)
      const contentType = response.headers.get("content-type")
      expect(contentType).toContain("text/html")

      const html = await response.text()
      expect(html).toContain("Terms")
      expect(html).toContain("agree to these terms")
    })

    it("should return placeholder page when no content exists", async () => {
      const response = await makeRequest(`${testServer.url}/terms`, {
        method: "GET",
      })

      expect(response.status).toBe(200)
      const contentType = response.headers.get("content-type")
      expect(contentType).toContain("text/html")

      const html = await response.text()
      expect(html.toLowerCase()).toContain("terms")
    })
  })

  describe("Health Check (/health)", () => {
    it("should return health status", async () => {
      const response = await makeRequest(`${testServer.url}/health`, {
        method: "GET",
      })

      expect(response.status).toBe(200)

      const body = await response.json()
      expect(body.status).toBe("ok")
      expect(body.timestamp).toBeDefined()
    })
  })

  describe("Version (/version)", () => {
    it("should return version info", async () => {
      const response = await makeRequest(`${testServer.url}/version`, {
        method: "GET",
      })

      expect(response.status).toBe(200)

      const body = await response.json()
      expect(body.version).toBeDefined()
      expect(body.name).toBe("Echo")
    })
  })

  describe("404 Handling", () => {
    it("should return 404 for unknown routes", async () => {
      const response = await makeRequest(
        `${testServer.url}/nonexistent-route`,
        {
          method: "GET",
        },
      )

      expect(response.status).toBe(404)
    })
  })
})
