# Test

The test command runs the integration test suite with database isolation and proper cleanup.

## Running Tests

```shell
bun run test                    # Run all tests
bun run test --pattern auth     # Run matching tests
bun run test --watch            # Watch mode
bun run test --verbose          # Debug logging
bun run test --bail             # Stop on first failure
bun run test --timeout 60000    # Custom timeout (ms)
```

## How It Works

Before running tests, the command resets the test database with `bun run db push --force`. Each test file runs in isolation with a clean database state.

Tests discover `*.test.ts` files in the [`tests/`](https://github.com/QuickDapp/QuickDapp/blob/main/tests/) directory. They run serially to prevent database conflicts.

## Test Structure

```
tests/
├── helpers/              # Test utilities
│   ├── server.ts        # Server lifecycle
│   ├── database.ts      # Database helpers
│   └── auth.ts          # Auth helpers
└── server/              # Integration tests
    ├── auth/            # Authentication tests
    └── graphql/         # GraphQL tests
```

## Writing Tests

```typescript
import { beforeAll, afterAll, test, expect } from 'bun:test'
import { startTestServer } from '../helpers/server'
import type { TestServer } from '../helpers/server'

let testServer: TestServer

beforeAll(async () => {
  testServer = await startTestServer()
})

afterAll(async () => {
  await testServer.shutdown()
})

test('example test', async () => {
  // Test implementation
})
```

## Debugging

Enable verbose logging with a temporary config file:

```shell
bun run test --verbose
```

This creates `.env.test.local` with `LOG_LEVEL=debug` and `WORKER_LOG_LEVEL=debug`, which is cleaned up after the run.

For persistent debug config:

```shell
echo "LOG_LEVEL=debug" > .env.test.local
bun run test
rm .env.test.local
```

## Environment

Tests use `.env.test` for configuration:

```bash
NODE_ENV=test
DATABASE_URL=postgresql://postgres:@localhost:5432/quickdapp_test
```

The test database should be separate from development to avoid data conflicts.
