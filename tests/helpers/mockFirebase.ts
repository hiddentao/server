/**
 * Mock Firebase helpers for testing
 *
 * Since firebase-admin uses its own internal verification,
 * we mock the verifyFirebaseToken function by injecting a test mode.
 */

import { SignJWT } from "jose"
import {
  setMockFirebaseVerify,
  type VerifiedFirebaseToken,
} from "../../src/server/lib/firebase"
import { testLogger } from "./logger"

export interface MockFirebaseToken {
  idToken: string
  uid: string
  phoneNumber?: string
  email?: string
}

/**
 * Generate a mock Firebase ID token for testing
 * This creates a JWT that looks like a Firebase token but is not cryptographically valid
 * Use with mocked verifyFirebaseToken function
 */
export async function generateMockFirebaseToken(options: {
  uid?: string
  phoneNumber?: string
  email?: string
  projectId?: string
  expiresIn?: string
}): Promise<MockFirebaseToken> {
  const {
    uid = `test-uid-${Date.now()}`,
    phoneNumber,
    email,
    projectId = "test-project",
    expiresIn = "1h",
  } = options

  const now = Math.floor(Date.now() / 1000)

  const payload: Record<string, any> = {
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    auth_time: now,
    user_id: uid,
    sub: uid,
    iat: now,
    firebase: {
      identities: {},
      sign_in_provider: phoneNumber ? "phone" : email ? "password" : "custom",
    },
  }

  if (phoneNumber) {
    payload.phone_number = phoneNumber
    payload.firebase.identities.phone = [phoneNumber]
  }

  if (email) {
    payload.email = email
    payload.email_verified = true
    payload.firebase.identities.email = [email]
  }

  const secret = new TextEncoder().encode(
    "mock-firebase-secret-key-for-testing",
  )

  const idToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", kid: "mock-key-id" })
    .setExpirationTime(expiresIn)
    .sign(secret)

  testLogger.debug(`Generated mock Firebase token for uid: ${uid}`)

  return {
    idToken,
    uid,
    phoneNumber,
    email,
  }
}

/**
 * Decode a mock Firebase token (without verification)
 */
export function decodeMockFirebaseToken(idToken: string): {
  uid: string
  phoneNumber?: string
  email?: string
} {
  const parts = idToken.split(".")
  if (parts.length !== 3 || !parts[1]) {
    throw new Error("Invalid token format")
  }

  const payload = JSON.parse(
    Buffer.from(parts[1], "base64url").toString("utf-8"),
  )

  return {
    uid: payload.sub,
    phoneNumber: payload.phone_number,
    email: payload.email,
  }
}

/**
 * Mock verified token result that matches what verifyFirebaseToken returns
 */
export interface MockVerifiedToken {
  uid: string
  phoneNumber?: string
  email?: string
}

/**
 * Map to store mock token verifications
 * Key: idToken, Value: verification result
 */
const mockTokenVerifications = new Map<string, MockVerifiedToken>()

/**
 * Register a mock token for verification
 */
export function registerMockFirebaseToken(
  idToken: string,
  verificationResult: MockVerifiedToken,
): void {
  mockTokenVerifications.set(idToken, verificationResult)
  testLogger.debug(
    `Registered mock Firebase token verification for uid: ${verificationResult.uid}`,
  )
}

/**
 * Get the mock verification result for a token
 */
export function getMockFirebaseVerification(
  idToken: string,
): MockVerifiedToken | undefined {
  return mockTokenVerifications.get(idToken)
}

/**
 * Clear all registered mock tokens
 */
export function clearMockFirebaseTokens(): void {
  mockTokenVerifications.clear()
  testLogger.debug("Cleared all mock Firebase token registrations")
}

/**
 * Enable mock Firebase verification for testing
 */
export function enableFirebaseTestMode(): void {
  setMockFirebaseVerify(
    (idToken: string): VerifiedFirebaseToken | undefined => {
      return mockTokenVerifications.get(idToken)
    },
  )
  testLogger.debug("Firebase test mode enabled")
}

/**
 * Disable mock Firebase verification
 */
export function disableFirebaseTestMode(): void {
  setMockFirebaseVerify(null)
  mockTokenVerifications.clear()
  testLogger.debug("Firebase test mode disabled")
}

/**
 * Configure mock Firebase environment variables for testing
 */
export function configureMockFirebaseEnv(): void {
  process.env.FIREBASE_PROJECT_ID = "test-project"
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({
    type: "service_account",
    project_id: "test-project",
    private_key_id: "test-key-id",
    private_key:
      "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----\n",
    client_email: "test@test-project.iam.gserviceaccount.com",
    client_id: "123456789",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
  })
}

/**
 * Clear mock Firebase environment variables
 */
export function clearMockFirebaseEnv(): void {
  delete process.env.FIREBASE_PROJECT_ID
  delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY
}
