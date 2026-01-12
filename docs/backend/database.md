# Database

QuickDapp uses DrizzleORM with PostgreSQL. DrizzleORM provides type-safe queries that compile to efficient SQL, with full TypeScript integration so your IDE catches errors before they reach production.

## Schema

The schema is defined in TypeScript at [`src/server/db/schema.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/db/schema.ts). QuickDapp includes four core tables:

**users** stores user accounts. Authentication methods are stored separately in the `userAuth` table, so a single user can have multiple ways to sign in (wallet, email, OAuth).

**userAuth** links authentication methods to users. Each row represents one auth method with its type (like "web3_wallet" or "email") and identifier (the wallet address or email). The unique constraint on `authIdentifier` prevents duplicate registrations.

**notifications** stores user notifications with JSON data and read status. The application creates notifications through `ServerApp` and delivers them in real-time via WebSocket.

**workerJobs** manages background job scheduling. Jobs have a due time, optional cron schedule for recurring execution, and fields for tracking status and results.

```typescript
// Core tables from src/server/db/schema.ts
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  disabled: boolean("disabled").default(false).notNull(),
  settings: json("settings"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export const userAuth = pgTable("user_auth", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  authType: text("auth_type").notNull(),
  authIdentifier: text("auth_identifier").unique().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})
```

## Queries

Access the database through `serverApp.db`. DrizzleORM queries read like SQL but with full type checking:

```typescript
// Find user by auth identifier
const authRecord = await serverApp.db
  .select()
  .from(userAuth)
  .where(eq(userAuth.authIdentifier, walletAddress))
  .then(rows => rows[0])

// Get notifications for a user with pagination
const userNotifications = await serverApp.db
  .select()
  .from(notifications)
  .where(eq(notifications.userId, userId))
  .orderBy(desc(notifications.createdAt))
  .limit(20)
  .offset(page * 20)

// Count unread notifications
const [{ count }] = await serverApp.db
  .select({ count: sql<number>`count(*)` })
  .from(notifications)
  .where(and(
    eq(notifications.userId, userId),
    eq(notifications.read, false)
  ))
```

## Transactions

QuickDapp uses PostgreSQL's SERIALIZABLE isolation level with automatic retry on serialization conflicts. The [`withTransaction`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/db/shared.ts) helper handles this:

```typescript
import { withTransaction } from "./db/shared"

await withTransaction(serverApp.db, async (tx) => {
  // Create user
  const [user] = await tx.insert(users).values({}).returning()

  // Create auth record
  await tx.insert(userAuth).values({
    userId: user.id,
    authType: "web3_wallet",
    authIdentifier: walletAddress.toLowerCase()
  })

  // If anything fails, entire transaction rolls back
})
```

The transaction wrapper automatically retries up to 7 times when PostgreSQL reports a serialization conflict. This approach avoids `FOR UPDATE` row locking while still preventing race conditions.

## Connection Management

The database connection is managed through a singleton in [`src/server/db/connection.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/db/connection.ts). The `DatabaseConnectionManager` handles connection pooling and ensures only one pool exists per process.

Pool sizes vary by context: 10 connections for the main server, 2 per worker process, and 1 for tests. The manager tracks global state to prevent connection leaks during test cleanup.

## Migrations

Schema changes go through DrizzleORM's migration system:

```bash
# Generate migration from schema changes
bun run gen

# Apply migrations (production)
bun run db migrate

# Push schema directly (development only, destructive)
bun run db push
```

Migration files are generated in [`src/server/db/migrations/`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/db/migrations/). Never edit them after creation—instead, create a new migration for fixes.

## Query Modules

Database operations are organized into modules under [`src/server/db/`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/db/):

- [`users.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/db/users.ts) — User CRUD, finding by ID or creating new users
- [`userAuth.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/db/userAuth.ts) — Auth method management, finding users by auth identifier
- [`notifications.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/db/notifications.ts) — Creating and querying notifications, marking as read
- [`worker.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/db/worker.ts) — Job scheduling, status updates, cleanup
- [`settings.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/db/settings.ts) — Application settings key-value storage

Each module exports functions that take `ServerApp` (or a transaction) and return typed results.

## Performance Patterns

All database operations are wrapped with `startSpan` for Sentry tracing. This provides visibility into query performance and helps identify slow queries in production.

For complex queries involving multiple tables, use joins rather than separate queries to avoid N+1 problems. GraphQL resolvers should never use field resolvers that trigger additional database calls—fetch all needed data in the parent resolver instead.
