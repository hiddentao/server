import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { type Bookmark, bookmarks, type NewBookmark, posts } from "./schema"
import { type DatabaseOrTransaction, withTransaction } from "./shared"

export type { Bookmark }

/**
 * Check if a user has bookmarked a post
 */
export async function isPostBookmarked(
  db: DatabaseOrTransaction,
  userId: number,
  postId: number,
): Promise<boolean> {
  return db.startSpan("db.bookmarks.isPostBookmarked", async () => {
    const result = await db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.postId, postId)))
      .limit(1)

    return result.length > 0
  })
}

/**
 * Get bookmarks for multiple posts at once
 */
export async function getBookmarksForPosts(
  db: DatabaseOrTransaction,
  userId: number,
  postIds: number[],
): Promise<Set<number>> {
  return db.startSpan("db.bookmarks.getBookmarksForPosts", async () => {
    if (postIds.length === 0) {
      return new Set()
    }

    const result = await db
      .select({ postId: bookmarks.postId })
      .from(bookmarks)
      .where(
        and(eq(bookmarks.userId, userId), inArray(bookmarks.postId, postIds)),
      )

    return new Set(result.map((r) => r.postId))
  })
}

/**
 * Add a bookmark
 */
export async function addBookmark(
  db: DatabaseOrTransaction,
  userId: number,
  postId: number,
): Promise<Bookmark> {
  return db.startSpan("db.bookmarks.addBookmark", async () => {
    return withTransaction(db, async (tx) => {
      // Check if already bookmarked
      const existing = await tx
        .select()
        .from(bookmarks)
        .where(and(eq(bookmarks.userId, userId), eq(bookmarks.postId, postId)))
        .limit(1)

      if (existing[0]) {
        throw new Error("Post already bookmarked")
      }

      // Verify post exists and is active
      const post = await tx
        .select()
        .from(posts)
        .where(and(eq(posts.id, postId), eq(posts.active, true)))
        .limit(1)

      if (!post[0]) {
        throw new Error("Post not found")
      }

      // Create bookmark
      const newBookmark: NewBookmark = {
        userId,
        postId,
      }

      const result = await tx.insert(bookmarks).values(newBookmark).returning()

      // Increment post's bookmark count
      await tx
        .update(posts)
        .set({
          bookmarkCount: sql`${posts.bookmarkCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(posts.id, postId))

      return result[0]!
    })
  })
}

/**
 * Remove a bookmark
 */
export async function removeBookmark(
  db: DatabaseOrTransaction,
  userId: number,
  postId: number,
): Promise<boolean> {
  return db.startSpan("db.bookmarks.removeBookmark", async () => {
    return withTransaction(db, async (tx) => {
      // Find and delete bookmark
      const deleted = await tx
        .delete(bookmarks)
        .where(and(eq(bookmarks.userId, userId), eq(bookmarks.postId, postId)))
        .returning()

      if (deleted.length === 0) {
        return false
      }

      // Decrement post's bookmark count
      await tx
        .update(posts)
        .set({
          bookmarkCount: sql`GREATEST(${posts.bookmarkCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(posts.id, postId))

      return true
    })
  })
}

export type BookmarkSortBy = "NEWEST" | "OLDEST"

export interface GetBookmarksOptions {
  userId: number
  sortBy?: BookmarkSortBy
  cursor?: string
  limit?: number
}

/**
 * Get user's bookmarks with pagination
 */
export async function getUserBookmarks(
  db: DatabaseOrTransaction,
  options: GetBookmarksOptions,
): Promise<{ bookmarks: Bookmark[]; hasMore: boolean; nextCursor?: string }> {
  return db.startSpan("db.bookmarks.getUserBookmarks", async () => {
    const { userId, sortBy = "NEWEST", cursor, limit = 20 } = options

    const conditions = [eq(bookmarks.userId, userId)]

    // Handle cursor-based pagination
    if (cursor) {
      const [cursorValue, cursorId] = cursor.split(":")
      if (cursorValue && cursorId) {
        const cursorIdNum = parseInt(cursorId, 10)
        if (sortBy === "NEWEST") {
          conditions.push(
            sql`(${bookmarks.createdAt}, ${bookmarks.id}) < (${new Date(cursorValue)}, ${cursorIdNum})`,
          )
        } else {
          conditions.push(
            sql`(${bookmarks.createdAt}, ${bookmarks.id}) > (${new Date(cursorValue)}, ${cursorIdNum})`,
          )
        }
      }
    }

    const orderBy =
      sortBy === "OLDEST"
        ? [asc(bookmarks.createdAt), asc(bookmarks.id)]
        : [desc(bookmarks.createdAt), desc(bookmarks.id)]

    const results = await db
      .select()
      .from(bookmarks)
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(limit + 1)

    const hasMore = results.length > limit
    const bookmarksData = results.slice(0, limit)

    let nextCursor: string | undefined
    if (hasMore && bookmarksData.length > 0) {
      const lastBookmark = bookmarksData[bookmarksData.length - 1]!
      nextCursor = `${lastBookmark.createdAt.toISOString()}:${lastBookmark.id}`
    }

    return {
      bookmarks: bookmarksData,
      hasMore,
      nextCursor,
    }
  })
}
