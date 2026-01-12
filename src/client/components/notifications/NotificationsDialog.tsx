import { getGraphQLClient } from "@shared/graphql/client"
import {
  MARK_ALL_NOTIFICATIONS_AS_READ,
  MARK_NOTIFICATION_AS_READ,
} from "@shared/graphql/mutations"
import { GET_MY_NOTIFICATIONS } from "@shared/graphql/queries"
import type { NotificationData } from "@shared/notifications/types"
import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { useCallback, useEffect, useMemo } from "react"
import {
  type NotificationFromSocket,
  useNotifications,
} from "../../hooks/useNotifications"
import { Button } from "../Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../Dialog"
import { Loading } from "../Loading"
import { useOnceVisibleInViewport } from "../OnceVisibleInViewport"
import { NotificationItem } from "./NotificationComponents"

// Helper component for load more trigger
function LoadMoreTrigger({
  onLoadMore,
  isLoading,
}: {
  onLoadMore: () => void
  isLoading: boolean
}) {
  const { ref, hasBeenVisible } = useOnceVisibleInViewport()

  useEffect(() => {
    if (hasBeenVisible) {
      onLoadMore()
    }
  }, [hasBeenVisible, onLoadMore])

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className="flex justify-center py-4"
    >
      {isLoading ? (
        <Loading />
      ) : (
        <Button onClick={onLoadMore} variant="outline" size="sm">
          Load More
        </Button>
      )}
    </div>
  )
}

interface Notification {
  id: number
  userId: number
  data: NotificationData
  createdAt: string
  read: boolean
}

interface NotificationsResponse {
  notifications: Notification[]
  startIndex: number
  total: number
}

interface NotificationsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUnreadCountChange?: (count: number) => void
}

export function NotificationsDialog({
  open,
  onOpenChange,
  onUnreadCountChange,
}: NotificationsDialogProps) {
  const queryClient = useQueryClient()

  // Simplified WebSocket notification handler with optimistic updates
  const handleNotificationReceived = useCallback(
    (notification: NotificationFromSocket) => {
      if (open) {
        // Optimistically add the new notification to the cache
        const oldData = queryClient.getQueryData(["notifications"]) as
          | InfiniteData<NotificationsResponse>
          | undefined

        if (oldData && oldData.pages.length > 0) {
          // Add notification to the first page (most recent)
          const newData = {
            ...oldData,
            pages: [
              {
                ...oldData.pages[0]!,
                notifications: [
                  notification,
                  ...oldData.pages[0]!.notifications,
                ],
                total: oldData.pages[0]!.total + 1,
              },
              ...oldData.pages.slice(1),
            ],
          }
          queryClient.setQueryData(["notifications"], newData)
        } else {
          // If no data cached yet, just invalidate to fetch
          queryClient.invalidateQueries({ queryKey: ["notifications"] })
        }

        // Always invalidate unread count
        queryClient.invalidateQueries({
          queryKey: ["unreadNotificationsCount"],
        })
      }
    },
    [open, queryClient],
  )

  // Subscribe to real-time notifications when dialog is open
  useNotifications({
    onNotificationReceived: handleNotificationReceived,
  })

  // Use infinite query for automatic pagination and caching
  const {
    data,
    isLoading,
    isFetching,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: async ({ pageParam = { startIndex: 0, perPage: 20 } }) => {
      const response = await getGraphQLClient().request<{
        getMyNotifications: NotificationsResponse
      }>(GET_MY_NOTIFICATIONS, { pageParam })
      return response.getMyNotifications
    },
    initialPageParam: { startIndex: 0, perPage: 20 },
    getNextPageParam: (lastPage, _, lastPageParam) => {
      // If we've fetched all notifications, no more pages
      if (lastPageParam.startIndex + lastPageParam.perPage >= lastPage.total) {
        return undefined
      }
      return {
        startIndex: lastPageParam.startIndex + lastPageParam.perPage,
        perPage: lastPageParam.perPage,
      }
    },
    enabled: open,
    staleTime: 30000, // Cache for 30 seconds
  })

  // Flatten all notifications from all pages and deduplicate
  const allNotifications = useMemo(() => {
    if (!data?.pages) return []

    const allNotifs = data.pages.flatMap((page) => page.notifications)

    // Deduplicate based on ID and sort by creation date
    const seen = new Set<number>()
    return allNotifs
      .filter((notification) => {
        if (seen.has(notification.id)) return false
        seen.add(notification.id)
        return true
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  }, [data])

  // Update unread count when notifications change
  useEffect(() => {
    if (onUnreadCountChange && allNotifications.length > 0) {
      const unreadCount = allNotifications.filter((n) => !n.read).length
      onUnreadCountChange(unreadCount)
    }
  }, [allNotifications, onUnreadCountChange])

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await getGraphQLClient().request<{
        markNotificationAsRead: { success: boolean }
      }>(MARK_NOTIFICATION_AS_READ, { id })
      return response.markNotificationAsRead
    },
    onMutate: async (id) => {
      // Optimistically update the infinite query data
      const oldData = queryClient.getQueryData(["notifications"]) as
        | InfiniteData<NotificationsResponse>
        | undefined

      if (oldData) {
        const newData = {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            notifications: page.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n,
            ),
          })),
        }
        queryClient.setQueryData(["notifications"], newData)
      }

      return { oldData }
    },
    onError: (_, __, context) => {
      // Rollback on error
      if (context?.oldData) {
        queryClient.setQueryData(["notifications"], context.oldData)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unreadNotificationsCount"] })
    },
  })

  // Mark all notifications as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await getGraphQLClient().request<{
        markAllNotificationsAsRead: { success: boolean }
      }>(MARK_ALL_NOTIFICATIONS_AS_READ)
      return response.markAllNotificationsAsRead
    },
    onMutate: async () => {
      // Optimistically update all notifications to read
      const oldData = queryClient.getQueryData(["notifications"]) as
        | InfiniteData<NotificationsResponse>
        | undefined

      if (oldData) {
        const newData = {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            notifications: page.notifications.map((n) => ({
              ...n,
              read: true,
            })),
          })),
        }
        queryClient.setQueryData(["notifications"], newData)
      }

      return { oldData }
    },
    onError: (_, __, context) => {
      // Rollback on error
      if (context?.oldData) {
        queryClient.setQueryData(["notifications"], context.oldData)
      }
    },
    onSuccess: () => {
      // Update unread count in parent component
      if (onUnreadCountChange) {
        onUnreadCountChange(0)
      }
      queryClient.invalidateQueries({ queryKey: ["unreadNotificationsCount"] })
    },
  })

  const handleMarkAsRead = useCallback(
    (id: number) => {
      markAsReadMutation.mutate(id)
    },
    [markAsReadMutation],
  )

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsReadMutation.mutate()
  }, [markAllAsReadMutation])

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Refetch when dialog opens
  useEffect(() => {
    if (open && !isFetching) {
      refetch()
    }
  }, [open, isFetching, refetch])

  const hasUnreadNotifications = useMemo(
    () => allNotifications.some((n) => !n.read),
    [allNotifications],
  )

  // Memoized notification items to prevent re-rendering
  const notificationItems = useMemo(() => {
    return allNotifications.map((notification) => (
      <NotificationItem
        key={notification.id}
        id={notification.id}
        data={notification.data}
        createdAt={notification.createdAt}
        read={notification.read}
        onClick={() => !notification.read && handleMarkAsRead(notification.id)}
      />
    ))
  }, [allNotifications, handleMarkAsRead])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Notifications</DialogTitle>
          <DialogDescription>
            {data?.pages?.[0]?.total
              ? `${data.pages[0].total} notification${
                  data.pages[0].total === 1 ? "" : "s"
                }`
              : "Your notifications will appear here"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading && allNotifications.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loading />
            </div>
          ) : isError ? (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">Failed to load notifications</p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          ) : allNotifications.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No notifications yet
            </div>
          ) : (
            <div className="space-y-2">
              {notificationItems}

              {hasNextPage && (
                <LoadMoreTrigger
                  onLoadMore={loadMore}
                  isLoading={isFetchingNextPage}
                />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {hasUnreadNotifications && (
            <Button
              onClick={handleMarkAllAsRead}
              variant="outline"
              size="sm"
              disabled={markAllAsReadMutation.isPending}
            >
              {markAllAsReadMutation.isPending
                ? "Marking..."
                : "Mark All as Read"}
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)} variant="default">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
