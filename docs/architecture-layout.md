# Architecture Layout

QuickDapp follows a modern, clean architecture built around the **ServerApp dependency injection pattern**. This document provides an overview of how all the pieces fit together.

## High-level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     QuickDapp                               │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + Vite)                                  │
│  ├── React 19 + TypeScript                                │
│  ├── GraphQL Client (React Query)                        │
│  ├── WebSocket Client                                     │
│  └── RainbowKit + Wagmi (Optional Web3)                  │
├─────────────────────────────────────────────────────────────┤
│  Backend (Bun + ElysiaJS)                                 │
│  ├── ElysiaJS Server                                     │
│  ├── GraphQL Yoga API                                    │
│  ├── JWT Authentication (+ Optional SIWE)                │
│  ├── WebSocket Server                                    │
│  └── Static Asset Serving                                │
├─────────────────────────────────────────────────────────────┤
│  Worker System (Child Processes)                          │
│  ├── Background Job Processing                           │
│  ├── Cron Job Scheduling                                 │
│  └── IPC Communication                                   │
├─────────────────────────────────────────────────────────────┤
│  Database Layer (DrizzleORM + PostgreSQL)                 │
│  ├── Type-safe SQL Queries                               │
│  ├── Schema Migrations                                   │
│  └── Connection Pooling                                  │
├─────────────────────────────────────────────────────────────┤
│  Blockchain Layer (Optional - Viem)                       │
│  ├── Public Client (Read Operations)                     │
│  ├── Wallet Client (Write Operations)                    │
│  └── Contract Interactions                               │
└─────────────────────────────────────────────────────────────┘
```

## The ServerApp Pattern

The core architectural innovation in QuickDapp is the **ServerApp pattern** - a dependency injection system that provides clean access to shared resources across all components.

```typescript
export type ServerApp = {
  app: Elysia                    // ElysiaJS server instance
  db: Database                   // DrizzleORM database connection
  rootLogger: Logger             // Root logger instance
  createLogger: (category: string) => Logger  // Logger factory
  startSpan: typeof startSpan    // Sentry performance monitoring
  workerManager: WorkerManager   // Background job processing
  socketManager: ISocketManager  // WebSocket manager
  createNotification: (userId: number, data: NotificationData) => Promise<void>
  // Web3 (optional - when WEB3_ENABLED=true)
  publicClient?: PublicClient    // Blockchain read client
  walletClient?: WalletClient    // Blockchain write client
}
```

**Benefits of this pattern:**
* **Clean dependencies** - No global state or singletons
* **Easy testing** - Mock individual services for unit tests
* **Type safety** - Full TypeScript support across all layers
* **Consistent access** - Same interface for all components

## Directory Structure

```
src/
├── server/              # Backend server code
│   ├── db/             # Database schema, migrations, and queries
│   ├── graphql/        # GraphQL resolvers and schema
│   ├── auth/           # Authentication (SIWE + JWT)
│   ├── workers/        # Background job system
│   ├── lib/            # Server utilities (logging, etc.)
│   └── ws/             # WebSocket implementation
├── client/             # Frontend React application
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Client-side utilities
│   └── pages/          # Application pages
├── shared/             # Code shared between client/server
│   ├── config/         # Environment configuration
│   └── graphql/        # GraphQL schema definitions
scripts/                # Build and development scripts
tests/                  # Integration test suite
```

## Technology Stack

### Runtime & Server
* **Bun** - Primary runtime and package manager
* **ElysiaJS** - High-performance web framework with native WebSocket support
* **GraphQL Yoga** - GraphQL server (no GraphQL subscriptions; use WebSockets for realtime)

### Frontend
* **React 19** - Latest React with concurrent features
* **Vite** - Lightning-fast build tool and dev server
* **TypeScript** - Full type safety across the stack

### Database & ORM
* **PostgreSQL** - Robust relational database
* **DrizzleORM** - Type-safe, performant SQL toolkit
* **postgres** - High-performance PostgreSQL client

### Authentication & Security
* **JWT (Jose)** - Stateless token authentication
* **Multiple auth providers** - Email, OAuth, and SIWE (Sign-in with Ethereum)
* **Custom auth directive** - GraphQL operation-level security

### Web3 Integration (Optional)
* **Viem** - Type-safe Ethereum library
* **Wagmi** - React hooks for Ethereum
* **RainbowKit** - Wallet connection UI
* **SIWE** - Wallet-based authentication

### Background Processing
* **Child process architecture** - Isolated worker processes
* **IPC communication** - Inter-process messaging
* **Database job queue** - Persistent job storage with retry logic

## Request Flow

### GraphQL API Request
```
1. Frontend sends GraphQL query
2. ElysiaJS receives request
3. GraphQL Yoga parses and validates
4. Auth directive checks JWT token
5. Resolver function executes
6. Database query via DrizzleORM
7. Response returned to client
```

### WebSocket Connection
```
1. Client establishes WebSocket connection
2. SocketManager handles connection
3. User authentication via JWT
4. Real-time message routing
5. Notifications sent to specific users
```

### Background Job Processing
```
1. Job submitted to database queue
2. Worker process picks up job
3. Job handler executes business logic
4. Results stored and notifications sent
5. Job marked complete or retry scheduled
```

## Configuration Management

QuickDapp uses a layered configuration system:

```
.env                    # Base configuration (committed)
.env.{NODE_ENV}         # Environment-specific overrides
.env.{NODE_ENV}.local   # Environment-specific local overrides
.env.local              # Local developer overrides (gitignored)
```

Configuration is loaded by the shared bootstrap pattern and provides type-safe access via:
* `serverConfig` - Server-side configuration
* `clientConfig` - Client-side configuration (subset of server config)

## Development Workflow

### Development Mode
* **Hot reload** - Both frontend and backend update automatically
* **Database migrations** - Schema changes applied instantly
* **Worker monitoring** - Background jobs visible in logs
* **GraphQL playground** - Interactive API exploration

### Testing
* **Integration tests** - Full end-to-end testing
* **Database isolation** - Each test gets a clean database
* **Server lifecycle** - Tests manage server startup/shutdown
* **Mock services** - Authentication and external services mocked

### Production Build
* **Binary compilation** - Self-contained executables
* **Asset bundling** - Frontend assets embedded in server
* **Database migrations** - Production-safe schema updates
* **Docker support** - Container-based deployment

## Data Flow

### Authentication Flow
```
1. User initiates login (email, OAuth, or wallet)
2. Auth provider validates credentials
3. Backend verifies identity
4. JWT token issued and stored
5. Token used for subsequent requests
```

### Database Operations
```
1. TypeScript schema defines structure
2. DrizzleORM generates migrations
3. Migrations applied to database
4. Type-safe queries in application code
5. Connection pooling handles concurrency
```

### Real-time Updates
```
1. Server event occurs (job completion, etc.)
2. Notification created via ServerApp
3. SocketManager routes to connected users
4. Frontend receives WebSocket message
5. UI updates reactively
```

This architecture provides a solid foundation for building scalable, maintainable web applications with modern development practices and excellent developer experience—with optional Web3 capabilities when needed.
