import {
  type ConnectedMessage,
  type RegisteredMessage,
  type WebSocketMessage,
  WebSocketMessageType,
} from "@shared/websocket/types"
import type { ReactNode } from "react"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Socket } from "../lib/socket"
import { useAuthContext } from "./AuthContext"

interface SocketContextValue {
  connected: boolean
  subscribe: (
    type: WebSocketMessageType,
    handler: (message: WebSocketMessage) => void,
  ) => () => void
}

const SocketContext = createContext<SocketContextValue | null>(null)

interface SocketProviderProps {
  children: ReactNode
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { authToken, isLoading } = useAuthContext()
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const prevAuthTokenRef = useRef<string | null>(null)
  const authChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize socket connection only after auth loading is complete
  useEffect(() => {
    if (isLoading) {
      console.debug("SocketProvider: Waiting for auth to complete loading")
      return
    }

    console.debug("SocketProvider: Initializing socket connection")

    const socket = new Socket()
    socketRef.current = socket

    // Track connection status
    const checkConnectionStatus = () => {
      setConnected(socket.connected)
    }

    // Check connection status periodically
    const interval = setInterval(checkConnectionStatus, 1000)

    // Initial status check
    socket
      .onceReady()
      .then(() => {
        checkConnectionStatus()
      })
      .catch(() => {
        checkConnectionStatus()
      })

    // Handle connection messages
    const unsubscribeConnected = socket.subscribe(
      WebSocketMessageType.Connected,
      (message: WebSocketMessage) => {
        const connectedMessage = message as ConnectedMessage
        console.log("WebSocket connected:", connectedMessage.data.message)
      },
    )

    const unsubscribeRegistered = socket.subscribe(
      WebSocketMessageType.Registered,
      (message: WebSocketMessage) => {
        const registeredMessage = message as RegisteredMessage
        console.log(
          `WebSocket registered with user ID ${registeredMessage.data.userId}: ${registeredMessage.data.message}`,
        )
      },
    )

    return () => {
      unsubscribeConnected()
      unsubscribeRegistered()
      clearInterval(interval)
      if (authChangeTimeoutRef.current) {
        clearTimeout(authChangeTimeoutRef.current)
      }
      socket.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [isLoading])

  // Update JWT token when auth state changes and handle authentication flow
  useEffect(() => {
    if (isLoading || !socketRef.current) {
      return
    }

    const hadToken = prevAuthTokenRef.current !== null
    const hasToken = authToken !== null

    console.debug("SocketProvider: Auth state change", {
      hadToken,
      hasToken,
      tokenPresent: authToken ? "present" : "not present",
    })

    // Clear any pending auth change timeout
    if (authChangeTimeoutRef.current) {
      clearTimeout(authChangeTimeoutRef.current)
    }

    // Debounce auth changes to prevent connection storms
    authChangeTimeoutRef.current = setTimeout(() => {
      if (!socketRef.current) return

      // If user just became authenticated (went from no token to having token)
      // force a reconnection to establish authenticated session
      if (!hadToken && hasToken) {
        console.debug(
          "SocketProvider: User authenticated, forcing WebSocket reconnection",
        )
        socketRef.current.reconnectWithToken(authToken ?? undefined)
      }
      // If user logged out (went from having token to no token)
      // force a reconnection to establish unauthenticated session
      else if (hadToken && !hasToken) {
        console.debug(
          "SocketProvider: User logged out, forcing WebSocket reconnection",
        )
        socketRef.current.reconnectWithToken(undefined)
      }
      // Otherwise just update the token (e.g., token refresh)
      else {
        socketRef.current.setJwtToken(authToken ?? undefined)
      }

      // Update the previous token reference
      prevAuthTokenRef.current = authToken
    }, 100) // 100ms debounce delay
  }, [isLoading, authToken])

  const subscribe = useCallback(
    (
      type: WebSocketMessageType,
      handler: (message: WebSocketMessage) => void,
    ) => {
      if (!socketRef.current) {
        console.warn(
          "SocketProvider: Attempted to subscribe but socket not available",
        )
        return () => {} // Return no-op unsubscribe
      }

      return socketRef.current.subscribe(type, handler)
    },
    [],
  )

  const contextValue = useMemo(
    (): SocketContextValue => ({
      connected,
      subscribe,
    }),
    [connected, subscribe],
  )

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider")
  }
  return context
}
