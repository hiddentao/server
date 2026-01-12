import { eq } from "drizzle-orm"
import {
  LEGAL_CONTENT_TYPE,
  type LegalContentType,
} from "../../shared/constants"
import { type LegalContent, legalContent, type NewLegalContent } from "./schema"
import type { DatabaseOrTransaction } from "./shared"

export type { LegalContent }

/**
 * Get legal content by type
 */
export async function getLegalContentByType(
  db: DatabaseOrTransaction,
  type: LegalContentType,
): Promise<LegalContent | undefined> {
  return db.startSpan("db.legalContent.getLegalContentByType", async () => {
    const result = await db
      .select()
      .from(legalContent)
      .where(eq(legalContent.type, type))
      .limit(1)

    return result[0]
  })
}

/**
 * Get privacy policy
 */
export async function getPrivacyPolicy(
  db: DatabaseOrTransaction,
): Promise<LegalContent | undefined> {
  return getLegalContentByType(db, LEGAL_CONTENT_TYPE.PRIVACY_POLICY)
}

/**
 * Get terms and conditions
 */
export async function getTermsAndConditions(
  db: DatabaseOrTransaction,
): Promise<LegalContent | undefined> {
  return getLegalContentByType(db, LEGAL_CONTENT_TYPE.TERMS_CONDITIONS)
}

/**
 * Upsert legal content
 */
export async function upsertLegalContent(
  db: DatabaseOrTransaction,
  data: {
    type: LegalContentType
    title: string
    content: string
    version: string
    effectiveDate: Date
  },
): Promise<LegalContent> {
  return db.startSpan("db.legalContent.upsertLegalContent", async () => {
    const existing = await getLegalContentByType(db, data.type)

    if (existing) {
      const result = await db
        .update(legalContent)
        .set({
          title: data.title,
          content: data.content,
          version: data.version,
          effectiveDate: data.effectiveDate,
          updatedAt: new Date(),
        })
        .where(eq(legalContent.type, data.type))
        .returning()

      return result[0]!
    }

    const newContent: NewLegalContent = {
      type: data.type,
      title: data.title,
      content: data.content,
      version: data.version,
      effectiveDate: data.effectiveDate,
    }

    const result = await db.insert(legalContent).values(newContent).returning()

    return result[0]!
  })
}
