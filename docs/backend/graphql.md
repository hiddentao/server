# GraphQL

QuickDapp exposes its API through GraphQL Yoga integrated with ElysiaJS. The schema uses a custom `@auth` directive to protect operations that require authentication.

## Schema Overview

The API provides authentication and notification management. There are no GraphQL subscriptions—real-time updates happen through WebSockets instead.

**Queries** include token validation (public), fetching notifications (authenticated), and getting unread counts (authenticated).

**Mutations** handle SIWE authentication flow (generating messages, verifying signatures), email verification, OAuth login URLs, and notification management.

The full schema is defined in [`src/shared/graphql/schema.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/graphql/schema.ts). Key types:

```graphql
type Notification {
  id: PositiveInt!
  userId: PositiveInt!
  data: JSON!
  createdAt: DateTime!
  read: Boolean!
}

type AuthResult {
  success: Boolean!
  token: String
  web3Wallet: String
  error: String
}

type Query {
  validateToken: ValidateTokenResult!
  getMyNotifications(pageParam: PageParam!): NotificationsResponse! @auth
  getMyUnreadNotificationsCount: Int! @auth
}

type Mutation {
  generateSiweMessage(address: String!, chainId: Int!, domain: String!): SiweMessageResult!
  authenticateWithSiwe(message: String!, signature: String!): AuthResult!
  sendEmailVerificationCode(email: String!): EmailVerificationResult!
  authenticateWithEmail(email: String!, code: String!, blob: String!): AuthResult!
  getOAuthLoginUrl(provider: String!, redirectUrl: String!): OAuthLoginUrlResult!
  markNotificationAsRead(id: PositiveInt!): Success! @auth
  markAllNotificationsAsRead: Success! @auth
}
```

## The @auth Directive

Operations marked with `@auth` require a valid JWT in the Authorization header. The GraphQL handler extracts auth requirements at startup and checks them before running resolvers.

When an unauthenticated request tries to access a protected operation, it returns a GraphQL error with `extensions.code = "UNAUTHORIZED"`. Mixed queries containing both public and protected fields fail entirely when unauthenticated—no partial data is returned.

## Resolver Implementation

Resolvers are defined in [`src/server/graphql/resolvers.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/graphql/resolvers.ts). Each resolver receives the context containing `ServerApp` and the authenticated user (if any):

```typescript
const resolvers = {
  Query: {
    getMyNotifications: async (_, { pageParam }, context) => {
      const user = getAuthenticatedUser(context)
      return await getNotifications(context.serverApp.db, user.id, pageParam)
    }
  }
}
```

All resolvers are wrapped with `withSpan` for Sentry performance tracking. Database errors return with `extensions.code = "DATABASE_ERROR"`, authentication failures with `"AUTHENTICATION_FAILED"`, and disabled accounts with `"ACCOUNT_DISABLED"`.

## No Field Resolvers

QuickDapp deliberately avoids GraphQL field resolvers. All data is fetched in the parent resolver using SQL joins, which prevents N+1 query problems and keeps performance predictable.

## Client Integration

The frontend uses `graphql-request` with the queries and mutations defined in [`src/shared/graphql/queries.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/graphql/queries.ts) and [`mutations.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/graphql/mutations.ts). The GraphQL client is a singleton that includes the auth token when set.

See [`src/server/graphql/index.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/graphql/index.ts) for the handler setup and [`src/shared/graphql/schema.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/graphql/schema.ts) for the complete schema definition.
