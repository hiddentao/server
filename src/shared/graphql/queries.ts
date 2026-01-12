import { gql } from "graphql-tag"

export const GET_MY_NOTIFICATIONS = gql`
  query GetMyNotifications($pageParam: PageParam!) {
    getMyNotifications(pageParam: $pageParam) {
      notifications {
        id
        userId
        data
        createdAt
        read
      }
      startIndex
      total
    }
  }
`

export const GET_MY_UNREAD_NOTIFICATIONS_COUNT = gql`
  query GetMyUnreadNotificationsCount {
    getMyUnreadNotificationsCount
  }
`

export const VALIDATE_TOKEN = gql`
  query ValidateToken {
    validateToken {
      valid
      web3Wallet
    }
  }
`
