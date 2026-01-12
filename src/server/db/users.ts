import { eq } from "drizzle-orm"
import {
  AUTH_METHOD,
  type AuthMethod,
  type OAuthMethod,
} from "../../shared/constants"
import { type User, users } from "./schema"
import { type DatabaseOrTransaction, withTransaction } from "./shared"
import {
  createUserAuth,
  getUserAuthByIdentifier,
  getUserAuthsByUserId,
} from "./userAuth"

export type { User }

/**
 * Get user by ID
 */
export async function getUserById(
  db: DatabaseOrTransaction,
  id: number,
): Promise<User | undefined> {
  return db.startSpan("db.users.getUserById", async () => {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    return result[0]
  })
}

/**
 * Check if a user is disabled
 */
export async function isUserDisabled(
  db: DatabaseOrTransaction,
  userId: number,
): Promise<boolean> {
  return db.startSpan("db.users.isUserDisabled", async () => {
    const user = await getUserById(db, userId)
    return user?.disabled ?? false
  })
}

/**
 * Set user disabled status
 */
export async function setUserDisabled(
  db: DatabaseOrTransaction,
  userId: number,
  disabled: boolean,
): Promise<void> {
  return db.startSpan("db.users.setUserDisabled", async () => {
    await db
      .update(users)
      .set({ disabled, updatedAt: new Date() })
      .where(eq(users.id, userId))
  })
}

/**
 * Create user with web3 wallet auth if they don't exist, otherwise return existing user
 */
export async function createWeb3WalletUserIfNotExists(
  db: DatabaseOrTransaction,
  walletAddress: string,
): Promise<User> {
  return db.startSpan("db.users.createWeb3WalletUserIfNotExists", async () => {
    return withTransaction(db, async (tx) => {
      const normalizedWallet = walletAddress.toLowerCase()

      // Check if wallet auth already exists
      const existingAuth = await getUserAuthByIdentifier(
        tx,
        AUTH_METHOD.WEB3_WALLET,
        normalizedWallet,
      )

      if (existingAuth) {
        // Return existing user
        const user = await getUserById(tx, existingAuth.userId)
        if (!user) {
          throw new Error("User not found for existing wallet auth")
        }
        return user
      }

      // Create new user
      const result = await tx
        .insert(users)
        .values({
          settings: {},
        })
        .returning()

      const user = result[0]!

      // Create wallet auth entry
      await createUserAuth(
        tx,
        user.id,
        AUTH_METHOD.WEB3_WALLET,
        normalizedWallet,
      )

      return user
    })
  })
}

/**
 * Create user with email auth if they don't exist, otherwise return existing user
 */
export async function createEmailUserIfNotExists(
  db: DatabaseOrTransaction,
  email: string,
): Promise<User> {
  return db.startSpan("db.users.createEmailUserIfNotExists", async () => {
    return withTransaction(db, async (tx) => {
      const normalizedEmail = email.toLowerCase()

      // Check if email auth already exists
      const existingAuth = await getUserAuthByIdentifier(
        tx,
        AUTH_METHOD.EMAIL,
        normalizedEmail,
      )

      if (existingAuth) {
        // Return existing user
        const user = await getUserById(tx, existingAuth.userId)
        if (!user) {
          throw new Error("User not found for existing email auth")
        }
        return user
      }

      // Create new user
      const result = await tx
        .insert(users)
        .values({
          settings: {},
        })
        .returning()

      const user = result[0]!

      // Create email auth entry
      await createUserAuth(tx, user.id, AUTH_METHOD.EMAIL, normalizedEmail)

      return user
    })
  })
}

/**
 * Create user with OAuth auth if they don't exist, otherwise return existing user
 * Links to existing account if email matches an existing email auth
 */
export async function createOAuthUserIfNotExists(
  db: DatabaseOrTransaction,
  provider: OAuthMethod,
  email: string | undefined,
  providerUserId: string,
): Promise<User> {
  return db.startSpan("db.users.createOAuthUserIfNotExists", async () => {
    return withTransaction(db, async (tx) => {
      const normalizedEmail = email?.toLowerCase()
      const authIdentifier = `${providerUserId}`

      // Check if OAuth auth already exists
      const existingOAuthAuth = await getUserAuthByIdentifier(
        tx,
        provider,
        authIdentifier,
      )

      if (existingOAuthAuth) {
        // Return existing user
        const user = await getUserById(tx, existingOAuthAuth.userId)
        if (!user) {
          throw new Error("User not found for existing OAuth auth")
        }
        return user
      }

      // Check if email auth exists (link accounts) - only if email is provided
      if (normalizedEmail) {
        const existingEmailAuth = await getUserAuthByIdentifier(
          tx,
          AUTH_METHOD.EMAIL,
          normalizedEmail,
        )

        if (existingEmailAuth) {
          // Link OAuth to existing email user
          await createUserAuth(
            tx,
            existingEmailAuth.userId,
            provider,
            authIdentifier,
          )
          const user = await getUserById(tx, existingEmailAuth.userId)
          if (!user) {
            throw new Error("User not found for existing email auth")
          }
          return user
        }
      }

      // Create new user
      const result = await tx
        .insert(users)
        .values({
          settings: {},
        })
        .returning()

      const user = result[0]!

      // Create OAuth auth entry
      await createUserAuth(tx, user.id, provider, authIdentifier)

      // Also create email auth entry for future linking (only if email is provided)
      if (normalizedEmail) {
        await createUserAuth(tx, user.id, AUTH_METHOD.EMAIL, normalizedEmail)
      }

      return user
    })
  })
}

/**
 * Create user with phone auth if they don't exist, otherwise return existing user
 */
export async function createPhoneUserIfNotExists(
  db: DatabaseOrTransaction,
  phoneNumber: string,
): Promise<User> {
  return db.startSpan("db.users.createPhoneUserIfNotExists", async () => {
    return withTransaction(db, async (tx) => {
      // Check if phone auth already exists
      const existingAuth = await getUserAuthByIdentifier(
        tx,
        AUTH_METHOD.PHONE,
        phoneNumber,
      )

      if (existingAuth) {
        // Return existing user
        const user = await getUserById(tx, existingAuth.userId)
        if (!user) {
          throw new Error("User not found for existing phone auth")
        }
        return user
      }

      // Create new user
      const result = await tx
        .insert(users)
        .values({
          settings: {},
        })
        .returning()

      const user = result[0]!

      // Create phone auth entry
      await createUserAuth(tx, user.id, AUTH_METHOD.PHONE, phoneNumber)

      return user
    })
  })
}

/**
 * Get user by auth identifier (email, wallet, or OAuth provider ID)
 */
export async function getUserByAuthIdentifier(
  db: DatabaseOrTransaction,
  authType: AuthMethod,
  authIdentifier: string,
): Promise<User | undefined> {
  return db.startSpan("db.users.getUserByAuthIdentifier", async () => {
    const auth = await getUserAuthByIdentifier(db, authType, authIdentifier)
    if (!auth) {
      return undefined
    }
    return getUserById(db, auth.userId)
  })
}

/**
 * Get user's web3 wallet address if they have one
 */
export async function getUserWeb3Wallet(
  db: DatabaseOrTransaction,
  userId: number,
): Promise<string | undefined> {
  return db.startSpan("db.users.getUserWeb3Wallet", async () => {
    const auths = await getUserAuthsByUserId(db, userId)
    const walletAuth = auths.find((a) => a.authType === AUTH_METHOD.WEB3_WALLET)
    return walletAuth?.authIdentifier
  })
}

/**
 * Get user's primary auth identifier for display
 */
export async function getUserPrimaryAuthIdentifier(
  db: DatabaseOrTransaction,
  userId: number,
): Promise<{ type: AuthMethod; identifier: string } | undefined> {
  return db.startSpan("db.users.getUserPrimaryAuthIdentifier", async () => {
    const auths = await getUserAuthsByUserId(db, userId)
    if (auths.length === 0) {
      return undefined
    }

    // Priority: WEB3_WALLET > EMAIL > GOOGLE > GITHUB
    const priority: AuthMethod[] = [
      AUTH_METHOD.WEB3_WALLET,
      AUTH_METHOD.EMAIL,
      AUTH_METHOD.GOOGLE,
      AUTH_METHOD.GITHUB,
    ]

    for (const type of priority) {
      const auth = auths.find((a) => a.authType === type)
      if (auth) {
        return {
          type: auth.authType as AuthMethod,
          identifier: auth.authIdentifier,
        }
      }
    }

    // Fallback to first auth
    const first = auths[0]!
    return {
      type: first.authType as AuthMethod,
      identifier: first.authIdentifier,
    }
  })
}

/**
 * Update user settings by user ID
 */
export async function updateUserSettings(
  db: DatabaseOrTransaction,
  userId: number,
  settings: unknown,
): Promise<User | undefined> {
  return db.startSpan("db.users.updateUserSettings", async () => {
    const result = await db
      .update(users)
      .set({
        settings,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning()

    return result[0]
  })
}
