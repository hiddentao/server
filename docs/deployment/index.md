# Deployment

QuickDapp supports two deployment strategies: self-contained binaries and Docker containers. Both provide simple, reliable deployment with minimal server requirements.

## Deployment Options

**Binary Deployment** creates standalone executables that include all dependencies and assets. No runtime is needed on the server—just upload and run. This is the recommended approach for most deployments.

**Docker Deployment** packages the application in containers for orchestration environments. Use this when your infrastructure is already containerized.

See [Binary Deployment](./binary.md) and [Docker Deployment](./docker.md) for detailed instructions.

## Quick Start

```shell
# Build the application
bun run build

# Run migrations
NODE_ENV=production bun run db migrate

# Deploy binary
./dist/binaries/quickdapp-linux-x64

# Or deploy with Docker
docker build -t quickdapp:latest .
docker run -d -p 3000:3000 --env-file .env.production quickdapp:latest
```

## Environment Configuration

Create `.env.production` with your production settings:

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
SESSION_ENCRYPTION_KEY=your_32_character_encryption_key

# Web3 (optional)
WEB3_ENABLED=true
WEB3_SERVER_WALLET_PRIVATE_KEY=0xYourWalletPrivateKey
CHAIN=sepolia
WEB3_SEPOLIA_RPC=https://sepolia.infura.io/v3/your-api-key
WEB3_FACTORY_CONTRACT_ADDRESS=0xYourContractAddress
```

## Infrastructure

**Minimum requirements**: 1 CPU core, 512MB RAM, 1GB disk for testing; 2 cores, 1GB RAM for production.

**Database**: PostgreSQL 11 or higher. Use a managed service (AWS RDS, DigitalOcean, Railway, Supabase) for production.

**HTTPS**: Use a reverse proxy like Nginx for SSL termination. The WebSocket endpoint at `/ws` requires proper upgrade headers.

## Health Monitoring

The server provides a health endpoint:

```shell
curl http://localhost:3000/health
```

Configure your monitoring system to check this endpoint for uptime alerts.
