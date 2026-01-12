import { clientConfig } from "@shared/config/client"
import {
  type WebSocketMessage,
  WebSocketMessageType,
} from "@shared/websocket/types"
import ReconnectingWebSocket from "reconnecting-websocket"

export interface SocketEventHandler {
  type: WebSocketMessageType
  handler: (message: WebSocketMessage) => void
}

/**
 * WebSocket client for real-time communication with the server
 */
export class Socket {
  private ws!: ReconnectingWebSocket
  private handlers: SocketEventHandler[] = []
  private url: string
  private token?: string
  private readyPromise: Promise<void> | null = null

  constructor(url?: string) {
    this.url = url || this.getWebSocketUrl()
    this.connect()
  }

  private getWebSocketUrl(): string {
    // In development mode with Vite dev server, use the current host which will be proxied
    // In production, use API_URL from client config
    if (clientConfig.NODE_ENV === "development") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
      return `${protocol}//${window.location.host}/ws`
    }

    // Production: Use API_URL from client config
    const baseUrl = new URL(clientConfig.API_URL)
    const protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:"
    return `${protocol}//${baseUrl.host}/ws`
  }

  connect(token?: string) {
    if (token) {
      this.token = token
    }

    if (this.ws && this.ws.readyState === ReconnectingWebSocket.OPEN) {
      return
    }

    // Close existing connection if any
    if (this.ws) {
      this.ws.close()
    }

    this.readyPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new ReconnectingWebSocket(this.url, [], {
          maxReconnectionDelay: 10000,
          minReconnectionDelay: 1000,
          reconnectionDelayGrowFactor: 1.3,
          connectionTimeout: 4000,
          maxRetries: Infinity,
          debug: false,
        })

        this.ws.onopen = () => {
          console.log(`WebSocket connected to ${this.url}`)

          // Send registration message
          this.send({
            type: "register",
            jwtToken: this.token,
          })

          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WebSocketMessage
            this.handleMessage(message)
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error)
          }
        }

        this.ws.onclose = (event) => {
          console.log(
            `WebSocket disconnected (code: ${event.code}, reason: ${event.reason || "none"})`,
          )
        }

        this.ws.onerror = (error) => {
          console.error(`WebSocket error (url: ${this.url}):`, error)
          reject(error)
        }
      } catch (error) {
        console.error(
          `Failed to create WebSocket connection to ${this.url}:`,
          error,
        )
        reject(error)
      }
    })
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
    }
  }

  subscribe(
    type: WebSocketMessageType,
    handler: (message: WebSocketMessage) => void,
  ): () => void {
    const eventHandler: SocketEventHandler = { type, handler }
    this.handlers.push(eventHandler)

    // Return unsubscribe function
    return () => {
      const index = this.handlers.indexOf(eventHandler)
      if (index > -1) {
        this.handlers.splice(index, 1)
      }
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === ReconnectingWebSocket.OPEN
  }

  onceReady(): Promise<void> {
    return this.readyPromise || Promise.resolve()
  }

  setJwtToken(token?: string) {
    this.token = token
    if (this.connected && this.ws) {
      // Re-register with new token
      this.send({
        type: "register",
        jwtToken: this.token,
      })
    }
  }

  /**
   * Force reconnection with new token (e.g., after authentication)
   */
  reconnectWithToken(token?: string) {
    console.log("WebSocket: Forcing reconnection with new token")
    if (token) {
      this.token = token
    }

    // Disconnect and reconnect with new token
    this.disconnect()
    this.connect(this.token)
  }

  private send(message: any) {
    if (this.ws?.readyState === ReconnectingWebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  private handleMessage(message: WebSocketMessage) {
    const matchingHandlers = this.handlers.filter(
      (h) => h.type === message.type,
    )
    matchingHandlers.forEach((h) => h.handler(message))
  }
}
