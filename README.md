# Echo backend server

[![CI](https://github.com/the-echo-app-/server/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/the-echo-app-/server/actions/workflows/ci.yml)

This is the backend server for Echo app, built on [QuickDapp](https://quickdapp.xyz)

## Prerequisites

- **Node.js** v22.0.0 or higher
- **Bun** v1.0.0 or higher
- **Docker** and **Docker Compose**
- **Git**

## Quick Start

Before doing anything you will need to setup the local environment file - `.env.local`:

```

```


### Option A: Full Docker Setup (Recommended)

Run everything in Docker with HMR support:

```bash
docker compose up --build
```

This starts both PostgreSQL and the dev server. The application will be available at **http://localhost:5173**

To run in background:
```bash
docker compose up -d --build
docker compose logs -f server  # follow server logs
```

### Option B: Local Development

Run the server locally with Docker for PostgreSQL only:

#### 1. Start Database

```bash
docker compose up -d postgres
```

**Dev database connection details:**
- Host: `localhost`
- Port: `55433`
- User: `postgres`
- Password: (none)
- Database: `echo_dev`
- Connection string: `postgresql://postgres@localhost:55433/echo_dev`

#### 2. Install Dependencies

```bash
bun install
```

#### 3. Setup Database Schema

```bash
bun run db push
```

#### 4. Seed Database (Optional)

```bash
bun run db seed
```

#### 5. Start Development Server

```bash
bun run dev
```

The application will be available at **http://localhost:5173**


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

The test database (`echo_test`) is automatically created when you start the Docker Compose services.

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

## Docker Management

```bash
# Stop all services
docker compose down

# Stop only the database
docker compose stop postgres

# Reset database (removes all data)
docker compose down -v && docker compose up -d --build

# Clear and re-seed database
SEED_CLEAR=true docker compose up --build

# Rebuild server after dependency changes
docker compose up -d --build server

# View logs
docker compose logs -f
docker compose logs -f server
docker compose logs -f postgres
```

## License

All Rights Reserved.
