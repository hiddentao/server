import type { ServiceAccount } from "firebase-admin/app"
import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { serverConfig } from "../../shared/config/server"
import type { Logger } from "./logger"

export interface VerifiedFirebaseToken {
  uid: string
  phoneNumber?: string
  email?: string
}

let firebaseInitialized = false

type MockVerifyFn = (idToken: string) => VerifiedFirebaseToken | undefined
let mockVerifyFunction: MockVerifyFn | null = null

/**
 * Set a mock verification function for testing
 */
export function setMockFirebaseVerify(fn: MockVerifyFn | null): void {
  mockVerifyFunction = fn
}

/**
 * Check if Firebase is configured (or mocked for testing)
 */
export function isFirebaseConfigured(): boolean {
  if (mockVerifyFunction) {
    return true
  }
  return !!(
    serverConfig.FIREBASE_PROJECT_ID &&
    serverConfig.FIREBASE_SERVICE_ACCOUNT_KEY
  )
}

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase(): void {
  if (firebaseInitialized || getApps().length > 0) {
    return
  }

  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured")
  }

  const serviceAccount =
    serverConfig.FIREBASE_SERVICE_ACCOUNT_KEY! as ServiceAccount

  initializeApp({
    credential: cert(serviceAccount),
    projectId: serverConfig.FIREBASE_PROJECT_ID,
  })

  firebaseInitialized = true
}

/**
 * Reset Firebase initialization (useful for testing)
 */
export function resetFirebaseInitialization(): void {
  firebaseInitialized = false
}

/**
 * Verify a Firebase ID token
 */
export async function verifyFirebaseToken(
  logger: Logger,
  idToken: string,
): Promise<VerifiedFirebaseToken> {
  if (mockVerifyFunction) {
    const result = mockVerifyFunction(idToken)
    if (result) {
      logger.debug("Firebase token verified via mock", { uid: result.uid })
      return result
    }
    throw new Error("Mock Firebase verification failed - token not registered")
  }

  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured")
  }

  try {
    initializeFirebase()

    const decodedToken = await getAuth().verifyIdToken(idToken)

    logger.debug("Firebase token verified successfully", {
      uid: decodedToken.uid,
    })

    return {
      uid: decodedToken.uid,
      phoneNumber: decodedToken.phone_number,
      email: decodedToken.email,
    }
  } catch (error) {
    logger.error("Firebase token verification failed", { error })
    throw error
  }
}
