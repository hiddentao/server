# Docker Deployment

QuickDapp can be deployed using Docker containers. The Dockerfile uses pre-built binaries for a minimal image size.

## Building the Image

Build the application first, then create the Docker image:

```shell
bun run build
docker build -t quickdapp:latest .
```

## Running

Run with an environment file:

```shell
docker run -d \
  --name quickdapp \
  -p 3000:3000 \
  --env-file .env.production \
  quickdapp:latest
```

Or pass environment variables directly:

```shell
docker run -d \
  --name quickdapp \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e SESSION_ENCRYPTION_KEY="your_32_character_key" \
  quickdapp:latest
```

## Container Registry

Push to a registry for deployment:

```shell
docker tag quickdapp:latest your-registry.com/quickdapp:latest
docker push your-registry.com/quickdapp:latest
```

## Monitoring

```shell
# View logs
docker logs quickdapp

# Monitor resources
docker stats quickdapp

# Health check
curl http://localhost:3000/health
```

## Multi-Platform Builds

Build for multiple architectures:

```shell
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t quickdapp:latest \
  --push .
```
