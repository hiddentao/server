# Echo backend server

[![CI](https://github.com/the-echo-app-/server/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/the-echo-app-/server/actions/workflows/ci.yml)

This is the backend server for Echo app, built on [QuickDapp](https://quickdapp.xyz)

## Prerequisites

- **Node.js** v22.0.0 or higher
- **Bun** v1.0.0 or higher
- **PostgreSQL** 14+ running locally
- **Git**

## Quick Start

### 1. Setup PostgreSQL Database

Create the development database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create development database
CREATE DATABASE echo_dev;
\q
```

Update the database connection in `.env.local` if your PostgreSQL setup differs:

```env
DATABASE_URL=postgresql://postgres:@localhost:5432/echo_dev
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Setup Database Schema

```bash
bun run db push
```

### 4. Start Development Server

```bash
bun run dev
```

The application will be available at **http://localhost:5173**

To get help on available options:

```bash
bun run dev -h
```


## Production

### Build for Production

```bash
bun run build
```

### Run Production Server

```bash
# Run server with client being served (default)
bun run prod

# Run client preview server only
bun run prod client
```

The production server will serve both the API and the built client application. For testing the client build separately, use the `client` subcommand which runs Vite's preview server.

## Testing

### Setup Test Database

Create the test database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create test database
CREATE DATABASE echo_test;
\q
```

Update the test database connection in `.env.test` if needed:

```env
DATABASE_URL=postgresql://postgres:@localhost:5432/echo_test
```

### Run Tests

```bash
bun run test
```


```bash
bun run test -h
```


### Test Specific Files

```bash
bun run test --pattern "blockchain"
bun run test --test-file tests/integration/server.test.ts
```

## License

All Rights Reserved.
