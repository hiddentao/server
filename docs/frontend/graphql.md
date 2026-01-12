# GraphQL Client

The frontend communicates with the backend API using `graphql-request` paired with React Query for caching and state management. GraphQL handles authentication and notifications—blockchain interactions use Wagmi and Viem directly.

## Client Setup

The [`getGraphQLClient()`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/graphql/client.ts) function returns a singleton GraphQL client configured with the API endpoint. The [`setAuthToken()`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/graphql/client.ts) function updates the Authorization header when a user signs in or out.

The [`AuthContext`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/contexts/AuthContext.tsx) manages the token lifecycle. When authentication succeeds, it stores the JWT and configures the client. On sign-out or token expiry, it clears the header and resets the auth state.

## Operations

Queries and mutations are defined in the shared folder so both client and server can reference them. The main operations include:

**Authentication**: [`VALIDATE_TOKEN`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/graphql/queries.ts) checks if the current JWT is valid on app initialization. The SIWE mutations handle wallet-based sign-in.

**Notifications**: [`GET_MY_NOTIFICATIONS`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/graphql/queries.ts) fetches paginated notifications, [`GET_MY_UNREAD_NOTIFICATIONS_COUNT`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/graphql/queries.ts) returns the badge count, and mutations mark notifications as read.

See [`src/shared/graphql/queries.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/graphql/queries.ts) and [`src/shared/graphql/mutations.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/graphql/mutations.ts) for all available operations.

## Real-time Updates

GraphQL doesn't handle real-time updates. Instead, WebSockets push notifications directly to connected clients. When the server creates a notification, it emits a `NotificationReceived` message through the socket connection. The [`useNotifications`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/hooks/useNotifications.ts) hook listens for these messages and updates the React Query cache automatically.

## Error Handling

When the server returns an `UNAUTHORIZED` error code, the [`AuthContext`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/contexts/AuthContext.tsx) clears the token and prompts re-authentication. Other GraphQL errors surface through React Query's error handling.

## On-chain Operations

Blockchain interactions bypass GraphQL entirely. Use Wagmi hooks and Viem for reading contract state, sending transactions, and handling wallet connections. See the [Web3 documentation](./web3.md) for details.
