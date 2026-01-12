import { getGraphQLClient } from "@shared/graphql/client"
import { GET_MY_UNREAD_NOTIFICATIONS_COUNT } from "@shared/graphql/queries"
import { useQuery } from "@tanstack/react-query"
import * as React from "react"
import {
  type NotificationFromSocket,
  useNotifications,
} from "../../hooks/useNotifications"
import { Button } from "../Button"
import { Svg } from "../Svg"
import { NotificationsDialog } from "./NotificationsDialog"

// Bell icon component
function BellIcon({ className }: { className?: string }) {
  return (
    <Svg viewBox="0 0 24 24" className={className}>
      <path
        fillRule="evenodd"
        d="M5.25 9a6.75 6.75 0 0113.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 01-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 11-7.48 0 24.585 24.585 0 01-4.831-1.243.75.75 0 01-.298-1.205A8.217 8.217 0 005.25 9.75V9zm4.502 8.9a2.25 2.25 0 104.496 0 25.057 25.057 0 01-4.496 0z"
        clipRule="evenodd"
      />
    </Svg>
  )
}

interface NotificationsIndicatorProps {
  className?: string
}

export function NotificationsIndicator({
  className,
}: NotificationsIndicatorProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [localUnreadCount, setLocalUnreadCount] = React.useState<number>(0)

  // Initial unread count from GraphQL
  const { data: serverUnreadCount, isLoading } = useQuery({
    queryKey: ["unreadNotificationsCount"],
    queryFn: async () => {
      const response = await getGraphQLClient().request<{
        getMyUnreadNotificationsCount: number
      }>(GET_MY_UNREAD_NOTIFICATIONS_COUNT)
      return response.getMyUnreadNotificationsCount
    },
    // Reduced interval since we have real-time updates
    refetchInterval: 120000, // Refetch every 2 minutes as fallback
  })

  // Update local count when server data changes
  React.useEffect(() => {
    if (typeof serverUnreadCount === "number") {
      setLocalUnreadCount(serverUnreadCount)
    }
  }, [serverUnreadCount])

  // Subscribe to real-time notifications
  useNotifications({
    onNotificationReceived: React.useCallback(
      (notification: NotificationFromSocket) => {
        // Only increment count for unread notifications
        if (!notification.read) {
          setLocalUnreadCount((prev) => prev + 1)
        }
      },
      [],
    ),
  })

  const handleUnreadCountChange = React.useCallback((newCount: number) => {
    setLocalUnreadCount(newCount)
  }, [])

  const displayCount = localUnreadCount

  return (
    <>
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className={className}
          disabled={isLoading}
        >
          <BellIcon className="h-5 w-5" />
          {displayCount && displayCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
              {displayCount > 99 ? "99+" : displayCount}
            </span>
          )}
        </Button>
      </div>
      <NotificationsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUnreadCountChange={handleUnreadCountChange}
      />
    </>
  )
}
