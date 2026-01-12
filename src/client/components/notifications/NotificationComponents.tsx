import {
  NotificationType,
  type TokenCreatedNotificationData,
  type TokenTransferNotificationData,
} from "@shared/notifications/types"
import { format } from "date-fns"

interface NotificationItemProps {
  id: number
  data: TokenCreatedNotificationData | TokenTransferNotificationData
  createdAt: string
  read: boolean
  onClick: () => void
}

/**
 * Token creation notification component
 */
function TokenCreatedNotification({
  data,
  createdAt,
  read,
  onClick,
}: NotificationItemProps & { data: TokenCreatedNotificationData }) {
  return (
    <div
      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
        read ? "bg-slate-800 border-slate-700" : "bg-slate-700 border-slate-600"
      } hover:bg-slate-600`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-sm font-medium text-green-400 mb-1">
            Token Created 🪙
          </p>
          <p className="text-sm mb-2">{data.message}</p>
          <div className="text-xs text-slate-400 space-y-1">
            <div>
              <span className="font-medium">Token:</span> {data.tokenSymbol} (
              {data.tokenName})
            </div>
            <div>
              <span className="font-medium">Supply:</span> {data.initialSupply}
            </div>
            <div>
              <span className="font-medium">Address:</span>{" "}
              {data.tokenAddress.slice(0, 6)}...{data.tokenAddress.slice(-4)}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {format(new Date(createdAt), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
        {!read && (
          <div className="w-2 h-2 bg-blue-500 rounded-full ml-2 mt-1" />
        )}
      </div>
    </div>
  )
}

/**
 * Token transfer notification component
 */
function TokenTransferNotification({
  data,
  createdAt,
  read,
  onClick,
}: NotificationItemProps & { data: TokenTransferNotificationData }) {
  return (
    <div
      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
        read ? "bg-slate-800 border-slate-700" : "bg-slate-700 border-slate-600"
      } hover:bg-slate-600`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-400 mb-1">
            Token Transfer 📤
          </p>
          <p className="text-sm mb-2">{data.message}</p>
          <div className="text-xs text-slate-400 space-y-1">
            <div>
              <span className="font-medium">Token:</span> {data.tokenSymbol} (
              {data.tokenName})
            </div>
            <div>
              <span className="font-medium">Amount:</span> {data.amount}
            </div>
            <div>
              <span className="font-medium">To:</span> {data.to.slice(0, 6)}...
              {data.to.slice(-4)}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {format(new Date(createdAt), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
        {!read && (
          <div className="w-2 h-2 bg-blue-500 rounded-full ml-2 mt-1" />
        )}
      </div>
    </div>
  )
}

/**
 * Generic notification component that renders the appropriate type-specific component
 */
export function NotificationItem({
  id,
  data,
  createdAt,
  read,
  onClick,
}: NotificationItemProps) {
  switch (data.type) {
    case NotificationType.TOKEN_CREATED:
      return (
        <TokenCreatedNotification
          id={id}
          data={data}
          createdAt={createdAt}
          read={read}
          onClick={onClick}
        />
      )
    case NotificationType.TOKEN_TRANSFER:
      return (
        <TokenTransferNotification
          id={id}
          data={data}
          createdAt={createdAt}
          read={read}
          onClick={onClick}
        />
      )
    default: {
      // Fallback for unknown notification types - TypeScript ensures this should never happen
      const _exhaustiveCheck: never = data
      return (
        <div
          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
            read
              ? "bg-slate-800 border-slate-700"
              : "bg-slate-700 border-slate-600"
          } hover:bg-slate-600`}
          onClick={onClick}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <p className="text-sm">Unknown notification type</p>
              <p className="text-xs text-slate-400 mt-1">
                {format(new Date(createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
            {!read && (
              <div className="w-2 h-2 bg-blue-500 rounded-full ml-2 mt-1" />
            )}
          </div>
        </div>
      )
    }
  }
}
