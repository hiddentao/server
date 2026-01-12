import type { ISocketManager } from "../../shared/websocket/socket-manager"
import type { WebSocketMessage } from "../../shared/websocket/types"
import type { Logger } from "../lib/logger"
import type { BroadcastMessage, SendToUserMessage } from "./ipc-types"
import { WorkerIPCMessageType } from "./ipc-types"

/**
 * Worker-side SocketManager that sends IPC messages to the server process
 * to relay WebSocket messages through the server's SocketManager
 */
export class WorkerSocketManager implements ISocketManager {
  private log: Logger

  constructor(log: Logger) {
    this.log = log
  }

  public async sendToUser(
    userId: number,
    message: WebSocketMessage,
  ): Promise<boolean> {
    try {
      const ipcMessage: SendToUserMessage = {
        type: WorkerIPCMessageType.SendToUser,
        userId,
        message,
      }

      // Send IPC message to parent process (server)
      if (process.send) {
        process.send(ipcMessage)
        this.log.debug(`Sent WebSocket message via IPC to user ${userId}`)
        return true
      } else {
        this.log.warn("No IPC connection available to send message to user")
        return false
      }
    } catch (error) {
      this.log.error(
        `Failed to send WebSocket message via IPC to user ${userId}:`,
        error,
      )
      return false
    }
  }

  public async broadcast(message: WebSocketMessage): Promise<number> {
    try {
      const ipcMessage: BroadcastMessage = {
        type: WorkerIPCMessageType.Broadcast,
        message,
      }

      // Send IPC message to parent process (server)
      if (process.send) {
        process.send(ipcMessage)
        this.log.debug("Sent broadcast WebSocket message via IPC")
        // Return 1 to indicate the IPC message was sent (actual count handled by server)
        return 1
      } else {
        this.log.warn("No IPC connection available to broadcast message")
        return 0
      }
    } catch (error) {
      this.log.error(
        "Failed to send broadcast WebSocket message via IPC:",
        error,
      )
      return 0
    }
  }
}
