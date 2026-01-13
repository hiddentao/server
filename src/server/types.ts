import type { NotificationData } from "@shared/notifications/types"
import type { ISocketManager } from "@shared/websocket/socket-manager"
import type { Elysia } from "elysia"
import type { Database } from "./db/shared"
import type { Logger, startSpan } from "./lib/logger"
import type { WorkerManager } from "./workers"

/**
 * ServerApp type containing references to useful properties and methods
 * that get passed around the application
 */
export type ServerApp = {
  /** The server application instance */
  app: Elysia
  /** Database instance */
  db: Database
  /** Root logger instance */
  rootLogger: Logger
  /** Create a logger with a category */
  createLogger: (category: string) => Logger
  /** Start a Sentry performance monitoring span */
  startSpan: typeof startSpan
  /** Worker manager for background job processing */
  workerManager: WorkerManager
  /** WebSocket manager for real-time communication */
  socketManager: ISocketManager
  /** Create a notification for a user and send via WebSocket */
  createNotification: (
    userId: number,
    notificationData: NotificationData,
  ) => Promise<void>
}
