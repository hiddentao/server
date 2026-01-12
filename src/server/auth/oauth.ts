/**
 * OAuth provider integration using Arctic library
 *
 * Supports: Google, Facebook, GitHub, X (Twitter), TikTok, LinkedIn
 */

import { serverConfig } from "@shared/config/server"
import { OAUTH_METHOD, type OAuthMethod } from "@shared/constants"
import {
  decodeIdToken,
  Facebook,
  GitHub,
  Google,
  generateCodeVerifier,
  LinkedIn,
  TikTok,
  Twitter,
} from "arctic"

// OAuth provider enum matching GraphQL schema
export const OAUTH_PROVIDER = {
  GOOGLE: "GOOGLE",
  FACEBOOK: "FACEBOOK",
  GITHUB: "GITHUB",
  X: "X",
  TIKTOK: "TIKTOK",
  LINKEDIN: "LINKEDIN",
} as const

export type OAuthProvider = (typeof OAUTH_PROVIDER)[keyof typeof OAUTH_PROVIDER]

// Provider characteristics
export const OAUTH_PROVIDER_CONFIG: Record<
  OAuthProvider,
  {
    authMethod: OAuthMethod
    requiresPkce: boolean
    providesEmail: boolean
  }
> = {
  GOOGLE: {
    authMethod: OAUTH_METHOD.GOOGLE,
    requiresPkce: true,
    providesEmail: true,
  },
  FACEBOOK: {
    authMethod: OAUTH_METHOD.FACEBOOK,
    requiresPkce: false,
    providesEmail: true,
  },
  GITHUB: {
    authMethod: OAUTH_METHOD.GITHUB,
    requiresPkce: false,
    providesEmail: true,
  },
  X: {
    authMethod: OAUTH_METHOD.X,
    requiresPkce: true,
    providesEmail: false,
  },
  TIKTOK: {
    authMethod: OAUTH_METHOD.TIKTOK,
    requiresPkce: true,
    providesEmail: false,
  },
  LINKEDIN: {
    authMethod: OAUTH_METHOD.LINKEDIN,
    requiresPkce: false,
    providesEmail: true,
  },
}

// Custom error classes
export class OAuthConfigError extends Error {
  constructor(
    public provider: OAuthProvider,
    message: string,
  ) {
    super(`OAuth config error for ${provider}: ${message}`)
    this.name = "OAuthConfigError"
  }
}

export class OAuthProviderError extends Error {
  constructor(
    public provider: OAuthProvider,
    message: string,
    public cause?: Error,
  ) {
    super(`OAuth provider error for ${provider}: ${message}`)
    this.name = "OAuthProviderError"
  }
}

// Lazy-initialized client cache
let googleClient: Google | null = null
let facebookClient: Facebook | null = null
let githubClient: GitHub | null = null
let xClient: Twitter | null = null
let tiktokClient: TikTok | null = null
let linkedinClient: LinkedIn | null = null

function getRedirectUri(provider: OAuthProvider): string {
  const baseUrl = serverConfig.OAUTH_CALLBACK_BASE_URL
  if (!baseUrl) {
    throw new OAuthConfigError(
      provider,
      "OAUTH_CALLBACK_BASE_URL not configured",
    )
  }
  return `${baseUrl}/auth/callback/${provider.toLowerCase()}`
}

// Client getters with lazy initialization
export function getGoogleClient(): Google {
  if (!googleClient) {
    const clientId = serverConfig.OAUTH_GOOGLE_CLIENT_ID
    const clientSecret = serverConfig.OAUTH_GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new OAuthConfigError("GOOGLE", "Missing client ID or secret")
    }
    googleClient = new Google(clientId, clientSecret, getRedirectUri("GOOGLE"))
  }
  return googleClient
}

export function getFacebookClient(): Facebook {
  if (!facebookClient) {
    const clientId = serverConfig.OAUTH_FACEBOOK_CLIENT_ID
    const clientSecret = serverConfig.OAUTH_FACEBOOK_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new OAuthConfigError("FACEBOOK", "Missing client ID or secret")
    }
    facebookClient = new Facebook(
      clientId,
      clientSecret,
      getRedirectUri("FACEBOOK"),
    )
  }
  return facebookClient
}

export function getGitHubClient(): GitHub {
  if (!githubClient) {
    const clientId = serverConfig.OAUTH_GITHUB_CLIENT_ID
    const clientSecret = serverConfig.OAUTH_GITHUB_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new OAuthConfigError("GITHUB", "Missing client ID or secret")
    }
    githubClient = new GitHub(clientId, clientSecret, getRedirectUri("GITHUB"))
  }
  return githubClient
}

export function getXClient(): Twitter {
  if (!xClient) {
    const clientId = serverConfig.OAUTH_X_CLIENT_ID
    const clientSecret = serverConfig.OAUTH_X_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new OAuthConfigError("X", "Missing client ID or secret")
    }
    xClient = new Twitter(clientId, clientSecret, getRedirectUri("X"))
  }
  return xClient
}

export function getTikTokClient(): TikTok {
  if (!tiktokClient) {
    const clientKey = serverConfig.OAUTH_TIKTOK_CLIENT_KEY
    const clientSecret = serverConfig.OAUTH_TIKTOK_CLIENT_SECRET
    if (!clientKey || !clientSecret) {
      throw new OAuthConfigError("TIKTOK", "Missing client key or secret")
    }
    tiktokClient = new TikTok(clientKey, clientSecret, getRedirectUri("TIKTOK"))
  }
  return tiktokClient
}

export function getLinkedInClient(): LinkedIn {
  if (!linkedinClient) {
    const clientId = serverConfig.OAUTH_LINKEDIN_CLIENT_ID
    const clientSecret = serverConfig.OAUTH_LINKEDIN_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new OAuthConfigError("LINKEDIN", "Missing client ID or secret")
    }
    linkedinClient = new LinkedIn(
      clientId,
      clientSecret,
      getRedirectUri("LINKEDIN"),
    )
  }
  return linkedinClient
}

// Check if a provider is configured
export function isProviderConfigured(provider: OAuthProvider): boolean {
  try {
    switch (provider) {
      case "GOOGLE":
        return !!(
          serverConfig.OAUTH_GOOGLE_CLIENT_ID &&
          serverConfig.OAUTH_GOOGLE_CLIENT_SECRET
        )
      case "FACEBOOK":
        return !!(
          serverConfig.OAUTH_FACEBOOK_CLIENT_ID &&
          serverConfig.OAUTH_FACEBOOK_CLIENT_SECRET
        )
      case "GITHUB":
        return !!(
          serverConfig.OAUTH_GITHUB_CLIENT_ID &&
          serverConfig.OAUTH_GITHUB_CLIENT_SECRET
        )
      case "X":
        return !!(
          serverConfig.OAUTH_X_CLIENT_ID && serverConfig.OAUTH_X_CLIENT_SECRET
        )
      case "TIKTOK":
        return !!(
          serverConfig.OAUTH_TIKTOK_CLIENT_KEY &&
          serverConfig.OAUTH_TIKTOK_CLIENT_SECRET
        )
      case "LINKEDIN":
        return !!(
          serverConfig.OAUTH_LINKEDIN_CLIENT_ID &&
          serverConfig.OAUTH_LINKEDIN_CLIENT_SECRET
        )
      default:
        return false
    }
  } catch {
    return false
  }
}

// Authorization URL generation
export interface AuthorizationParams {
  url: URL
  state: string
  codeVerifier?: string
}

export function createGoogleAuthorizationParams(
  state: string,
): AuthorizationParams {
  const client = getGoogleClient()
  const codeVerifier = generateCodeVerifier()
  const scopes = ["openid", "profile", "email"]
  const url = client.createAuthorizationURL(state, codeVerifier, scopes)
  return { url, state, codeVerifier }
}

export function createFacebookAuthorizationParams(
  state: string,
): AuthorizationParams {
  const client = getFacebookClient()
  const scopes = ["email", "public_profile"]
  const url = client.createAuthorizationURL(state, scopes)
  return { url, state }
}

export function createGitHubAuthorizationParams(
  state: string,
): AuthorizationParams {
  const client = getGitHubClient()
  const scopes = ["user:email"]
  const url = client.createAuthorizationURL(state, scopes)
  return { url, state }
}

export function createXAuthorizationParams(state: string): AuthorizationParams {
  const client = getXClient()
  const codeVerifier = generateCodeVerifier()
  const scopes = ["users.read", "tweet.read"]
  const url = client.createAuthorizationURL(state, codeVerifier, scopes)
  return { url, state, codeVerifier }
}

export function createTikTokAuthorizationParams(
  state: string,
): AuthorizationParams {
  const client = getTikTokClient()
  const codeVerifier = generateCodeVerifier()
  const scopes = ["user.info.basic"]
  const url = client.createAuthorizationURL(state, codeVerifier, scopes)
  return { url, state, codeVerifier }
}

export function createLinkedInAuthorizationParams(
  state: string,
): AuthorizationParams {
  const client = getLinkedInClient()
  const scopes = ["openid", "profile", "email"]
  const url = client.createAuthorizationURL(state, scopes)
  return { url, state }
}

export function createAuthorizationParams(
  provider: OAuthProvider,
  state: string,
): AuthorizationParams {
  switch (provider) {
    case "GOOGLE":
      return createGoogleAuthorizationParams(state)
    case "FACEBOOK":
      return createFacebookAuthorizationParams(state)
    case "GITHUB":
      return createGitHubAuthorizationParams(state)
    case "X":
      return createXAuthorizationParams(state)
    case "TIKTOK":
      return createTikTokAuthorizationParams(state)
    case "LINKEDIN":
      return createLinkedInAuthorizationParams(state)
    default:
      throw new OAuthConfigError(provider, "Unknown provider")
  }
}

// Code exchange
export interface OAuthTokens {
  accessToken: string
  idToken?: string
  refreshToken?: string
}

export async function exchangeGoogleCode(
  code: string,
  codeVerifier: string,
): Promise<OAuthTokens> {
  const client = getGoogleClient()
  const tokens = await client.validateAuthorizationCode(code, codeVerifier)
  return {
    accessToken: tokens.accessToken(),
    idToken: tokens.idToken(),
    refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : undefined,
  }
}

export async function exchangeFacebookCode(code: string): Promise<OAuthTokens> {
  const client = getFacebookClient()
  const tokens = await client.validateAuthorizationCode(code)
  return {
    accessToken: tokens.accessToken(),
  }
}

export async function exchangeGitHubCode(code: string): Promise<OAuthTokens> {
  const client = getGitHubClient()
  const tokens = await client.validateAuthorizationCode(code)
  return {
    accessToken: tokens.accessToken(),
  }
}

export async function exchangeXCode(
  code: string,
  codeVerifier: string,
): Promise<OAuthTokens> {
  const client = getXClient()
  const tokens = await client.validateAuthorizationCode(code, codeVerifier)
  return {
    accessToken: tokens.accessToken(),
    refreshToken: tokens.refreshToken(),
  }
}

export async function exchangeTikTokCode(
  code: string,
  codeVerifier: string,
): Promise<OAuthTokens> {
  const client = getTikTokClient()
  const tokens = await client.validateAuthorizationCode(code, codeVerifier)
  return {
    accessToken: tokens.accessToken(),
    refreshToken: tokens.refreshToken(),
  }
}

export async function exchangeLinkedInCode(code: string): Promise<OAuthTokens> {
  const client = getLinkedInClient()
  const tokens = await client.validateAuthorizationCode(code)
  return {
    accessToken: tokens.accessToken(),
    idToken: tokens.idToken(),
    refreshToken: tokens.refreshToken(),
  }
}

// User info fetching
export interface OAuthUserInfo {
  id: string
  email?: string
  name?: string
}

export async function fetchGoogleUserInfo(
  idToken: string,
): Promise<OAuthUserInfo> {
  const claims = decodeIdToken(idToken) as {
    sub: string
    email?: string
    name?: string
  }
  return {
    id: claims.sub,
    email: claims.email,
    name: claims.name,
  }
}

export async function fetchFacebookUserInfo(
  accessToken: string,
): Promise<OAuthUserInfo> {
  const params = new URLSearchParams()
  params.set("access_token", accessToken)
  params.set("fields", "id,name,email")

  const response = await fetch(`https://graph.facebook.com/me?${params}`)
  if (!response.ok) {
    throw new OAuthProviderError(
      "FACEBOOK",
      `Failed to fetch user info: ${response.status}`,
    )
  }

  const user = (await response.json()) as {
    id: string
    name?: string
    email?: string
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  }
}

export async function fetchGitHubUserInfo(
  accessToken: string,
): Promise<OAuthUserInfo> {
  // Fetch user profile
  const userResponse = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!userResponse.ok) {
    throw new OAuthProviderError(
      "GITHUB",
      `Failed to fetch user info: ${userResponse.status}`,
    )
  }
  const user = (await userResponse.json()) as {
    id: number
    name?: string
    email?: string
  }

  // If no email in profile, fetch from emails endpoint
  let email = user.email
  if (!email) {
    const emailsResponse = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (emailsResponse.ok) {
      const emails = (await emailsResponse.json()) as Array<{
        email: string
        primary: boolean
        verified: boolean
      }>
      const primaryEmail = emails.find((e) => e.primary && e.verified)
      email = primaryEmail?.email
    }
  }

  return {
    id: String(user.id),
    email,
    name: user.name,
  }
}

export async function fetchXUserInfo(
  accessToken: string,
): Promise<OAuthUserInfo> {
  const response = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new OAuthProviderError(
      "X",
      `Failed to fetch user info: ${response.status}`,
    )
  }

  const data = (await response.json()) as {
    data: { id: string; name?: string; username?: string }
  }
  return {
    id: data.data.id,
    name: data.data.name || data.data.username,
  }
}

export async function fetchTikTokUserInfo(
  accessToken: string,
): Promise<OAuthUserInfo> {
  const response = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )
  if (!response.ok) {
    throw new OAuthProviderError(
      "TIKTOK",
      `Failed to fetch user info: ${response.status}`,
    )
  }

  const data = (await response.json()) as {
    data: { user: { open_id: string; display_name?: string } }
  }
  return {
    id: data.data.user.open_id,
    name: data.data.user.display_name,
  }
}

export async function fetchLinkedInUserInfo(
  idToken: string,
): Promise<OAuthUserInfo> {
  const claims = decodeIdToken(idToken) as {
    sub: string
    email?: string
    name?: string
  }
  return {
    id: claims.sub,
    email: claims.email,
    name: claims.name,
  }
}

// Unified interface for OAuth flow
export async function exchangeCodeAndFetchUserInfo(
  provider: OAuthProvider,
  code: string,
  codeVerifier?: string,
): Promise<OAuthUserInfo> {
  switch (provider) {
    case "GOOGLE": {
      if (!codeVerifier) {
        throw new OAuthProviderError(
          "GOOGLE",
          "Code verifier required for PKCE",
        )
      }
      const tokens = await exchangeGoogleCode(code, codeVerifier)
      if (!tokens.idToken) {
        throw new OAuthProviderError("GOOGLE", "No ID token received")
      }
      return fetchGoogleUserInfo(tokens.idToken)
    }
    case "FACEBOOK": {
      const tokens = await exchangeFacebookCode(code)
      return fetchFacebookUserInfo(tokens.accessToken)
    }
    case "GITHUB": {
      const tokens = await exchangeGitHubCode(code)
      return fetchGitHubUserInfo(tokens.accessToken)
    }
    case "X": {
      if (!codeVerifier) {
        throw new OAuthProviderError("X", "Code verifier required for PKCE")
      }
      const tokens = await exchangeXCode(code, codeVerifier)
      return fetchXUserInfo(tokens.accessToken)
    }
    case "TIKTOK": {
      if (!codeVerifier) {
        throw new OAuthProviderError(
          "TIKTOK",
          "Code verifier required for PKCE",
        )
      }
      const tokens = await exchangeTikTokCode(code, codeVerifier)
      return fetchTikTokUserInfo(tokens.accessToken)
    }
    case "LINKEDIN": {
      const tokens = await exchangeLinkedInCode(code)
      if (!tokens.idToken) {
        throw new OAuthProviderError("LINKEDIN", "No ID token received")
      }
      return fetchLinkedInUserInfo(tokens.idToken)
    }
    default:
      throw new OAuthConfigError(provider, "Unknown provider")
  }
}

// Reset clients for testing
export function resetOAuthClients(): void {
  googleClient = null
  facebookClient = null
  githubClient = null
  xClient = null
  tiktokClient = null
  linkedinClient = null
}
