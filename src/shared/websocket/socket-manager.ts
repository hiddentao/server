import type { WebSocketMessage } from "./types"

/**
 * Interface for managing WebSocket connections and sending messages to users
 * This allows different implementations for server (direct WebSocket) and worker (IPC)
 */
export interface ISocketManager {
  /**
   * Send a message to a specific user identified by their user ID
   * @param userId - The user ID to send the message to
   * @param message - The WebSocket message to send
   * @returns Promise<boolean> - True if message was sent successfully
   */
  sendToUser(userId: number, message: WebSocketMessage): Promise<boolean>

  /**
   * Broadcast a message to all connected clients
   * @param message - The WebSocket message to broadcast
   * @returns Promise<number> - Number of clients the message was sent to
   */
  broadcast(message: WebSocketMessage): Promise<number>

  // Additional methods for server-side SocketManager only
  registerClient?(socket: any, clientId: string): boolean
  registerUser?(clientId: string, userId: number): boolean
  deregister?(clientId: string): void
  getConnectedUsersCount?(): number
  getConnectedClientsCount?(): number
}
