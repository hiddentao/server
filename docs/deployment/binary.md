# Binary Deployment

QuickDapp builds self-contained executables that include the server, all dependencies, and static assets. Upload the single file to your server and run it—no Node.js or Bun runtime required.

## Building

```shell
bun run build
```

This creates binaries for multiple platforms in `dist/binaries/`:
- `quickdapp-linux-x64` — Linux servers (x64)
- `quickdapp-linux-arm64` — Linux servers (ARM64)
- `quickdapp-darwin-x64` — macOS (Intel)
- `quickdapp-darwin-arm64` — macOS (Apple Silicon)
- `quickdapp-windows-x64.exe` — Windows

## Running

Make the binary executable and run it:

```shell
chmod +x quickdapp-linux-x64
NODE_ENV=production ./quickdapp-linux-x64
```

The binary reads environment variables from `.env`, `.env.production`, and `.env.production.local` in order.

## Server Deployment

Upload the binary and environment file to your server:

```shell
scp dist/binaries/quickdapp-linux-x64 user@server:/opt/quickdapp/
scp .env.production user@server:/opt/quickdapp/.env

ssh user@server
cd /opt/quickdapp
chmod +x quickdapp-linux-x64
NODE_ENV=production ./quickdapp-linux-x64
```

For background execution:

```shell
nohup NODE_ENV=production ./quickdapp-linux-x64 > quickdapp.log 2>&1 &
```

## Platform Notes

**macOS**: You may need to remove the quarantine attribute on first run:
```shell
xattr -d com.apple.quarantine quickdapp-darwin-x64
```

**Windows**: Run from Command Prompt with environment variables:
```cmd
set NODE_ENV=production
quickdapp-windows-x64.exe
```

## Security

Set proper file permissions:

```shell
chmod 750 quickdapp-linux-x64  # Execute for owner/group only
chmod 640 .env                 # Read for owner/group only
```

Consider running as a dedicated non-root user:

```shell
sudo useradd -r -s /bin/false quickdapp
sudo chown quickdapp:quickdapp quickdapp-linux-x64
sudo -u quickdapp ./quickdapp-linux-x64
```
