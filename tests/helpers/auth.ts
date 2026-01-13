/**
 * Auth test helpers for Echo
 *
 * Utilities for testing authentication using viem for wallet operations,
 * SIWE for sign-in with Ethereum, and jose for JWT token management.
 */

import { jwtVerify, SignJWT } from "jose"
import { SiweMessage } from "siwe"
import { getAddress, isAddress } from "viem"
import {
  generatePrivateKey,
  type PrivateKeyAccount,
  privateKeyToAccount,
} from "viem/accounts"
import { AuthService } from "../../src/server/auth"
import {
  createEmailUserIfNotExists,
  createWeb3WalletUserIfNotExists,
} from "../../src/server/db/users"
import { generateVerificationCodeAndBlob } from "../../src/server/lib/emailVerification"
import type { ServerApp } from "../../src/server/types"
import { serverConfig } from "../../src/shared/config/server"
import type { NotificationData } from "../../src/shared/notifications/types"
import { testLogger } from "./logger"

export interface TestWallet {
  address: string
  privateKey: `0x${string}`
  account: PrivateKeyAccount
}

export interface AuthenticatedTestUser {
  wallet: TestWallet
  token: string
  siweMessage: SiweMessage
  signature: string
}

/**
 * Generate a random test wallet using viem
 */
export function generateTestWallet(): TestWallet {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)

  return {
    address: getAddress(account.address), // Checksummed address
    privateKey,
    account,
  }
}

/**
 * Create wallet from existing private key
 */
export function createWalletFromPrivateKey(
  privateKey: `0x${string}`,
): TestWallet {
  const account = privateKeyToAccount(privateKey)

  return {
    address: getAddress(account.address),
    privateKey,
    account,
  }
}

/**
 * Generate a random nonce for SIWE messages
 */
export function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15)
}

/**
 * Create a SIWE message for testing
 */
export function createSIWEMessage(
  address: string,
  options: {
    domain?: string
    uri?: string
    statement?: string
    version?: string
    chainId?: number
    nonce?: string
    issuedAt?: string
    expirationTime?: string
    notBefore?: string
    requestId?: string
    resources?: string[]
  } = {},
): SiweMessage {
  const {
    domain = "example.com",
    uri = "http://example.com:3002",
    statement = "Sign in to Echo",
    version = "1",
    chainId = 1,
    nonce = generateNonce(),
    issuedAt = new Date().toISOString(),
    expirationTime,
    notBefore,
    requestId,
    resources,
  } = options

  return new SiweMessage({
    domain,
    address: getAddress(address), // Ensure checksummed
    statement,
    uri,
    version,
    chainId,
    nonce,
    issuedAt,
    expirationTime,
    notBefore,
    requestId,
    resources,
  })
}

/**
 * Sign a SIWE message with a wallet
 */
export async function signSIWEMessage(
  message: SiweMessage,
  privateKey: `0x${string}`,
): Promise<string> {
  const account = privateKeyToAccount(privateKey)
  return await account.signMessage({
    message: message.prepareMessage(),
  })
}

/**
 * Get the correct JWT secret for the current environment
 * This must match exactly what AuthService uses in src/server/auth/index.ts
 */
function getJWTSecret(): string {
  // Always use the server configuration to ensure consistency
  return serverConfig.SESSION_ENCRYPTION_KEY
}

/**
 * Create a test JWT token
 */
export async function createTestJWT(
  web3Wallet: string | undefined,
  options: {
    expiresIn?: string
    secret?: string
    extraClaims?: Record<string, any>
  } = {},
): Promise<string> {
  const {
    expiresIn = "1h",
    secret = getJWTSecret(),
    extraClaims = {},
  } = options

  testLogger.debug(`Creating JWT for web3Wallet: ${web3Wallet || "none"}`)
  testLogger.debug(`Using expiresIn: ${expiresIn}`)

  const jwtSecret = new TextEncoder().encode(secret)

  return await new SignJWT({
    type: "auth", // Required type claim for auth tokens
    userId: 1, // Default test user ID
    ...(web3Wallet && { web3_wallet: web3Wallet.toLowerCase() }),
    iat: Math.floor(Date.now() / 1000),
    ...extraClaims,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .sign(jwtSecret)
}

/**
 * Create an expired JWT token
 */
export async function createExpiredJWT(web3Wallet?: string): Promise<string> {
  return await createTestJWT(web3Wallet, {
    expiresIn: "-1h", // Already expired
  })
}

/**
 * Create various malformed JWT tokens for testing
 */
export async function createMalformedJWT(
  type:
    | "invalid-signature"
    | "wrong-secret"
    | "missing-wallet"
    | "missing-userId"
    | "invalid-format",
): Promise<string> {
  switch (type) {
    case "invalid-signature": {
      const validToken = await createTestJWT(
        "0x1234567890123456789012345678901234567890",
      )
      // Completely corrupt the signature part to ensure it fails validation
      const parts = validToken.split(".")
      const signature = parts[2]
      if (!signature) throw new Error("Invalid token format")

      // Create a completely different signature by changing multiple characters
      let corruptedSignature = signature
        .replace(/[a-z]/g, "X")
        .replace(/[A-Z]/g, "Y")
        .replace(/[0-9]/g, "9")
        .replace(/-/g, "_")
        .replace(/_/g, "-")

      // If no changes were made, force corruption
      if (corruptedSignature === signature) {
        corruptedSignature = "INVALID_SIGNATURE_" + signature.slice(16)
      }

      return `${parts[0]}.${parts[1]}.${corruptedSignature}`
    }

    case "wrong-secret":
      return await createTestJWT("0x1234567890123456789012345678901234567890", {
        secret: "completely_different_secret_that_will_fail_validation_32chars",
      })

    case "missing-wallet": {
      // Create a token without the wallet field entirely (valid for email users)
      const jwtSecret = new TextEncoder().encode(getJWTSecret())
      return await new SignJWT({
        type: "auth",
        userId: 1,
        iat: Math.floor(Date.now() / 1000),
        // wallet field is missing entirely
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .sign(jwtSecret)
    }

    case "missing-userId": {
      // Create a token without the userId field entirely
      const jwtSecret = new TextEncoder().encode(getJWTSecret())
      return await new SignJWT({
        type: "auth",
        wallet: "0x1234567890123456789012345678901234567890",
        iat: Math.floor(Date.now() / 1000),
        // userId field is missing entirely
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("1h")
        .sign(jwtSecret)
    }

    case "invalid-format":
      return "not.a.valid.jwt.token"

    default:
      throw new Error(`Unknown malformed JWT type: ${type}`)
  }
}

/**
 * Decode a JWT token for inspection (without verification)
 */
export function decodeJWT(token: string): any {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format")
    }

    const payload = parts[1]
    if (!payload) throw new Error("Invalid JWT payload")
    const decoded = Buffer.from(payload, "base64url").toString("utf-8")
    return JSON.parse(decoded)
  } catch (error) {
    throw new Error(`Failed to decode JWT: ${error}`)
  }
}

/**
 * Create an Authorization header with Bearer token
 */
export function createAuthHeader(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  }
}

/**
 * Create a simple authenticated test user with direct JWT creation (for faster tests)
 */
export async function createSimpleAuthenticatedTestUser(): Promise<{
  wallet: TestWallet
  token: string
}> {
  const wallet = generateTestWallet()
  const token = await createTestJWT(wallet.address)

  return {
    wallet,
    token,
  }
}

/**
 * Create a mock ServerApp for testing auth functions
 */
function createMockServerApp(): ServerApp {
  return {
    app: {} as any,
    db: {} as any,
    rootLogger: testLogger,
    createLogger: (category: string) => testLogger.child(category),
    startSpan: (() => {
      // Mock implementation
    }) as any,
    workerManager: {} as any,
    socketManager: {} as any,
    createNotification: async (
      userId: number,
      notificationData: NotificationData,
    ) => {
      // Mock implementation for tests
    },
  }
}

/**
 * Create a fully authenticated test user with real SIWE flow
 */
export async function createAuthenticatedTestUser(
  options: {
    domain?: string
    chainId?: number
    expirationTime?: string
    serverApp?: ServerApp
  } = {},
): Promise<AuthenticatedTestUser> {
  // Generate test wallet
  const wallet = generateTestWallet()

  // Create SIWE message
  const siweMessage = createSIWEMessage(wallet.address, options)

  // Sign the message
  const signature = await signSIWEMessage(siweMessage, wallet.privateKey)

  // Use provided ServerApp or create mock one
  const serverApp = options.serverApp || createMockServerApp()
  const authService = new AuthService(serverApp)

  // Create user in database if using real ServerApp
  if (options.serverApp) {
    await createWeb3WalletUserIfNotExists(options.serverApp.db, wallet.address)
  }

  // Authenticate through the real auth system to get JWT
  const { token } = await authService.authenticateWithSiwe(
    siweMessage.prepareMessage(),
    signature,
  )

  return {
    wallet,
    token,
    siweMessage,
    signature,
  }
}

/**
 * Create multiple test users for testing scenarios
 */
export async function createMultipleTestUsers(
  count: number,
  options: {
    domain?: string
    chainId?: number
    expirationTime?: string
    serverApp?: ServerApp
  } = {},
): Promise<AuthenticatedTestUser[]> {
  const users: AuthenticatedTestUser[] = []

  for (let i = 0; i < count; i++) {
    const user = await createAuthenticatedTestUser(options)
    users.push(user)
  }

  return users
}

/**
 * Validate if a string is a valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return isAddress(address)
}

/**
 * Get checksummed version of an address
 */
export function checksumAddress(address: string): string {
  return getAddress(address)
}

/**
 * Create test data for different wallet scenarios
 */
export const TEST_WALLETS = {
  // Well-known test private keys (never use in production)
  hardhat: {
    privateKey:
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  },
  anvil: {
    privateKey:
      "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
    address: "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955",
  },
} as const

/**
 * Get a predefined test wallet
 */
export function getPredefinedTestWallet(
  name: keyof typeof TEST_WALLETS,
): TestWallet {
  const walletData = TEST_WALLETS[name]
  return createWalletFromPrivateKey(walletData.privateKey as `0x${string}`)
}

/**
 * Verify a JWT token (for testing token validation)
 */
export async function verifyTestJWT(
  token: string,
  secret: string = getJWTSecret(),
): Promise<any> {
  const jwtSecret = new TextEncoder().encode(secret)
  const { payload } = await jwtVerify(token, jwtSecret)
  return payload
}

/**
 * Create GraphQL request helpers with authentication
 */
export function createGraphQLRequest(
  query: string,
  variables?: Record<string, any>,
  authToken?: string,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  }

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`
  }

  return {
    method: "POST",
    headers,
    body: JSON.stringify({
      query,
      variables,
    }),
  }
}

/**
 * Wait for a promise with timeout (useful for testing)
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ])
}

/**
 * Email authentication test helpers
 */
export interface EmailAuthTestData {
  email: string
  code: string
  blob: string
}

/**
 * Generate a random test email address
 */
export function generateTestEmail(): string {
  const random = Math.random().toString(36).substring(2, 10)
  return `test-${random}@example.com`
}

/**
 * Generate email verification code and blob for testing
 */
export async function generateTestEmailVerification(
  email: string,
): Promise<EmailAuthTestData> {
  const { code, blob } = await generateVerificationCodeAndBlob(
    testLogger,
    email,
  )
  return { email, code, blob }
}

/**
 * Create an authenticated test user via email auth
 */
export async function createEmailAuthenticatedTestUser(
  serverApp: ServerApp,
  email?: string,
): Promise<{ email: string; token: string; userId: number }> {
  const testEmail = email || generateTestEmail()

  // Create user in database first
  const user = await createEmailUserIfNotExists(serverApp.db, testEmail)

  // Create JWT token (no web3Wallet for email users)
  const token = await createTestJWT(undefined, {
    extraClaims: { userId: user.id },
  })

  return {
    email: testEmail,
    token,
    userId: user.id,
  }
}

/**
 * OAuth test helpers
 */
import { generateCodeVerifier } from "arctic"
import type { OAuthProvider } from "../../src/server/auth/oauth"
import { encryptOAuthState } from "../../src/server/auth/oauth-state"

export interface MockOAuthState {
  encryptedState: string
  codeVerifier?: string
  provider: OAuthProvider
}

/**
 * Create mock OAuth state for testing (uses encrypted state)
 */
export async function createMockOAuthState(
  provider: OAuthProvider,
  includeCodeVerifier = true,
  redirectUrl?: string,
): Promise<MockOAuthState> {
  const codeVerifier = includeCodeVerifier ? generateCodeVerifier() : undefined
  const encryptedState = await encryptOAuthState(
    provider,
    codeVerifier,
    redirectUrl,
  )
  return {
    encryptedState,
    codeVerifier,
    provider,
  }
}

/**
 * Mock OAuth user info for different providers
 */
export interface MockOAuthUserInfo {
  id: string
  email?: string
  name?: string
}

export function createMockOAuthUserInfo(
  provider: OAuthProvider,
  overrides: Partial<MockOAuthUserInfo> = {},
): MockOAuthUserInfo {
  const baseInfo: MockOAuthUserInfo = {
    id: `mock-${provider.toLowerCase()}-user-${Math.random().toString(36).substring(2, 10)}`,
    name: `Mock ${provider} User`,
  }

  // Providers that provide email
  if (["GOOGLE", "FACEBOOK", "GITHUB", "LINKEDIN"].includes(provider)) {
    baseInfo.email = `mock-${provider.toLowerCase()}-${Math.random().toString(36).substring(2, 10)}@example.com`
  }

  return { ...baseInfo, ...overrides }
}

/**
 * Create a GraphQL request for OAuth login URL
 */
export function createOAuthLoginUrlRequest(
  provider: OAuthProvider,
  authToken?: string,
  redirectUrl?: string,
) {
  return createGraphQLRequest(
    `
    mutation GetOAuthLoginUrl($provider: OAuthProvider!, $redirectUrl: String) {
      getOAuthLoginUrl(provider: $provider, redirectUrl: $redirectUrl) {
        success
        url
        provider
        error
      }
    }
  `,
    { provider, redirectUrl },
    authToken,
  )
}
