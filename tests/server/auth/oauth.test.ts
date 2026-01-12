/**
 * OAuth Integration Tests
 *
 * Comprehensive tests for OAuth authentication flow including:
 * - getOAuthLoginUrl mutation
 * - OAuth callback routes for all providers
 * - State validation (CSRF protection via encrypted state)
 * - PKCE verification
 * - User creation and account linking
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test"
import {
  createMockOAuthState,
  createOAuthLoginUrlRequest,
} from "../../helpers/auth"
import { cleanTestDatabase, setupTestDatabase } from "../../helpers/database"
import {
  makeRequest,
  startTestServer,
  waitForServer,
} from "../../helpers/server"
import "../../setup"
import {
  type OAuthProvider,
  resetOAuthClients,
} from "../../../src/server/auth/oauth"
import { encryptOAuthState } from "../../../src/server/auth/oauth-state"

describe("OAuth Authentication", () => {
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

  beforeEach(() => {
    // Reset OAuth clients between tests
    resetOAuthClients()
  })

  describe("getOAuthLoginUrl mutation", () => {
    it("should return Google authorization URL with state and PKCE", async () => {
      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createOAuthLoginUrlRequest("GOOGLE"),
      )

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(body.data.getOAuthLoginUrl.success).toBe(true)
      expect(body.data.getOAuthLoginUrl.provider).toBe("GOOGLE")
      expect(body.data.getOAuthLoginUrl.error).toBeNull()

      // Verify URL structure
      const url = new URL(body.data.getOAuthLoginUrl.url)
      expect(url.hostname).toBe("accounts.google.com")
      expect(url.searchParams.get("client_id")).toBe("test_google_client_id")
      expect(url.searchParams.get("response_type")).toBe("code")
      expect(url.searchParams.get("state")).toBeTruthy()
      expect(url.searchParams.get("code_challenge")).toBeTruthy() // PKCE
      expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    })

    it("should return Facebook authorization URL with state (no PKCE)", async () => {
      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createOAuthLoginUrlRequest("FACEBOOK"),
      )

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(body.data.getOAuthLoginUrl.success).toBe(true)
      expect(body.data.getOAuthLoginUrl.provider).toBe("FACEBOOK")

      // Verify URL structure
      const url = new URL(body.data.getOAuthLoginUrl.url)
      expect(url.hostname).toBe("www.facebook.com")
      expect(url.searchParams.get("client_id")).toBe("test_facebook_client_id")
      expect(url.searchParams.get("state")).toBeTruthy()
      // Facebook doesn't require PKCE
      expect(url.searchParams.get("code_challenge")).toBeNull()
    })

    it("should return GitHub authorization URL with state (no PKCE)", async () => {
      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createOAuthLoginUrlRequest("GITHUB"),
      )

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(body.data.getOAuthLoginUrl.success).toBe(true)
      expect(body.data.getOAuthLoginUrl.provider).toBe("GITHUB")

      // Verify URL structure
      const url = new URL(body.data.getOAuthLoginUrl.url)
      expect(url.hostname).toBe("github.com")
      expect(url.searchParams.get("client_id")).toBe("test_github_client_id")
      expect(url.searchParams.get("state")).toBeTruthy()
    })

    it("should return X (Twitter) authorization URL with state and PKCE", async () => {
      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createOAuthLoginUrlRequest("X"),
      )

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(body.data.getOAuthLoginUrl.success).toBe(true)
      expect(body.data.getOAuthLoginUrl.provider).toBe("X")

      // Verify URL structure
      const url = new URL(body.data.getOAuthLoginUrl.url)
      expect(url.hostname).toBe("twitter.com")
      expect(url.searchParams.get("client_id")).toBe("test_x_client_id")
      expect(url.searchParams.get("state")).toBeTruthy()
      expect(url.searchParams.get("code_challenge")).toBeTruthy() // PKCE
    })

    it("should return TikTok authorization URL with state and PKCE", async () => {
      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createOAuthLoginUrlRequest("TIKTOK"),
      )

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(body.data.getOAuthLoginUrl.success).toBe(true)
      expect(body.data.getOAuthLoginUrl.provider).toBe("TIKTOK")

      // Verify URL structure
      const url = new URL(body.data.getOAuthLoginUrl.url)
      expect(url.searchParams.get("client_key")).toBe("test_tiktok_client_key")
      expect(url.searchParams.get("state")).toBeTruthy()
      expect(url.searchParams.get("code_challenge")).toBeTruthy() // PKCE
    })

    it("should return LinkedIn authorization URL with state (no PKCE)", async () => {
      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createOAuthLoginUrlRequest("LINKEDIN"),
      )

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(body.data.getOAuthLoginUrl.success).toBe(true)
      expect(body.data.getOAuthLoginUrl.provider).toBe("LINKEDIN")

      // Verify URL structure
      const url = new URL(body.data.getOAuthLoginUrl.url)
      expect(url.hostname).toBe("www.linkedin.com")
      expect(url.searchParams.get("client_id")).toBe("test_linkedin_client_id")
      expect(url.searchParams.get("state")).toBeTruthy()
    })

    it("should reject invalid provider", async () => {
      const response = await makeRequest(`${testServer.url}/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation GetOAuthLoginUrl($provider: OAuthProvider!) {
              getOAuthLoginUrl(provider: $provider) {
                success
                url
                error
              }
            }
          `,
          variables: { provider: "INVALID_PROVIDER" },
        }),
      })

      const body = await response.json()
      // GraphQL returns 400 for invalid enum value
      expect(response.status).toBe(400)
      expect(body.errors).toBeDefined()
    })

    it("should accept valid same-origin redirectUrl", async () => {
      const { serverConfig } = await import("../../../src/shared/config/server")
      const redirectUrl = `${serverConfig.API_URL}/dashboard`
      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createOAuthLoginUrlRequest("GOOGLE", undefined, redirectUrl),
      )

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(body.data.getOAuthLoginUrl.success).toBe(true)
      expect(body.data.getOAuthLoginUrl.url).toBeTruthy()
    })

    it("should reject cross-origin redirectUrl", async () => {
      const redirectUrl = "https://evil.com/steal-token"
      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createOAuthLoginUrlRequest("GOOGLE", undefined, redirectUrl),
      )

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(body.data.getOAuthLoginUrl.success).toBe(false)
      expect(body.data.getOAuthLoginUrl.error).toBe(
        "Redirect URL must be same-origin",
      )
    })

    it("should reject invalid redirectUrl", async () => {
      const redirectUrl = "not-a-valid-url"
      const response = await makeRequest(
        `${testServer.url}/graphql`,
        createOAuthLoginUrlRequest("GOOGLE", undefined, redirectUrl),
      )

      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.errors).toBeUndefined()
      expect(body.data.getOAuthLoginUrl.success).toBe(false)
      expect(body.data.getOAuthLoginUrl.error).toBe("Invalid redirect URL")
    })
  })

  describe("OAuth callback routes - state validation", () => {
    const providers: Array<{ name: OAuthProvider; path: string }> = [
      { name: "GOOGLE", path: "/auth/callback/google" },
      { name: "FACEBOOK", path: "/auth/callback/facebook" },
      { name: "GITHUB", path: "/auth/callback/github" },
      { name: "X", path: "/auth/callback/x" },
      { name: "TIKTOK", path: "/auth/callback/tiktok" },
      { name: "LINKEDIN", path: "/auth/callback/linkedin" },
    ]

    for (const { name, path } of providers) {
      it(`should reject ${name} callback with missing state`, async () => {
        const response = await fetch(
          `${testServer.url}${path}?code=test_code`,
          {
            redirect: "manual",
          },
        )

        expect(response.status).toBe(302)
        const location = response.headers.get("Location")
        expect(location).toContain("/auth/error")
        expect(location).toContain("Invalid%20OAuth%20state")
      })

      it(`should reject ${name} callback with invalid state`, async () => {
        const response = await fetch(
          `${testServer.url}${path}?code=test_code&state=invalid_state`,
          {
            redirect: "manual",
          },
        )

        expect(response.status).toBe(302)
        const location = response.headers.get("Location")
        expect(location).toContain("/auth/error")
        expect(location).toContain("Invalid%20or%20expired%20OAuth%20state")
      })

      it(`should reject ${name} callback without authorization code`, async () => {
        const mockState = await createMockOAuthState(name)

        const response = await fetch(
          `${testServer.url}${path}?state=${mockState.encryptedState}`,
          {
            redirect: "manual",
          },
        )

        expect(response.status).toBe(302)
        const location = response.headers.get("Location")
        expect(location).toContain("/auth/error")
        expect(location).toContain("No%20authorization%20code")
      })
    }

    // PKCE-specific tests for Google, X, and TikTok
    const pkceProviders: Array<{ name: OAuthProvider; path: string }> = [
      { name: "GOOGLE", path: "/auth/callback/google" },
      { name: "X", path: "/auth/callback/x" },
      { name: "TIKTOK", path: "/auth/callback/tiktok" },
    ]

    for (const { name, path } of pkceProviders) {
      it(`should reject ${name} callback without code verifier (PKCE)`, async () => {
        // Create state without code verifier
        const stateWithoutVerifier = await encryptOAuthState(name, undefined)

        const response = await fetch(
          `${testServer.url}${path}?code=test_code&state=${stateWithoutVerifier}`,
          {
            redirect: "manual",
          },
        )

        expect(response.status).toBe(302)
        const location = response.headers.get("Location")
        expect(location).toContain("/auth/error")
        expect(location).toContain("Missing%20code%20verifier")
      })
    }
  })

  describe("OAuth provider configuration", () => {
    it("should check if all test providers are configured", async () => {
      const { isProviderConfigured } = await import(
        "../../../src/server/auth/oauth"
      )

      expect(isProviderConfigured("GOOGLE")).toBe(true)
      expect(isProviderConfigured("FACEBOOK")).toBe(true)
      expect(isProviderConfigured("GITHUB")).toBe(true)
      expect(isProviderConfigured("X")).toBe(true)
      expect(isProviderConfigured("TIKTOK")).toBe(true)
      expect(isProviderConfigured("LINKEDIN")).toBe(true)
    })
  })

  describe("OAuth client initialization", () => {
    it("should create Google client with correct config", async () => {
      const { getGoogleClient } = await import("../../../src/server/auth/oauth")
      const client = getGoogleClient()
      expect(client).toBeDefined()
    })

    it("should create Facebook client with correct config", async () => {
      const { getFacebookClient } = await import(
        "../../../src/server/auth/oauth"
      )
      const client = getFacebookClient()
      expect(client).toBeDefined()
    })

    it("should create GitHub client with correct config", async () => {
      const { getGitHubClient } = await import("../../../src/server/auth/oauth")
      const client = getGitHubClient()
      expect(client).toBeDefined()
    })

    it("should create X client with correct config", async () => {
      const { getXClient } = await import("../../../src/server/auth/oauth")
      const client = getXClient()
      expect(client).toBeDefined()
    })

    it("should create TikTok client with correct config", async () => {
      const { getTikTokClient } = await import("../../../src/server/auth/oauth")
      const client = getTikTokClient()
      expect(client).toBeDefined()
    })

    it("should create LinkedIn client with correct config", async () => {
      const { getLinkedInClient } = await import(
        "../../../src/server/auth/oauth"
      )
      const client = getLinkedInClient()
      expect(client).toBeDefined()
    })
  })

  describe("Authorization URL generation", () => {
    const testState = "test-state-token-12345"

    it("should generate valid Google authorization params with PKCE", async () => {
      const { createGoogleAuthorizationParams } = await import(
        "../../../src/server/auth/oauth"
      )
      const params = createGoogleAuthorizationParams(testState)

      expect(params.url).toBeDefined()
      expect(params.state).toBe(testState)
      expect(params.codeVerifier).toBeTruthy()
      expect(params.url.toString()).toContain("code_challenge")
    })

    it("should generate valid Facebook authorization params without PKCE", async () => {
      const { createFacebookAuthorizationParams } = await import(
        "../../../src/server/auth/oauth"
      )
      const params = createFacebookAuthorizationParams(testState)

      expect(params.url).toBeDefined()
      expect(params.state).toBe(testState)
      expect(params.codeVerifier).toBeUndefined()
    })

    it("should generate valid GitHub authorization params without PKCE", async () => {
      const { createGitHubAuthorizationParams } = await import(
        "../../../src/server/auth/oauth"
      )
      const params = createGitHubAuthorizationParams(testState)

      expect(params.url).toBeDefined()
      expect(params.state).toBe(testState)
      expect(params.codeVerifier).toBeUndefined()
    })

    it("should generate valid X authorization params with PKCE", async () => {
      const { createXAuthorizationParams } = await import(
        "../../../src/server/auth/oauth"
      )
      const params = createXAuthorizationParams(testState)

      expect(params.url).toBeDefined()
      expect(params.state).toBe(testState)
      expect(params.codeVerifier).toBeTruthy()
    })

    it("should generate valid TikTok authorization params with PKCE", async () => {
      const { createTikTokAuthorizationParams } = await import(
        "../../../src/server/auth/oauth"
      )
      const params = createTikTokAuthorizationParams(testState)

      expect(params.url).toBeDefined()
      expect(params.state).toBe(testState)
      expect(params.codeVerifier).toBeTruthy()
    })

    it("should generate valid LinkedIn authorization params without PKCE", async () => {
      const { createLinkedInAuthorizationParams } = await import(
        "../../../src/server/auth/oauth"
      )
      const params = createLinkedInAuthorizationParams(testState)

      expect(params.url).toBeDefined()
      expect(params.state).toBe(testState)
      expect(params.codeVerifier).toBeUndefined()
    })
  })

  describe("Provider characteristics", () => {
    it("should have correct PKCE requirements per provider", async () => {
      const { OAUTH_PROVIDER_CONFIG } = await import(
        "../../../src/server/auth/oauth"
      )

      expect(OAUTH_PROVIDER_CONFIG.GOOGLE.requiresPkce).toBe(true)
      expect(OAUTH_PROVIDER_CONFIG.FACEBOOK.requiresPkce).toBe(false)
      expect(OAUTH_PROVIDER_CONFIG.GITHUB.requiresPkce).toBe(false)
      expect(OAUTH_PROVIDER_CONFIG.X.requiresPkce).toBe(true)
      expect(OAUTH_PROVIDER_CONFIG.TIKTOK.requiresPkce).toBe(true)
      expect(OAUTH_PROVIDER_CONFIG.LINKEDIN.requiresPkce).toBe(false)
    })

    it("should have correct email availability per provider", async () => {
      const { OAUTH_PROVIDER_CONFIG } = await import(
        "../../../src/server/auth/oauth"
      )

      expect(OAUTH_PROVIDER_CONFIG.GOOGLE.providesEmail).toBe(true)
      expect(OAUTH_PROVIDER_CONFIG.FACEBOOK.providesEmail).toBe(true)
      expect(OAUTH_PROVIDER_CONFIG.GITHUB.providesEmail).toBe(true)
      expect(OAUTH_PROVIDER_CONFIG.X.providesEmail).toBe(false)
      expect(OAUTH_PROVIDER_CONFIG.TIKTOK.providesEmail).toBe(false)
      expect(OAUTH_PROVIDER_CONFIG.LINKEDIN.providesEmail).toBe(true)
    })
  })

  describe("OAuth state encryption", () => {
    it("should encrypt and decrypt state correctly", async () => {
      const { encryptOAuthState, decryptOAuthState } = await import(
        "../../../src/server/auth/oauth-state"
      )

      const provider = "GOOGLE"
      const codeVerifier = "test-code-verifier-12345"

      const encrypted = await encryptOAuthState(provider, codeVerifier)
      expect(encrypted).toBeTruthy()
      expect(typeof encrypted).toBe("string")

      const decrypted = await decryptOAuthState(encrypted)
      expect(decrypted).not.toBeNull()
      expect(decrypted?.provider).toBe(provider)
      expect(decrypted?.codeVerifier).toBe(codeVerifier)
    })

    it("should return null for invalid encrypted state", async () => {
      const { decryptOAuthState } = await import(
        "../../../src/server/auth/oauth-state"
      )

      const result = await decryptOAuthState("invalid-encrypted-state")
      expect(result).toBeNull()
    })

    it("should return null for tampered encrypted state", async () => {
      const { encryptOAuthState, decryptOAuthState } = await import(
        "../../../src/server/auth/oauth-state"
      )

      const encrypted = await encryptOAuthState("GOOGLE", "test-verifier")
      // Tamper with the encrypted state
      const tampered = encrypted.slice(0, -5) + "XXXXX"

      const result = await decryptOAuthState(tampered)
      expect(result).toBeNull()
    })

    it("should handle state without code verifier", async () => {
      const { encryptOAuthState, decryptOAuthState } = await import(
        "../../../src/server/auth/oauth-state"
      )

      const encrypted = await encryptOAuthState("FACEBOOK", undefined)
      const decrypted = await decryptOAuthState(encrypted)

      expect(decrypted).not.toBeNull()
      expect(decrypted?.provider).toBe("FACEBOOK")
      expect(decrypted?.codeVerifier).toBeUndefined()
    })

    it("should encrypt and decrypt state with redirectUrl", async () => {
      const { encryptOAuthState, decryptOAuthState } = await import(
        "../../../src/server/auth/oauth-state"
      )

      const provider = "GOOGLE"
      const codeVerifier = "test-code-verifier-12345"
      const redirectUrl = "http://localhost:3000/dashboard"

      const encrypted = await encryptOAuthState(
        provider,
        codeVerifier,
        redirectUrl,
      )
      expect(encrypted).toBeTruthy()

      const decrypted = await decryptOAuthState(encrypted)
      expect(decrypted).not.toBeNull()
      expect(decrypted?.provider).toBe(provider)
      expect(decrypted?.codeVerifier).toBe(codeVerifier)
      expect(decrypted?.redirectUrl).toBe(redirectUrl)
    })

    it("should handle state without redirectUrl", async () => {
      const { encryptOAuthState, decryptOAuthState } = await import(
        "../../../src/server/auth/oauth-state"
      )

      const encrypted = await encryptOAuthState("GOOGLE", "test-verifier")
      const decrypted = await decryptOAuthState(encrypted)

      expect(decrypted).not.toBeNull()
      expect(decrypted?.provider).toBe("GOOGLE")
      expect(decrypted?.redirectUrl).toBeUndefined()
    })
  })
})
