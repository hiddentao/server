import { eq } from "drizzle-orm"
import type { AgeRange } from "../../shared/constants"
import { type NewUserProfile, type UserProfile, userProfiles } from "./schema"
import { type DatabaseOrTransaction, withTransaction } from "./shared"

export type { UserProfile }

/**
 * Get user profile by user ID
 */
export async function getProfileByUserId(
  db: DatabaseOrTransaction,
  userId: number,
): Promise<UserProfile | undefined> {
  return db.startSpan("db.profiles.getProfileByUserId", async () => {
    const result = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1)

    return result[0]
  })
}

/**
 * Get user profile by username
 */
export async function getProfileByUsername(
  db: DatabaseOrTransaction,
  username: string,
): Promise<UserProfile | undefined> {
  return db.startSpan("db.profiles.getProfileByUsername", async () => {
    const result = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.username, username.toLowerCase()))
      .limit(1)

    return result[0]
  })
}

/**
 * Get user profile by phone number
 */
export async function getProfileByPhoneNumber(
  db: DatabaseOrTransaction,
  phoneNumber: string,
): Promise<UserProfile | undefined> {
  return db.startSpan("db.profiles.getProfileByPhoneNumber", async () => {
    const result = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.phoneNumber, phoneNumber))
      .limit(1)

    return result[0]
  })
}

/**
 * Check if a username is available
 */
export async function isUsernameAvailable(
  db: DatabaseOrTransaction,
  username: string,
): Promise<boolean> {
  return db.startSpan("db.profiles.isUsernameAvailable", async () => {
    const existing = await getProfileByUsername(db, username)
    return !existing
  })
}

/**
 * Create a new user profile
 */
export async function createProfile(
  db: DatabaseOrTransaction,
  data: {
    userId: number
    username: string
    phoneNumber: string
    ageRange?: AgeRange
    occupation?: string
    city?: string
  },
): Promise<UserProfile> {
  return db.startSpan("db.profiles.createProfile", async () => {
    return withTransaction(db, async (tx) => {
      const normalizedUsername = data.username.toLowerCase()

      // Check if user already has a profile
      const existingProfile = await getProfileByUserId(tx, data.userId)
      if (existingProfile) {
        throw new Error("User already has a profile")
      }

      // Check username availability
      const usernameAvailable = await isUsernameAvailable(
        tx,
        normalizedUsername,
      )
      if (!usernameAvailable) {
        throw new Error("Username is already taken")
      }

      const newProfile: NewUserProfile = {
        userId: data.userId,
        username: normalizedUsername,
        phoneNumber: data.phoneNumber,
        ageRange: data.ageRange,
        occupation: data.occupation,
        city: data.city || "singapore",
      }

      const result = await tx
        .insert(userProfiles)
        .values(newProfile)
        .returning()

      return result[0]!
    })
  })
}

/**
 * Update an existing user profile
 */
export async function updateProfile(
  db: DatabaseOrTransaction,
  userId: number,
  updates: {
    username?: string
    ageRange?: AgeRange
    occupation?: string
    city?: string
  },
): Promise<UserProfile> {
  return db.startSpan("db.profiles.updateProfile", async () => {
    return withTransaction(db, async (tx) => {
      const existing = await getProfileByUserId(tx, userId)
      if (!existing) {
        throw new Error("Profile not found")
      }

      // If username is being changed, check availability
      if (
        updates.username &&
        updates.username.toLowerCase() !== existing.username
      ) {
        const usernameAvailable = await isUsernameAvailable(
          tx,
          updates.username,
        )
        if (!usernameAvailable) {
          throw new Error("Username is already taken")
        }
      }

      const updateData: Partial<NewUserProfile> = {
        updatedAt: new Date(),
      }

      if (updates.username) {
        updateData.username = updates.username.toLowerCase()
      }
      if (updates.ageRange !== undefined) {
        updateData.ageRange = updates.ageRange
      }
      if (updates.occupation !== undefined) {
        updateData.occupation = updates.occupation
      }
      if (updates.city !== undefined) {
        updateData.city = updates.city
      }

      const result = await tx
        .update(userProfiles)
        .set(updateData)
        .where(eq(userProfiles.userId, userId))
        .returning()

      return result[0]!
    })
  })
}
