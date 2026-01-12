import type { NotificationReceivedMessage } from "@shared/websocket/types"
import { WebSocketMessageType } from "@shared/websocket/types"
import { useCallback, useEffect, useRef } from "react"
import { useSocket } from "../contexts/SocketContext"

export interface NotificationFromSocket {
  id: number
  userId: number
  data: NotificationReceivedMessage["data"]["data"]
  createdAt: string
  read: boolean
}

interface UseNotificationsOptions {
  onNotificationReceived?: (notification: NotificationFromSocket) => void
}

/**
 * Hook for subscribing to real-time WebSocket notifications
 */
export function useNotifications(options: UseNotificationsOptions = {}) {
  const { subscribe } = useSocket()
  const { onNotificationReceived } = options
  const onNotificationReceivedRef = useRef(onNotificationReceived)

  // Keep the callback ref up to date
  useEffect(() => {
    onNotificationReceivedRef.current = onNotificationReceived
  }, [onNotificationReceived])

  const handleNotificationMessage = useCallback(
    (message: NotificationReceivedMessage) => {
      console.debug(`Notification received`, message.data)

      const notification: NotificationFromSocket = {
        id: message.data.id,
        userId: message.data.userId,
        data: message.data.data,
        createdAt: message.data.createdAt,
        read: message.data.read,
      }

      onNotificationReceivedRef.current?.(notification)
    },
    [],
  )

  useEffect(() => {
    const unsubscribe = subscribe(
      WebSocketMessageType.NotificationReceived,
      handleNotificationMessage as (message: any) => void,
    )

    return unsubscribe
  }, [subscribe, handleNotificationMessage])

  return {}
}
