import { GraphQLError } from "graphql"
import { jwtVerify, SignJWT } from "jose"
import { SiweMessage } from "siwe"
import { clientConfig } from "../../shared/config/client"
import { serverConfig } from "../../shared/config/server"
import { type OAuthMethod } from "../../shared/constants"
import { GraphQLErrorCode } from "../../shared/graphql/errors"
import {
  createEmailUserIfNotExists,
  createOAuthUserIfNotExists,
  createPhoneUserIfNotExists,
  createWeb3WalletUserIfNotExists,
  getUserById,
  getUserWeb3Wallet,
} from "../db/users"
import { verifyCodeWithBlob } from "../lib/emailVerification"
import { AccountDisabledError } from "../lib/errors"
import { isFirebaseConfigured, verifyFirebaseToken } from "../lib/firebase"
import type { Logger } from "../lib/logger"
import { LOG_CATEGORIES } from "../lib/logger"
import type { ServerApp } from "../types"

function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(serverConfig.SESSION_ENCRYPTION_KEY)
}

export interface AuthenticatedUser {
  id: number
  web3Wallet?: string
}

export interface AuthenticationResult {
  token: string
  user: AuthenticatedUser
}

/**
 * Authentication service for handling SIWE, email, OAuth, and JWT token operations
 */
export class AuthService {
  private logger: Logger

  constructor(private serverApp: ServerApp) {
    this.logger = serverApp.createLogger(LOG_CATEGORIES.AUTH)
  }

  /**
   * Generate JWT token for a user
   */
  private async generateToken(
    userId: number,
    web3Wallet?: string,
  ): Promise<string> {
    const now = Date.now()
    const payload: Record<string, unknown> = {
      type: "auth",
      userId,
      iat: Math.floor(now / 1000),
      iatMs: now,
      jti: `${now}-${Math.random().toString(36).substring(2, 11)}`,
    }

    if (web3Wallet) {
      payload.web3_wallet = web3Wallet
    }

    return new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(getJwtSecret())
  }

  /**
   * Check if user is disabled and throw if so
   */
  private async checkUserNotDisabled(userId: number): Promise<void> {
    const user = await getUserById(this.serverApp.db, userId)
    if (user?.disabled) {
      this.logger.debug(`User ${userId} is disabled, blocking authentication`)
      throw new GraphQLError("Account is disabled", {
        extensions: { code: GraphQLErrorCode.ACCOUNT_DISABLED },
      })
    }
  }

  /**
   * Verify SIWE message and signature, return JWT token
   * Only available when WEB3_ENABLED=true
   */
  async authenticateWithSiwe(
    message: string,
    signature: string,
  ): Promise<AuthenticationResult> {
    if (!clientConfig.WEB3_ENABLED) {
      throw new GraphQLError("Web3 authentication is not enabled", {
        extensions: { code: GraphQLErrorCode.AUTHENTICATION_FAILED },
      })
    }

    try {
      const siwe = new SiweMessage(message)

      this.logger.debug(
        `Authenticating SIWE message for domain: ${siwe.domain}`,
      )

      const result = await siwe.verify({
        signature,
        ...(serverConfig.NODE_ENV === "test" ? {} : { domain: siwe.domain }),
        nonce: siwe.nonce,
      })

      if (!result.success) {
        this.logger.debug(
          `SIWE verification failed for address: ${siwe.address}`,
        )
        throw new GraphQLError("Invalid signature", {
          extensions: { code: GraphQLErrorCode.INVALID_SIGNATURE },
        })
      }

      // Get or create user in database
      const dbUser = await createWeb3WalletUserIfNotExists(
        this.serverApp.db,
        siwe.address,
      )

      // Check if user is disabled
      await this.checkUserNotDisabled(dbUser.id)

      // Get wallet address for JWT
      const walletAddress = siwe.address.toLowerCase()

      // Create JWT token with wallet
      const token = await this.generateToken(dbUser.id, walletAddress)

      const user: AuthenticatedUser = {
        id: dbUser.id,
        web3Wallet: walletAddress,
      }

      this.logger.debug(
        `SIWE authentication successful for wallet: ${walletAddress}`,
      )

      return { token, user }
    } catch (error) {
      if (
        error instanceof GraphQLError ||
        error instanceof AccountDisabledError
      ) {
        throw error
      }

      this.logger.error("SIWE authentication failed:", error)

      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase()

        if (
          errorMessage.includes("invalid message") ||
          errorMessage.includes("invalid nonce") ||
          (errorMessage.includes("line") && errorMessage.includes("invalid"))
        ) {
          throw new GraphQLError("Invalid SIWE message format", {
            extensions: {
              code: GraphQLErrorCode.AUTHENTICATION_FAILED,
              originalError: error.message,
            },
          })
        }

        if (
          errorMessage.includes("signature") ||
          errorMessage.includes("address") ||
          errorMessage.includes("verification failed")
        ) {
          throw new GraphQLError("Invalid signature or message", {
            extensions: {
              code: GraphQLErrorCode.AUTHENTICATION_FAILED,
              originalError: error.message,
            },
          })
        }
      }

      throw new GraphQLError("Authentication failed", {
        extensions: {
          code: GraphQLErrorCode.AUTHENTICATION_FAILED,
          originalError: error instanceof Error ? error.message : String(error),
        },
      })
    }
  }

  /**
   * Authenticate with email verification code
   */
  async authenticateWithEmail(
    email: string,
    code: string,
    blob: string,
  ): Promise<AuthenticationResult> {
    try {
      this.logger.debug("Authenticating with email verification code")

      // Verify the code against the blob
      const verifiedEmail = await verifyCodeWithBlob(this.logger, blob, code)

      // Ensure email matches
      if (verifiedEmail.toLowerCase() !== email.toLowerCase()) {
        throw new GraphQLError("Email mismatch", {
          extensions: { code: GraphQLErrorCode.AUTHENTICATION_FAILED },
        })
      }

      // Get or create user
      const dbUser = await createEmailUserIfNotExists(
        this.serverApp.db,
        verifiedEmail,
      )

      // Check if user is disabled
      await this.checkUserNotDisabled(dbUser.id)

      // Check if user has a web3 wallet
      const web3Wallet = await getUserWeb3Wallet(this.serverApp.db, dbUser.id)

      // Create JWT token
      const token = await this.generateToken(dbUser.id, web3Wallet)

      const user: AuthenticatedUser = {
        id: dbUser.id,
        web3Wallet,
      }

      this.logger.debug(`Email authentication successful for user: ${user.id}`)

      return { token, user }
    } catch (error) {
      if (
        error instanceof GraphQLError ||
        error instanceof AccountDisabledError
      ) {
        throw error
      }

      this.logger.error("Email authentication failed:", error)

      throw new GraphQLError(
        error instanceof Error ? error.message : "Authentication failed",
        {
          extensions: {
            code: GraphQLErrorCode.AUTHENTICATION_FAILED,
          },
        },
      )
    }
  }

  /**
   * Authenticate with OAuth provider
   */
  async authenticateWithOAuth(
    provider: OAuthMethod,
    email: string | undefined,
    providerUserId: string,
  ): Promise<AuthenticationResult> {
    try {
      this.logger.debug(`Authenticating with OAuth provider: ${provider}`)

      // Get or create user
      const dbUser = await createOAuthUserIfNotExists(
        this.serverApp.db,
        provider,
        email,
        providerUserId,
      )

      // Check if user is disabled
      await this.checkUserNotDisabled(dbUser.id)

      // Check if user has a web3 wallet
      const web3Wallet = await getUserWeb3Wallet(this.serverApp.db, dbUser.id)

      // Create JWT token
      const token = await this.generateToken(dbUser.id, web3Wallet)

      const user: AuthenticatedUser = {
        id: dbUser.id,
        web3Wallet,
      }

      this.logger.debug(`OAuth authentication successful for user: ${user.id}`)

      return { token, user }
    } catch (error) {
      if (
        error instanceof GraphQLError ||
        error instanceof AccountDisabledError
      ) {
        throw error
      }

      this.logger.error("OAuth authentication failed:", error)

      throw new GraphQLError(
        error instanceof Error ? error.message : "Authentication failed",
        {
          extensions: {
            code: GraphQLErrorCode.AUTHENTICATION_FAILED,
          },
        },
      )
    }
  }

  /**
   * Authenticate with Firebase ID token (phone auth)
   */
  async authenticateWithFirebase(
    idToken: string,
  ): Promise<AuthenticationResult> {
    try {
      if (!isFirebaseConfigured()) {
        throw new GraphQLError("Firebase authentication is not configured", {
          extensions: { code: GraphQLErrorCode.AUTHENTICATION_FAILED },
        })
      }

      this.logger.debug("Authenticating with Firebase ID token")

      // Verify the Firebase ID token
      const verifiedToken = await verifyFirebaseToken(this.logger, idToken)

      if (!verifiedToken.phoneNumber) {
        throw new GraphQLError("Phone number not found in Firebase token", {
          extensions: { code: GraphQLErrorCode.AUTHENTICATION_FAILED },
        })
      }

      // Get or create user with phone auth
      const dbUser = await createPhoneUserIfNotExists(
        this.serverApp.db,
        verifiedToken.phoneNumber,
      )

      // Check if user is disabled
      await this.checkUserNotDisabled(dbUser.id)

      // Check if user has a web3 wallet
      const web3Wallet = await getUserWeb3Wallet(this.serverApp.db, dbUser.id)

      // Create JWT token
      const token = await this.generateToken(dbUser.id, web3Wallet)

      const user: AuthenticatedUser = {
        id: dbUser.id,
        web3Wallet,
      }

      this.logger.debug(
        `Firebase authentication successful for user: ${user.id}`,
      )

      return { token, user }
    } catch (error) {
      if (
        error instanceof GraphQLError ||
        error instanceof AccountDisabledError
      ) {
        throw error
      }

      this.logger.error("Firebase authentication failed:", error)

      throw new GraphQLError(
        error instanceof Error ? error.message : "Authentication failed",
        {
          extensions: {
            code: GraphQLErrorCode.AUTHENTICATION_FAILED,
          },
        },
      )
    }
  }

  /**
   * Verify JWT token and return user info
   */
  async verifyToken(token: string): Promise<AuthenticatedUser> {
    try {
      this.logger.debug(`Verifying token: ${token.substring(0, 20)}...`)

      const { payload } = await jwtVerify(token, getJwtSecret())

      if (payload.type !== "auth") {
        this.logger.debug(
          `Token type mismatch: expected "auth", got "${payload.type}"`,
        )
        throw new GraphQLError("Invalid token type", {
          extensions: { code: GraphQLErrorCode.UNAUTHORIZED },
        })
      }

      if (!payload.userId || typeof payload.userId !== "number") {
        this.logger.debug(`Token payload missing userId:`, payload)
        throw new GraphQLError("Invalid token payload", {
          extensions: { code: GraphQLErrorCode.UNAUTHORIZED },
        })
      }

      const web3Wallet =
        typeof payload.web3_wallet === "string"
          ? payload.web3_wallet
          : undefined

      this.logger.debug(
        `Token verified for user ${payload.userId}${web3Wallet ? ` (${web3Wallet})` : ""}`,
      )

      return {
        id: payload.userId,
        web3Wallet,
      }
    } catch (error) {
      if (error instanceof GraphQLError) {
        throw error
      }

      this.logger.debug(`Token verification failed:`, error)

      if (error instanceof Error && error.message.includes("exp")) {
        throw new GraphQLError("Token expired", {
          extensions: { code: GraphQLErrorCode.UNAUTHORIZED },
        })
      }

      throw new GraphQLError("Invalid token", {
        extensions: { code: GraphQLErrorCode.UNAUTHORIZED },
      })
    }
  }

  /**
   * Extract bearer token from Authorization header
   */
  extractBearerToken(authHeader: string | null): string | null {
    if (!authHeader) return null

    const match = authHeader.match(/^Bearer ([^\s]+)$/)
    return (match ? match[1] : null) || null
  }

  /**
   * Authenticate request and return user or throw error
   */
  async authenticateRequest(request: Request): Promise<AuthenticatedUser> {
    const authHeader = request.headers.get("Authorization")
    const token = this.extractBearerToken(authHeader)

    if (!token) {
      this.logger.debug("No authorization token provided")
      throw new GraphQLError("Authentication required", {
        extensions: { code: GraphQLErrorCode.UNAUTHORIZED },
      })
    }

    return await this.verifyToken(token)
  }
}
