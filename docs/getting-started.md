# Getting started

## Step 0 - Pre-requisites

Ensure you have the following pre-requisites installed and ready:

* [Bun](https://bun.sh/) v1.0+ (required - only supported runtime and package manager)
* [PostgreSQL](https://www.postgresql.org/) 11+ running locally on port 5432, with a default admin user called `postgres`.
* [Git](https://git-scm.com/) for version control.
* [Foundry](https://book.getfoundry.sh/getting-started/installation) (optional - for Web3/smart contract development)

!!!
QuickDapp exclusively uses Bun as its runtime and package manager. npm/yarn/pnpm are not supported. This design choice ensures optimal performance and consistency across all development, testing, and deployment workflows.
!!!

## Step 1 - Source code

Clone or fork the QuickDapp repository from GitHub:

```shell
git clone https://github.com/QuickDapp/quickdapp.git
cd quickdapp
```

## Step 2 - Dependencies

In the project folder, let's install the dependencies:

```shell
bun install
```

## Step 3 - PostgreSQL database

By default, QuickDapp assumes the existence of a [PostgreSQL](https://www.postgresql.org/) database. The default connection parameters (defined in the `.env` file) are:

* host: `localhost`
* port: `5432`
* user: `postgres`
* db: `quickdapp_dev`

If you haven't already, create the `quickdapp_dev` database, ensuring the `postgres` user has full system-level privileged access to it:

```shell
psql -U postgres -c 'CREATE DATABASE quickdapp_dev'
```

Let's get the dev database setup:

```shell
bun run db push
```

This command uses DrizzleORM to set up your database schema based on the definitions in `src/server/db/schema.ts`.

## Step 4 - Start development server

Now start the QuickDapp development server:

```shell
bun run dev
```

This will:
* Start the backend server on http://localhost:3000
* GraphQL endpoint at http://localhost:3000/graphql and health at http://localhost:3000/health
* Start the Vite frontend development server on http://localhost:5173
* Generate contract ABIs and copy static assets
* Enable hot reload for both frontend and backend changes

The development server provides live reloading for an optimal development experience.

## Step 5 - Interact with the application

Open http://localhost:5173 in your browser to interact with the application.

The development setup includes:
* GraphQL API with authentication
* Real-time WebSocket connections
* Background job processing
* Comprehensive logging
* Optional Web3 wallet integration via RainbowKit (if enabled)

## Step 6 - Run tests

QuickDapp includes a basic test framework. Run tests with:

```shell
bun run test
```

You can add your own tests to the `tests/` directory. The test framework includes database isolation, server lifecycle management, and GraphQL testing utilities.

## Step 7 - Deploying to production

The following steps cover deploying your application to production.

We will do the following:

* Build the application for production.
* Deploy using Docker containers or binary builds.
* Use a hosted PostgreSQL database as the production database.
* (Optional) Deploy smart contracts for Web3 applications.

!!!
QuickDapp supports multiple deployment strategies: Docker containers, self-contained binaries, or separate frontend/backend deployments. The choice depends on your infrastructure preferences.
!!!

## Step 8 - Setup production database

We will setup a PostgreSQL database for production use. You can use any PostgreSQL hosting service such as:

* [DigitalOcean Managed Databases](https://www.digitalocean.com/products/managed-databases)
* [AWS RDS](https://aws.amazon.com/rds/)
* [Railway](https://railway.app/)
* [Supabase](https://supabase.com/)

Once you have your production database connection string, add it to your `.env.production` file (or create a production environment file):

```ini
DATABASE_URL="postgresql://user:password@host:5432/database"
```

Now setup the production database schema:

```shell
bun run db migrate
```

## Step 9 - Test-run production build locally

_Note: This step is optional, and is useful if you want to debug some production issues locally_

In the project folder, build the production apps:

```shell
bun run build
# Optionally bundle client into server static assets so server serves the SPA:
# bun run build --bundle
```

Now, run the production apps:

```shell
bun run prod
```

Open http://localhost:3000 in your browser to test the production build locally.

## Step 10 - Deploy to production

QuickDapp supports several deployment options:

**Option A: Binary deployment**
Build a self-contained binary with embedded assets:

```shell
bun run build
# Binaries are created automatically in dist/binaries/
```

**Option B: Docker deployment**
Build and run as Docker containers:

```shell
docker build -t quickdapp .
docker run -p 3000:3000 quickdapp
```

See the [deployment documentation](./deployment/) for detailed guides on various deployment strategies.

## Step 11 - Hurrah!

**Congratulations! Your application is now available on the web in production mode.**

## Optional: Web3 Setup

If building a Web3 application, you can enable blockchain features:

### Local Development

1. Install Foundry if not already installed:
```shell
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

2. Start local blockchain:
```shell
cd sample-contracts
bun devnet.ts
```

3. Deploy sample contracts:
```shell
cd sample-contracts
bun deploy.ts
```

4. Import the test mnemonic into your wallet (e.g., MetaMask):
```
test test test test test test test test test test test junk
```

5. Add local network to wallet: Chain ID 31337, RPC http://localhost:8545

### Production Web3 Deployment

To deploy contracts to Sepolia testnet:

1. Get Sepolia ETH from a faucet and an RPC endpoint
2. Set environment variables in `.env.production`:
```bash
WEB3_SUPPORTED_CHAINS=sepolia
WEB3_SEPOLIA_RPC="https://sepolia.infura.io/v3/your-api-key"
WEB3_SERVER_WALLET_PRIVATE_KEY="0x..."
```
3. Deploy: `cd sample-contracts && bun deploy.ts`

## Next steps

Now that you have QuickDapp running, explore the documentation to learn about:

* [Backend architecture](./backend/) - Understanding the ServerApp pattern and database layer
* [Frontend development](./frontend/) - Building React components and optional Web3 integrations
* [Worker system](./worker/) - Adding background jobs and cron tasks
* [Command line tools](./command-line/) - Development and deployment commands
* [Testing](./getting-started.md#step-6---run-tests) - Writing and running tests
