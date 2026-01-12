import Elysia, { t } from "elysia"
import { serverConfig } from "../../shared/config/server"
import type { ISocketManager } from "../../shared/websocket/socket-manager"
import type { WebSocketMessage } from "../../shared/websocket/types"
import {
  WebSocketErrorCode,
  WebSocketMessageType,
} from "../../shared/websocket/types"
import { AuthService } from "../auth/index"
import type { Logger } from "../lib/logger"
import type { ServerApp } from "../types"

export const createWebSocket = (serverApp: ServerApp) => {
  const log = serverApp.createLogger("ws")
  const authService = new AuthService(serverApp)

  return new Elysia().ws("/ws", {
    body: t.Object({
      type: t.Literal("register"),
      jwtToken: t.Optional(t.String()),
    }),
    response: t.Object({
      type: t.String(),
      data: t.Unknown(),
    }),
    open(ws) {
      log.debug(`Client WebSocket opened: ${ws.id}`)

      // Send connected message immediately
      ws.send({
        type: WebSocketMessageType.Connected,
        data: {
          message: "WebSocket connection established",
        },
      })
    },
    close(ws) {
      log.debug(`Client disconnected: ${ws.id}`)
      ;(serverApp.socketManager as SocketManager).deregister(ws.id)
    },
    message(ws, message) {
      const { type, jwtToken } = message
      const socketManager = serverApp.socketManager as SocketManager
      ;(async () => {
        if (type === "register") {
          log.debug(`Client registering: ${ws.id}`)

          // Register client with socket manager
          const clientRegistered = socketManager.registerClient(ws, ws.id)
          if (!clientRegistered) {
            ws.send({
              type: WebSocketMessageType.Error,
              data: {
                code: WebSocketErrorCode.CONNECTION_LIMIT_TOTAL_EXCEEDED,
                message:
                  "Server connection limit exceeded. Please try again later.",
              },
            })
            ws.close()
            return
          }

          // If JWT token provided, authenticate and associate with user
          if (jwtToken) {
            try {
              const authenticatedUser = await authService.verifyToken(jwtToken)
              if (!authenticatedUser?.id) {
                throw new Error("Authenticated user missing ID")
              }
              // Register using user ID from auth service
              const userRegistered = socketManager.registerUser(
                ws.id,
                authenticatedUser.id,
              )
              if (!userRegistered) {
                ws.send({
                  type: WebSocketMessageType.Error,
                  data: {
                    code: WebSocketErrorCode.CONNECTION_LIMIT_PER_USER_EXCEEDED,
                    message:
                      "Too many active connections for this user. Please close some connections and try again.",
                  },
                })
                ws.close()
                return
              }

              // Send registered message to confirm successful authentication
              ws.send({
                type: WebSocketMessageType.Registered,
                data: {
                  userId: authenticatedUser.id,
                  message: "Successfully registered with user ID",
                },
              })

              log.debug(
                `Client ${ws.id} successfully registered as user ${authenticatedUser.id}${authenticatedUser.web3Wallet ? ` (${authenticatedUser.web3Wallet})` : ""}`,
              )
            } catch (err) {
              log.error(`Error verifying JWT token`, err)
            }
          }
        }
      })()
    },
  })
}

export class SocketManager implements ISocketManager {
  private log: Logger
  private mapClientIdToSocket: Record<string, any> = {}
  private mapUserIdToClientIds: Record<number, Set<string>> = {}
  private mapClientIdToUserId: Record<string, number> = {}

  constructor(log: Logger) {
    this.log = log
  }

  public registerClient(socket: any, clientId: string): boolean {
    this.log.debug(`Registering client: ${clientId}`)

    const totalConnections = this.getConnectedClientsCount()
    if (totalConnections >= serverConfig.SOCKET_MAX_TOTAL_CONNECTIONS) {
      this.log.warn(`Total connection limit exceeded: ${totalConnections}`, {
        clientId,
      })
      return false
    }

    this.mapClientIdToSocket[clientId] = socket
    return true
  }

  public registerUser(clientId: string, userId: number): boolean {
    this.log.debug(`Associating client ${clientId} with user ${userId}`)

    // Remove any existing association for this client
    const existingUserId = this.mapClientIdToUserId[clientId]
    if (existingUserId) {
      this.mapUserIdToClientIds[existingUserId]?.delete(clientId)
      if (this.mapUserIdToClientIds[existingUserId]?.size === 0) {
        delete this.mapUserIdToClientIds[existingUserId]
      }
    }

    // Check per-user connection limit
    const userConnections = this.mapUserIdToClientIds[userId]?.size ?? 0
    if (userConnections >= serverConfig.SOCKET_MAX_CONNECTIONS_PER_USER) {
      this.log.warn(
        `Per-user connection limit exceeded for user ${userId}: ${userConnections}`,
        { clientId },
      )
      return false
    }

    // Add new association
    this.mapClientIdToUserId[clientId] = userId
    if (!this.mapUserIdToClientIds[userId]) {
      this.mapUserIdToClientIds[userId] = new Set()
    }
    this.mapUserIdToClientIds[userId].add(clientId)
    return true
  }

  public async sendToUser(
    userId: number,
    message: WebSocketMessage,
  ): Promise<boolean> {
    const clientIds = this.mapUserIdToClientIds[userId]
    if (!clientIds || clientIds.size === 0) {
      this.log.debug(`No connected clients for user ${userId}`)
      return false
    }

    let sent = false
    const staleClientIds: string[] = []

    for (const clientId of clientIds) {
      const socket = this.mapClientIdToSocket[clientId]
      if (socket) {
        try {
          // Check if socket is ready before sending (readyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)
          if (socket.readyState !== undefined && socket.readyState !== 1) {
            staleClientIds.push(clientId)
            continue
          }
          socket.send(message)
          sent = true
          this.log.debug(
            `Message sent to user ${userId} via client ${clientId}`,
          )
        } catch (err: any) {
          // EPIPE and similar errors are expected when clients disconnect
          if (err?.code === "EPIPE" || err?.code === "ECONNRESET") {
            staleClientIds.push(clientId)
          } else {
            this.log.warn(`Error sending message to client ${clientId}:`, err)
            staleClientIds.push(clientId)
          }
        }
      }
    }

    // Clean up stale sockets
    for (const clientId of staleClientIds) {
      this.deregister(clientId)
    }

    return sent
  }

  public async broadcast(message: WebSocketMessage): Promise<number> {
    let count = 0
    const staleClientIds: string[] = []

    for (const clientId in this.mapClientIdToSocket) {
      const socket = this.mapClientIdToSocket[clientId]
      if (socket) {
        try {
          // Check if socket is ready before sending (readyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)
          if (socket.readyState !== undefined && socket.readyState !== 1) {
            staleClientIds.push(clientId)
            continue
          }
          socket.send(message)
          count++
        } catch (err: any) {
          // EPIPE and similar errors are expected when clients disconnect
          if (err?.code === "EPIPE" || err?.code === "ECONNRESET") {
            staleClientIds.push(clientId)
          } else {
            this.log.warn(`Error broadcasting to client ${clientId}:`, err)
            staleClientIds.push(clientId)
          }
        }
      }
    }

    // Clean up stale sockets
    for (const clientId of staleClientIds) {
      this.deregister(clientId)
    }

    this.log.debug(`Broadcast message sent to ${count} clients`)
    return count
  }

  public deregister(clientId: string) {
    this.log.debug(`Deregistering client: ${clientId}`)

    // Remove from client socket map
    delete this.mapClientIdToSocket[clientId]

    // Remove user association
    const userId = this.mapClientIdToUserId[clientId]
    if (userId) {
      delete this.mapClientIdToUserId[clientId]
      this.mapUserIdToClientIds[userId]?.delete(clientId)
      if (this.mapUserIdToClientIds[userId]?.size === 0) {
        delete this.mapUserIdToClientIds[userId]
      }
    }
  }

  public getConnectedUsersCount(): number {
    return Object.keys(this.mapUserIdToClientIds).length
  }

  public getConnectedClientsCount(): number {
    return Object.keys(this.mapClientIdToSocket).length
  }
}
