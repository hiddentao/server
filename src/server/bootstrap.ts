import { serverConfig } from "@shared/config/server"
import type { NotificationData } from "@shared/notifications/types"
import type { ISocketManager } from "@shared/websocket/socket-manager"
import { WebSocketMessageType } from "@shared/websocket/types"
import { dbManager } from "./db/connection"
import { notifications } from "./db/schema"
import type { Logger } from "./lib/logger"
import { startSpan } from "./lib/logger"
import type { ServerApp } from "./types"
import { createWorkerManager } from "./workers"

/**
 * Create notification function that can be shared between server and worker
 */
const createNotificationFunction = (
  db: any,
  socketManager: ISocketManager,
  logger: any,
) => {
  return async (userId: number, notificationData: NotificationData) => {
    try {
      // Insert notification into database
      const [notification] = await db
        .insert(notifications)
        .values({
          userId,
          data: notificationData,
        })
        .returning()

      if (notification) {
        // Send WebSocket notification to user
        await socketManager.sendToUser(userId, {
          type: WebSocketMessageType.NotificationReceived,
          data: {
            id: notification.id,
            userId: notification.userId,
            data: notification.data,
            createdAt: notification.createdAt.toISOString(),
            read: notification.read,
          },
        })

        logger.debug(
          `Created and sent notification ${notification.id} to user ${userId}`,
        )
      }
    } catch (error) {
      logger.error(`Failed to create notification for user ${userId}:`, error)
    }
  }
}

/**
 * Creates a ServerApp instance with all necessary dependencies
 * This is shared between the main server process and worker processes
 */
export const createServerApp = async (options: {
  includeWorkerManager?: boolean
  workerCountOverride?: number
  socketManager: ISocketManager
  rootLogger: Logger
}): Promise<
  Omit<ServerApp, "app" | "workerManager"> & {
    workerManager?: ServerApp["workerManager"]
  }
> => {
  const {
    includeWorkerManager = false,
    workerCountOverride,
    socketManager,
    rootLogger,
  } = options

  // Set logger for database manager before connecting
  dbManager.setLogger(rootLogger.child("db-manager"))

  // Connect to database using centralized connection manager
  const db = await dbManager.connect({
    maxConnections: 10, // Default connection pool size
    idleTimeout: 20, // Close idle connections after 20 seconds
    connectTimeout: 10,
    databaseUrl: serverConfig.DATABASE_URL,
  })

  rootLogger.info("Database connected")

  const baseServerApp = {
    db,
    rootLogger,
    createLogger: (category: string) => rootLogger.child(category),
    startSpan,
    socketManager,
    createNotification: createNotificationFunction(
      db,
      socketManager,
      rootLogger,
    ),
  }

  if (includeWorkerManager) {
    return {
      ...baseServerApp,
      workerManager: await createWorkerManager(
        baseServerApp as any,
        workerCountOverride,
      ),
    }
  }

  return baseServerApp
}
