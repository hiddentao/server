import { GraphQLErrorCode } from "../../shared/graphql/errors"

/**
 * Base application error class that all custom errors extend from
 */
export class ApplicationError extends Error {
  constructor(
    message: string,
    public code?: string,
    public metadata?: Record<string, any>,
  ) {
    super(message)
    this.name = this.constructor.name
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Error for input validation failures
 */
export class ValidationError extends ApplicationError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, GraphQLErrorCode.INVALID_INPUT, metadata)
  }
}

/**
 * Error for authentication-related failures
 */
export class AuthenticationError extends ApplicationError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, GraphQLErrorCode.AUTHENTICATION_FAILED, metadata)
  }
}

/**
 * Error for database operation failures
 */
export class DatabaseError extends ApplicationError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, GraphQLErrorCode.DATABASE_ERROR, metadata)
  }
}

/**
 * Error for resource not found scenarios
 */
export class NotFoundError extends ApplicationError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, GraphQLErrorCode.NOT_FOUND, metadata)
  }
}

/**
 * Error for SIWE (Sign-in with Ethereum) related failures
 */
export class SiweError extends ApplicationError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, GraphQLErrorCode.INVALID_SIGNATURE, metadata)
  }
}

/**
 * Error for external service failures (APIs, etc.)
 */
export class ExternalServiceError extends ApplicationError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, GraphQLErrorCode.INTERNAL_ERROR, metadata)
  }
}

/**
 * Error for disabled account access attempts
 */
export class AccountDisabledError extends ApplicationError {
  constructor(message = "Account is disabled", metadata?: Record<string, any>) {
    super(message, GraphQLErrorCode.ACCOUNT_DISABLED, metadata)
  }
}
