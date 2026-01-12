# Build

The build command creates production-ready artifacts including optimized bundles and self-contained binaries.

## Building

```shell
bun run build
```

This creates:

```
dist/
├── client/              # Optimized frontend bundle
│   ├── index.html
│   └── assets/          # CSS, JS, images
├── server/              # Compiled server
│   ├── index.js
│   ├── binary.js
│   └── binary-assets.json
└── binaries/            # Self-contained executables
    ├── quickdapp-linux-x64
    ├── quickdapp-linux-arm64
    ├── quickdapp-darwin-x64
    ├── quickdapp-darwin-arm64
    └── quickdapp-windows-x64.exe
```

## Options

```shell
bun run build --no-clean    # Keep previous build artifacts
bun run build --bundle      # Embed client in server for single-file serving
```

## Production Environment

Create `.env.production` for production configuration:

```bash
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL=postgresql://user:password@prod-host:5432/quickdapp
SESSION_ENCRYPTION_KEY=your_32_character_production_key
WEB3_SERVER_WALLET_PRIVATE_KEY=0xYourProductionWalletKey
CHAIN=sepolia
WEB3_FACTORY_CONTRACT_ADDRESS=0xYourContractAddress
WORKER_COUNT=cpus
```

## Running the Build

After building, run with:

```shell
# Using bun (requires Bun on server)
bun run prod

# Using binary (no dependencies)
./dist/binaries/quickdapp-linux-x64
```

## Verifying

Test the production build locally:

```shell
bun run build
NODE_ENV=production bun run prod
curl http://localhost:3000/health
```
