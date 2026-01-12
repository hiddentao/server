import { and, count, desc, eq } from "drizzle-orm"
import { notifications } from "./schema"
import { type DatabaseOrTransaction, withTransaction } from "./shared"

export interface Notification {
  id: number
  userId: number
  data: any
  read: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PageParam {
  startIndex: number
  perPage: number
}

/**
 * Get notifications for a user with pagination
 */
export async function getNotificationsForUser(
  db: DatabaseOrTransaction,
  userId: number,
  pageParam: PageParam,
): Promise<[Notification[], number]> {
  return db.startSpan("db.notifications.getNotificationsForUser", async () => {
    return withTransaction(db, async (tx) => {
      // Get notifications with pagination
      const notificationsResult = await tx
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(pageParam.perPage)
        .offset(pageParam.startIndex)

      // Get total count
      const totalResult = await tx
        .select({ count: count() })
        .from(notifications)
        .where(eq(notifications.userId, userId))

      const total = totalResult[0]?.count ?? 0

      return [notificationsResult, total]
    })
  })
}

/**
 * Get unread notifications count for user
 */
export async function getUnreadNotificationsCountForUser(
  db: DatabaseOrTransaction,
  userId: number,
): Promise<number> {
  return db.startSpan(
    "db.notifications.getUnreadNotificationsCountForUser",
    async () => {
      const result = await db
        .select({ count: count() })
        .from(notifications)
        .where(
          and(eq(notifications.userId, userId), eq(notifications.read, false)),
        )

      return result[0]?.count ?? 0
    },
  )
}

/**
 * Create a notification for a user
 */
export async function createNotification(
  db: DatabaseOrTransaction,
  userId: number,
  data: any,
): Promise<Notification> {
  return db.startSpan("db.notifications.createNotification", async () => {
    const result = await db
      .insert(notifications)
      .values({
        userId,
        data,
        read: false,
      })
      .returning()

    return result[0]!
  })
}

/**
 * Mark a specific notification as read
 */
export async function markNotificationAsRead(
  db: DatabaseOrTransaction,
  userId: number,
  notificationId: number,
): Promise<boolean> {
  return db.startSpan("db.notifications.markNotificationAsRead", async () => {
    const result = await db
      .update(notifications)
      .set({
        read: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId),
        ),
      )
      .returning()

    return result.length > 0
  })
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(
  db: DatabaseOrTransaction,
  userId: number,
): Promise<number> {
  return db.startSpan(
    "db.notifications.markAllNotificationsAsRead",
    async () => {
      const result = await db
        .update(notifications)
        .set({
          read: true,
          updatedAt: new Date(),
        })
        .where(
          and(eq(notifications.userId, userId), eq(notifications.read, false)),
        )
        .returning()

      return result.length
    },
  )
}
