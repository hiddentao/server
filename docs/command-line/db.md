# Database

Database commands manage schema changes through DrizzleORM. Use `push` for development and `migrate` for production.

## Commands

### push

Applies schema changes directly to the database without migration files:

```shell
bun run db push          # Apply changes
bun run db push --force  # Force destructive changes
```

Use during development for rapid iteration. This command is destructive and should never be used in production.

### generate

Creates migration files from schema changes:

```shell
bun run db generate
```

Run this before deploying to production. Migration files are saved in [`src/server/db/migrations/`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/db/migrations/).

### migrate

Runs pending migrations:

```shell
bun run db migrate
```

Use in production for safe, versioned schema updates. This only applies previously generated migration files.

## Workflow

### Development

```shell
# 1. Edit schema
# src/server/db/schema.ts

# 2. Generate types and push changes
bun run gen
bun run db push
```

### Production Deployment

```shell
# 1. Generate migrations (in development)
bun run db generate

# 2. Commit migration files
git add src/server/db/migrations/
git commit -m "Add new migration"

# 3. Deploy and migrate (on production server)
NODE_ENV=production bun run db migrate
```

## Configuration

Database commands read from environment-specific files:

```bash
# .env.development
DATABASE_URL=postgresql://postgres:@localhost:5432/quickdapp_dev

# .env.test
DATABASE_URL=postgresql://postgres:@localhost:5432/quickdapp_test

# .env.production
DATABASE_URL=postgresql://user:pass@prod-host:5432/quickdapp
```

## Troubleshooting

**Connection failed**:
```shell
psql "$DATABASE_URL" -c "SELECT 1;"
```

**Reset development database**:
```shell
bun run db push --force
```

**Check migration status**:
```shell
psql "$DATABASE_URL" -c "SELECT * FROM __drizzle_migrations;"
```
