/**
 * Settings database access layer
 *
 * Provides key-value storage for application settings.
 */

import { eq } from "drizzle-orm"
import { settings } from "./schema"
import type { DatabaseOrTransaction } from "./shared"
import { withTransaction } from "./shared"

/**
 * Get a setting value by key
 */
export async function getSetting(
  db: DatabaseOrTransaction,
  key: string,
): Promise<string | null> {
  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1)

  if (result.length === 0) {
    return null
  }

  return result[0]!.value
}

/**
 * Set a setting value (upsert)
 */
export async function setSetting(
  db: DatabaseOrTransaction,
  key: string,
  value: string,
): Promise<void> {
  await withTransaction(db, async (tx) => {
    const existing = await tx
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1)

    if (existing.length > 0) {
      await tx
        .update(settings)
        .set({
          value,
          updatedAt: new Date(),
        })
        .where(eq(settings.key, key))
    } else {
      await tx.insert(settings).values({
        key,
        value,
      })
    }
  })
}
