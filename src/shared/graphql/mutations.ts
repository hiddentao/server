import { gql } from "graphql-tag"

// Authentication mutations
export const GENERATE_SIWE_MESSAGE = gql`
  mutation GenerateSiweMessage($address: String!, $chainId: Int!, $domain: String!) {
    generateSiweMessage(address: $address, chainId: $chainId, domain: $domain) {
      message
      nonce
    }
  }
`

export const AUTHENTICATE_WITH_SIWE = gql`
  mutation AuthenticateWithSiwe($message: String!, $signature: String!) {
    authenticateWithSiwe(message: $message, signature: $signature) {
      success
      token
      web3Wallet
      error
    }
  }
`

export const SEND_EMAIL_VERIFICATION_CODE = gql`
  mutation SendEmailVerificationCode($email: String!) {
    sendEmailVerificationCode(email: $email) {
      success
      blob
      error
    }
  }
`

export const AUTHENTICATE_WITH_EMAIL = gql`
  mutation AuthenticateWithEmail($email: String!, $code: String!, $blob: String!) {
    authenticateWithEmail(email: $email, code: $code, blob: $blob) {
      success
      token
      web3Wallet
      error
    }
  }
`

export const MARK_NOTIFICATION_AS_READ = gql`
  mutation MarkNotificationAsRead($id: PositiveInt!) {
    markNotificationAsRead(id: $id) {
      success
    }
  }
`

export const MARK_ALL_NOTIFICATIONS_AS_READ = gql`
  mutation MarkAllNotificationsAsRead {
    markAllNotificationsAsRead {
      success
    }
  }
`
