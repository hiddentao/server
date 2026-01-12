# Environment Variables

QuickDapp uses environment variables for configuration, loaded from `.env` files based on `NODE_ENV`. The base `.env` file is loaded first, then environment-specific overrides (`.env.development`, `.env.test`, `.env.production`), and finally `.env.local` for developer overrides.

## Required Variables

Every QuickDapp deployment needs these core variables:

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
SESSION_ENCRYPTION_KEY=your_min_32_characters_key
API_URL=http://localhost:3000
```

The `SESSION_ENCRYPTION_KEY` must be at least 32 characters and is validated on startup.

## Web3 Variables (Optional)

When `WEB3_ENABLED=true` (the default), these variables are required:

```bash
WEB3_ENABLED=true
WEB3_SERVER_WALLET_PRIVATE_KEY=0xYourWalletPrivateKey
WEB3_SUPPORTED_CHAINS=anvil
WEB3_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
WEB3_ALLOWED_SIWE_ORIGINS=http://localhost:3000
WEB3_FACTORY_CONTRACT_ADDRESS=0xYourContractAddress
```

Set `WEB3_ENABLED=false` to disable all Web3 functionality, making the Web3 variables optional.

### Per-Chain RPC Endpoints

Server-side blockchain operations use chain-specific RPC variables:

```bash
WEB3_ANVIL_RPC=http://localhost:8545
WEB3_MAINNET_RPC=https://eth.llamarpc.com
WEB3_SEPOLIA_RPC=https://rpc.sepolia.org
WEB3_BASE_RPC=https://mainnet.base.org
```

Client-side uses viem's built-in public RPCs for each chain.

## Server Variables

```bash
WEB_ENABLED=true              # Enable web server
HOST=localhost                # Server host
PORT=3000                     # Server port
WORKER_COUNT=1                # Worker processes (or "cpus")
STATIC_ASSETS_FOLDER=         # Custom static assets path
LOG_LEVEL=info                # trace|debug|info|warn|error
WORKER_LOG_LEVEL=info         # Worker process log level
```

## OAuth Variables

Each OAuth provider needs client ID and secret:

```bash
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
OAUTH_FACEBOOK_CLIENT_ID=
OAUTH_FACEBOOK_CLIENT_SECRET=
OAUTH_GITHUB_CLIENT_ID=
OAUTH_GITHUB_CLIENT_SECRET=
OAUTH_X_CLIENT_ID=
OAUTH_X_CLIENT_SECRET=
OAUTH_TIKTOK_CLIENT_KEY=
OAUTH_TIKTOK_CLIENT_SECRET=
OAUTH_LINKEDIN_CLIENT_ID=
OAUTH_LINKEDIN_CLIENT_SECRET=
OAUTH_CALLBACK_BASE_URL=      # Base URL for OAuth callbacks
```

## External Services

```bash
MAILGUN_API_KEY=
MAILGUN_API_ENDPOINT=
MAILGUN_FROM_ADDRESS=
SENTRY_DSN=
SENTRY_WORKER_DSN=
SENTRY_TRACES_SAMPLE_RATE=1.0
SENTRY_PROFILE_SESSION_SAMPLE_RATE=1.0
```

## WebSocket Limits

```bash
SOCKET_MAX_CONNECTIONS_PER_USER=5
SOCKET_MAX_TOTAL_CONNECTIONS=10000
```

## Client-Visible Variables

These variables are safe to expose in the frontend bundle:

- `APP_NAME`, `APP_VERSION`, `NODE_ENV`
- `API_URL`
- `WEB3_ENABLED`, `WEB3_SUPPORTED_CHAINS`, `WEB3_WALLETCONNECT_PROJECT_ID`, `WEB3_FACTORY_CONTRACT_ADDRESS`
- `SENTRY_DSN`

Server-side secrets like database credentials, private keys, and OAuth secrets remain server-only. See [`src/shared/config/client.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/config/client.ts) for the client configuration and [`src/shared/config/server.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/shared/config/server.ts) for the full server configuration.
