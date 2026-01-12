# Command Line

QuickDapp provides CLI commands for development, building, testing, and database management. All commands run through `bun run`.

## Quick Reference

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server with hot reload |
| `bun run build` | Build for production |
| `bun run prod` | Run production server |
| `bun run test` | Run test suite |
| `bun run gen` | Generate types and migrations |
| `bun run lint` | Type check and lint |
| `bun run format` | Format code |
| `bun run db push` | Push schema to database |
| `bun run db migrate` | Run migrations |

## Development

```shell
bun run dev              # Start with hot reload
bun run dev --verbose    # Detailed startup logging
```

The development server runs ElysiaJS on port 3000 with Vite on port 5173 (proxied through 3000). Both frontend and backend support hot reloading.

## Building

```shell
bun run build            # Production build with binaries
```

Creates optimized bundles in `dist/client/`, server code in `dist/server/`, and cross-platform binaries in `dist/binaries/`.

## Testing

```shell
bun run test                    # Run all tests
bun run test --pattern auth     # Run matching tests
bun run test --watch            # Watch mode
bun run test --verbose          # Debug logging
```

Tests run with isolated database state. The test database is reset before each run.

## Code Generation

```shell
bun run gen              # Generate all types
```

Generates GraphQL TypeScript types, ABI types from contracts, and DrizzleORM migration files.

## Code Quality

```shell
bun run lint             # Check types and lint
bun run lint:fix         # Auto-fix issues
bun run format           # Format with Biome
```

## Database

```shell
bun run db push          # Push schema (development)
bun run db push --force  # Force push (destructive)
bun run db generate      # Generate migration files
bun run db migrate       # Apply migrations (production)
```

Use `push` during development for quick iteration. Use `migrate` in production for safe, versioned changes.

## Environment

Commands detect environment automatically. Override with `NODE_ENV`:

```shell
NODE_ENV=production bun run build
NODE_ENV=test bun run db push
```

Environment files load in order: `.env` → `.env.{NODE_ENV}` → `.env.local`.

## Documentation

- [Dev](./dev.md) — Development server
- [Build](./build.md) — Production builds
- [Prod](./prod.md) — Production server
- [Database](./db.md) — Database commands
- [Test](./test.md) — Test runner
