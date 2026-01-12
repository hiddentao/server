# WebSockets

QuickDapp uses WebSockets for real-time communication between the server and connected clients. When the application creates a notification, it gets saved to the database and immediately pushed to the user's browser sessions.

## How It Works

Clients connect to `/ws` after authenticating. They send a registration message with their JWT token, and the server associates that connection with their user ID. From then on, any notification created for that user gets delivered instantly.

The [`SocketManager`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/ws/index.ts) tracks two mappings: client IDs to WebSocket connections, and user IDs to sets of client IDs. A single user can have multiple browser tabs open, and each receives the same notifications.

When a worker process creates a notification, it sends an IPC message to the main server process, which then routes the message through the `SocketManager` to the user's connected clients.

## Connection Lifecycle

1. Client establishes WebSocket connection to `/ws`
2. Server sends a `Connected` message confirming the connection
3. Client sends `register` with JWT token
4. Server validates the token and associates the connection with the user
5. Server sends `Registered` confirmation
6. Server pushes `NotificationReceived` messages as notifications are created
7. On disconnect, server removes the client from its tracking maps

## Message Types

Messages are defined in [`src/shared/websocket/types.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/websocket/types.ts):

- `Connected` — Initial connection acknowledgment
- `Registered` — User registration successful
- `NotificationReceived` — New notification with id, userId, data, createdAt, read
- `Error` — Connection errors (limit exceeded, invalid token)

## Connection Limits

The server enforces connection limits through configuration:

- `SOCKET_MAX_TOTAL_CONNECTIONS` — Global limit across all users
- `SOCKET_MAX_CONNECTIONS_PER_USER` — Per-user limit

When limits are exceeded, the connection receives an `Error` message and closes.

## Client Usage

The frontend's [`SocketContext`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/contexts/SocketContext.tsx) handles the connection automatically. It reconnects when authentication state changes and provides a `subscribe()` method for listening to specific message types:

```typescript
const { subscribe } = useSocket()

useEffect(() => {
  return subscribe(WebSocketMessageType.NotificationReceived, (message) => {
    // Handle new notification
  })
}, [subscribe])
```

There are no GraphQL subscriptions—all real-time updates flow through this WebSocket connection.

See [`src/server/ws/index.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/ws/index.ts) for the server implementation and [`src/client/lib/socket.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/client/lib/socket.ts) for the client wrapper.
