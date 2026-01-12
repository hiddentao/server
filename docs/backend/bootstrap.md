# Bootstrap

The bootstrap process creates the `ServerApp` object that gets passed throughout the application. This happens once at startup and provides every component with access to shared services like the database, logger, and WebSocket manager.

## How Startup Works

When the server starts, [`src/server/index.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/index.ts) checks the `WORKER_ID` environment variable. If set, it runs as a worker process. Otherwise, it starts the main HTTP server.

The main server path calls `createApp()` in [`start-server.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/start-server.ts), which initializes services in order:

1. **Sentry** — Error tracking and performance monitoring (if configured)
2. **SocketManager** — WebSocket connection handling
3. **WorkerManager** — Spawns worker child processes
4. **ServerApp** — Created via `createServerApp()` in [`bootstrap.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/bootstrap.ts)
5. **ElysiaJS** — HTTP server with GraphQL, health checks, static files

Worker processes follow a simpler path. They create a `ServerApp` without the worker manager (to avoid circular spawning) and run the job polling loop.

## The createServerApp Function

The core bootstrap logic lives in [`src/server/bootstrap.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/bootstrap.ts). It connects to the database, creates blockchain clients if Web3 is enabled, and assembles everything into the `ServerApp` object:

```typescript
export async function createServerApp(options: {
  includeWorkerManager?: boolean
  workerCountOverride?: number
  socketManager: ISocketManager
  rootLogger: Logger
}): Promise<ServerApp> {
  const db = await dbManager.connect()

  // Web3 clients only when enabled
  const { publicClient, walletClient } = createBlockchainClients(rootLogger)

  // Notification helper that persists to DB and sends via WebSocket
  const createNotification = async (userId: number, data: NotificationData) => {
    // Inserts to DB and sends via WebSocket
  }

  const baseServerApp = { db, rootLogger, createLogger, startSpan, ... }

  if (includeWorkerManager) {
    return { ...baseServerApp, workerManager: await createWorkerManager(...) }
  }
  return baseServerApp
}
```

## Using ServerApp

GraphQL resolvers receive `ServerApp` through their context. The GraphQL handler builds the context for each request:

```typescript
// In src/server/graphql/index.ts
const context = {
  serverApp,
  user: authenticatedUser,  // null if not authenticated
  operationName,
  requiresAuth
}
```

Resolvers then access services through this context:

```typescript
const resolvers = {
  Query: {
    getMyNotifications: async (_, { limit, offset }, context) => {
      const { serverApp, user } = context
      return getNotifications(serverApp.db, user.id, limit, offset)
    }
  }
}
```

Worker jobs receive `ServerApp` as their first parameter along with job data:

```typescript
export const run: JobRunner = async ({ serverApp, log, job }) => {
  // Full access to database, blockchain clients, etc.
  const result = await serverApp.db.select().from(settings)
  log.info("Job completed", { result })
}
```

## Configuration

The bootstrap process loads configuration through a layered system:

1. `.env` — Base configuration, committed to git
2. `.env.{NODE_ENV}` — Environment-specific overrides
3. `.env.local` — Local developer overrides, gitignored

Access configuration through the typed [`serverConfig`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/config/server.ts) object. Never read `process.env` directly in application code—this ensures type safety and consistent defaults.

## Testing

Tests create their own `ServerApp` with the worker manager disabled:

```typescript
const serverApp = await createServerApp({
  socketManager: createTestSocketManager(),
  workerManager: undefined
})
```

The test helpers in [`tests/helpers/`](https://github.com/QuickDapp/QuickDapp/blob/main/tests/helpers/) provide utilities for creating test servers, managing database state, and cleaning up between tests.

See [`src/server/bootstrap.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/bootstrap.ts) for the complete implementation and [`src/server/types.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/types.ts) for the `ServerApp` type definition.
