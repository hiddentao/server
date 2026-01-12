import { and, eq } from "drizzle-orm"
import type { AuthMethod } from "../../shared/constants"
import { type UserAuth, userAuth } from "./schema"
import type { DatabaseOrTransaction } from "./shared"

/**
 * Get user auth entry by auth type and identifier
 */
export async function getUserAuthByIdentifier(
  db: DatabaseOrTransaction,
  authType: AuthMethod,
  authIdentifier: string,
): Promise<UserAuth | undefined> {
  return db.startSpan("db.userAuth.getUserAuthByIdentifier", async () => {
    const result = await db
      .select()
      .from(userAuth)
      .where(
        and(
          eq(userAuth.authType, authType),
          eq(userAuth.authIdentifier, authIdentifier.toLowerCase()),
        ),
      )
      .limit(1)

    return result[0]
  })
}

/**
 * Get all auth methods for a user
 */
export async function getUserAuthsByUserId(
  db: DatabaseOrTransaction,
  userId: number,
): Promise<UserAuth[]> {
  return db.startSpan("db.userAuth.getUserAuthsByUserId", async () => {
    return db.select().from(userAuth).where(eq(userAuth.userId, userId))
  })
}

/**
 * Create a new user auth entry
 */
export async function createUserAuth(
  db: DatabaseOrTransaction,
  userId: number,
  authType: AuthMethod,
  authIdentifier: string,
): Promise<UserAuth> {
  return db.startSpan("db.userAuth.createUserAuth", async () => {
    const result = await db
      .insert(userAuth)
      .values({
        userId,
        authType,
        authIdentifier: authIdentifier.toLowerCase(),
      })
      .returning()

    return result[0]!
  })
}
