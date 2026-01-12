/**
 * GraphQL error codes for consistent error handling throughout the application
 * Available on both client and server side
 */
export enum GraphQLErrorCode {
  // Authentication errors
  UNAUTHORIZED = "UNAUTHORIZED",
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  ACCOUNT_DISABLED = "ACCOUNT_DISABLED",

  // OAuth errors
  OAUTH_CONFIG_ERROR = "OAUTH_CONFIG_ERROR",
  OAUTH_PROVIDER_ERROR = "OAUTH_PROVIDER_ERROR",
  OAUTH_STATE_INVALID = "OAUTH_STATE_INVALID",

  // Database errors
  DATABASE_ERROR = "DATABASE_ERROR",

  // Generic errors
  NOT_FOUND = "NOT_FOUND",
  INVALID_INPUT = "INVALID_INPUT",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}
