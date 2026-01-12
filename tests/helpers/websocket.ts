/**
 * WebSocket test helpers for Echo
 *
 * Utilities for testing WebSocket connections, messages,
 * and connection management.
 */

import {
  WebSocketErrorCode,
  type WebSocketMessage,
  WebSocketMessageType,
} from "../../src/shared/websocket/types"
import { testLogger } from "./logger"

export interface TestWebSocketClient {
  ws: WebSocket
  id: string
  receivedMessages: WebSocketMessage[]
  disconnect: () => void
  waitForMessage: (
    type: WebSocketMessageType,
    timeoutMs?: number,
  ) => Promise<WebSocketMessage>
  getReceivedMessages: (type?: WebSocketMessageType) => WebSocketMessage[]
  sendRegister: (jwtToken?: string) => void
}

/**
 * Create a test WebSocket client
 */
export async function createTestWebSocketClient(
  serverUrl: string,
  options: {
    autoRegister?: boolean
    jwtToken?: string
    timeoutMs?: number
  } = {},
): Promise<TestWebSocketClient> {
  const { autoRegister = true, jwtToken, timeoutMs = 5000 } = options

  const wsUrl = serverUrl.replace("http:", "ws:") + "/ws"
  const ws = new WebSocket(wsUrl)
  const id = Math.random().toString(36).substring(2, 15)
  const receivedMessages: WebSocketMessage[] = []

  // Set up message handler
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data as string) as WebSocketMessage
      receivedMessages.push(message)
      testLogger.debug(`WS client ${id} received:`, message)
    } catch (err) {
      testLogger.error(`WS client ${id} failed to parse message:`, err)
    }
  }

  // Wait for connection to open
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`WebSocket connection timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    ws.onopen = () => {
      clearTimeout(timeout)
      testLogger.debug(`WS client ${id} connected`)
      resolve()
    }

    ws.onerror = (error) => {
      clearTimeout(timeout)
      reject(error)
    }
  })

  const client: TestWebSocketClient = {
    ws,
    id,
    receivedMessages,
    disconnect: () => {
      ws.close()
    },
    waitForMessage: async (
      type: WebSocketMessageType,
      waitTimeoutMs = 5000,
    ) => {
      // Check if message already received
      const existing = receivedMessages.find((m) => m.type === type)
      if (existing) return existing

      return new Promise<WebSocketMessage>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Timeout waiting for message type: ${type} after ${waitTimeoutMs}ms`,
            ),
          )
        }, waitTimeoutMs)

        const originalOnMessage = ws.onmessage
        ws.onmessage = (event) => {
          if (originalOnMessage) {
            originalOnMessage.call(ws, event)
          }
          try {
            const message = JSON.parse(event.data as string) as WebSocketMessage
            if (message.type === type) {
              clearTimeout(timeout)
              resolve(message)
            }
          } catch {
            // Ignore parse errors
          }
        }
      })
    },
    getReceivedMessages: (type?: WebSocketMessageType) => {
      if (type) {
        return receivedMessages.filter((m) => m.type === type)
      }
      return [...receivedMessages]
    },
    sendRegister: (token?: string) => {
      ws.send(JSON.stringify({ type: "register", jwtToken: token }))
    },
  }

  // Auto-register if requested
  if (autoRegister) {
    client.sendRegister(jwtToken)
  }

  return client
}

/**
 * Create multiple WebSocket clients for testing connection limits
 */
export async function createMultipleWebSocketClients(
  serverUrl: string,
  count: number,
  options: {
    jwtToken?: string
    autoRegister?: boolean
  } = {},
): Promise<TestWebSocketClient[]> {
  const clients: TestWebSocketClient[] = []

  for (let i = 0; i < count; i++) {
    const client = await createTestWebSocketClient(serverUrl, options)
    clients.push(client)
  }

  return clients
}

/**
 * Disconnect all WebSocket clients
 */
export function disconnectAllClients(clients: TestWebSocketClient[]): void {
  for (const client of clients) {
    client.disconnect()
  }
}

/**
 * Wait for a specific error code
 */
export async function waitForErrorCode(
  client: TestWebSocketClient,
  errorCode: WebSocketErrorCode,
  timeoutMs = 5000,
): Promise<boolean> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const errorMessages = client.getReceivedMessages(WebSocketMessageType.Error)
    for (const msg of errorMessages) {
      if ((msg.data as any)?.code === errorCode) {
        return true
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  return false
}
