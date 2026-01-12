#!/usr/bin/env bun

import { existsSync } from "node:fs"
import path from "node:path"
import { spawn } from "bun"
import {
  createScriptRunner,
  type ScriptOptions,
  type SubcommandConfig,
} from "./shared/script-runner"

interface ProdOptions extends ScriptOptions {
  // No additional options needed
}

async function serverHandler(
  _options: ProdOptions,
  config: { rootFolder: string; env: string },
) {
  const serverPath = path.join(config.rootFolder, "dist", "server", "binary.js")

  if (!existsSync(serverPath)) {
    console.error("❌ Production server not found. Run 'bun run build' first.")
    process.exit(1)
  }

  console.log("🚀 Starting Echo production server...")

  const server = spawn({
    cmd: ["bun", serverPath],
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  })

  const handleShutdown = () => {
    console.log("\n🛑 Shutting down production server...")
    server.kill()
    process.exit(0)
  }

  process.on("SIGINT", handleShutdown)
  process.on("SIGTERM", handleShutdown)

  await server.exited
}

async function clientHandler(
  _options: ProdOptions,
  config: { rootFolder: string; env: string },
) {
  const clientPath = path.join(config.rootFolder, "dist", "client")
  const clientSrcPath = path.join(config.rootFolder, "src", "client")

  if (!existsSync(clientPath)) {
    console.error("❌ Production client not found. Run 'bun run build' first.")
    process.exit(1)
  }

  console.log("🌐 Starting Echo production client preview...")
  console.log("   Available at: http://localhost:4173")

  const server = spawn({
    cmd: ["bun", "vite", "preview", "--port", "4173", "--host"],
    cwd: clientSrcPath,
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  })

  const handleShutdown = () => {
    console.log("\n🛑 Shutting down client preview...")
    server.kill()
    process.exit(0)
  }

  process.on("SIGINT", handleShutdown)
  process.on("SIGTERM", handleShutdown)

  await server.exited
}

async function defaultHandler(
  _options: ProdOptions,
  config: { rootFolder: string; env: string },
) {
  const serverPath = path.join(config.rootFolder, "dist", "server", "binary.js")
  const clientPath = path.join(config.rootFolder, "dist", "client")
  const clientSrcPath = path.join(config.rootFolder, "src", "client")

  if (!existsSync(serverPath)) {
    console.error("❌ Production server not found. Run 'bun run build' first.")
    process.exit(1)
  }

  if (!existsSync(clientPath)) {
    console.error("❌ Production client not found. Run 'bun run build' first.")
    process.exit(1)
  }

  console.log("🚀 Starting Echo in production mode...")
  console.log("   Server: http://localhost:3000")
  console.log("   Client preview: http://localhost:4173")
  console.log("")

  // Start the production server
  const server = spawn({
    cmd: ["bun", serverPath],
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  })

  // Start client preview server
  const client = spawn({
    cmd: ["bun", "vite", "preview", "--port", "4173", "--host"],
    cwd: clientSrcPath,
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
    stdout: "inherit",
    stderr: "inherit",
  })

  const handleShutdown = () => {
    console.log("\n🛑 Shutting down production servers...")
    server.kill()
    client.kill()
    process.exit(0)
  }

  process.on("SIGINT", handleShutdown)
  process.on("SIGTERM", handleShutdown)

  await Promise.all([server.exited, client.exited])
}

// Define subcommands
const subcommands: SubcommandConfig[] = [
  {
    name: "server",
    description: "Run production server only",
    handler: serverHandler,
  },
  {
    name: "client",
    description: "Run production client preview only",
    handler: clientHandler,
  },
]

// Create script runner with subcommands and default handler
createScriptRunner(
  {
    name: "prod",
    description: "Run Echo in production mode",
    env: "production",
    subcommands,
  },
  defaultHandler,
)
