# Dev

The development server provides hot reloading for both frontend and backend, with integrated worker processes and WebSocket support.

## Starting

```shell
bun run dev              # Standard startup
bun run dev --verbose    # Detailed logging
```

This starts:
- ElysiaJS backend on port 3000
- Vite frontend on port 5173 (proxied through 3000)
- Worker processes for background jobs
- WebSocket server at `/ws`

## Hot Reload

**Backend changes** that reload automatically:
- GraphQL resolvers
- Route handlers
- Utility functions

**Changes requiring restart**:
- Database schema
- Worker job definitions
- Server bootstrap logic

**Frontend changes** reload instantly via Vite HMR:
- React components
- CSS/Tailwind
- TypeScript files

## Environment

Development uses layered configuration:

```shell
.env                    # Base configuration
.env.development        # Development overrides
.env.local              # Personal overrides (gitignored)
```

Example `.env.development`:

```bash
NODE_ENV=development
LOG_LEVEL=debug
DATABASE_URL=postgresql://postgres:@localhost:5432/quickdapp_dev
CHAIN=anvil
WEB3_ANVIL_RPC=http://localhost:8545
WORKER_COUNT=1
```

## Debugging

Enable debug logging:

```shell
LOG_LEVEL=debug WORKER_LOG_LEVEL=debug bun run dev
```

Run with reduced workers for easier debugging:

```shell
WORKER_COUNT=1 bun run dev
```

## Database Workflow

After modifying [`src/server/db/schema.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/db/schema.ts):

```shell
bun run gen       # Generate types and migrations
bun run db push   # Push changes to development database
```

## Troubleshooting

**Port in use**:
```shell
lsof -ti:3000 | xargs kill -9
```

**Database connection failed**:
```shell
brew services list | grep postgresql
```

**Hot reload not working**:
```shell
rm -rf node_modules/.vite
bun run dev
```
