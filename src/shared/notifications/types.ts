/**
 * Notification types that can be sent to users via WebSocket
 */
export enum NotificationType {
  TOKEN_CREATED = "token_created",
  TOKEN_TRANSFER = "token_transfer",
}

/**
 * Base notification data structure with generic type parameter
 */
export interface BaseNotificationData<
  T extends NotificationType = NotificationType,
> {
  type: T
  message: string
}

/**
 * Token creation notification data
 */
export interface TokenCreatedNotificationData
  extends BaseNotificationData<NotificationType.TOKEN_CREATED> {
  transactionHash: string
  tokenAddress: string
  creator: string
  initialSupply: string
  tokenSymbol: string
  tokenName: string
}

/**
 * Token transfer notification data
 */
export interface TokenTransferNotificationData
  extends BaseNotificationData<NotificationType.TOKEN_TRANSFER> {
  transactionHash: string
  tokenAddress: string
  from: string
  to: string
  amount: string
  tokenSymbol: string
  tokenName: string
}

/**
 * Discriminated union type for all possible notification data structures
 * TypeScript will validate the structure based on the type property
 */
export type NotificationData =
  | TokenCreatedNotificationData
  | TokenTransferNotificationData

/**
 * Type helper to get specific notification data by type
 */
export type NotificationDataByType<T extends NotificationType> =
  T extends NotificationType.TOKEN_CREATED
    ? TokenCreatedNotificationData
    : T extends NotificationType.TOKEN_TRANSFER
      ? TokenTransferNotificationData
      : never
