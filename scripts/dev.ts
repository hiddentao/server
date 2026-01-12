#!/usr/bin/env bun

import { existsSync } from "node:fs"
import path from "node:path"
import { $, spawn } from "bun"
import { watch } from "fs"
import { copyStaticSrc } from "./shared/copy-static-src"
import { createScriptRunner, type ScriptOptions } from "./shared/script-runner"

interface DevOptions extends ScriptOptions {
  // No additional options needed - host/port come from env
}

async function devHandler(
  _options: DevOptions,
  config: { rootFolder: string; env: string },
) {
  console.log("🚀 Starting Echo development server...")
  console.log("")

  // Check for sample contracts and provide helpful message
  const envLocalPath = path.join(config.rootFolder, ".env.local")
  if (!existsSync(envLocalPath)) {
    console.log("💡 Tip: Deploy sample contracts with:")
    console.log("   cd sample-contracts && bun deploy.ts")
    console.log("")
  }

  // Copy static-src to static
  copyStaticSrc(config.rootFolder, true)

  // Generate types (ABIs, GraphQL, db migrations)
  console.log("🔧 Generating types...")
  try {
    await $`bun run gen`
    console.log("✅ Types generated")
  } catch (error) {
    console.warn("⚠️  Type generation failed:", error)
  }
  console.log("")

  // Start the server with watch mode
  const server = spawn({
    cmd: ["bun", "--watch", "src/server/index.ts"],
    env: {
      ...process.env,
      NODE_ENV: config.env,
    },
    stdout: "inherit",
    stderr: "inherit",
  })

  // Start Vite dev server for frontend
  const vite = spawn({
    cmd: ["bun", "vite", "dev"],
    cwd: path.join(config.rootFolder, "src/client"),
    env: {
      ...process.env,
      NODE_ENV: config.env,
    },
    stdout: "inherit",
    stderr: "inherit",
  })

  // Watch GraphQL files and regenerate types on changes
  const graphqlPath = path.join(config.rootFolder, "src/shared/graphql")
  let codegenTimeout: Timer | null = null

  const runCodegen = async () => {
    console.log("📝 GraphQL files changed, regenerating types...")
    try {
      await $`bun run gen`
      console.log("✅ Types regenerated")
    } catch (error) {
      console.error("❌ Type regeneration failed:", error)
    }
  }

  // Watch for changes in GraphQL files
  watch(graphqlPath, { recursive: true }, (_event, filename) => {
    if (
      filename &&
      filename.endsWith(".ts") &&
      !filename.includes("generated/") &&
      !filename.includes("codegen.ts")
    ) {
      // Debounce to avoid multiple rapid regenerations
      if (codegenTimeout) clearTimeout(codegenTimeout)
      codegenTimeout = setTimeout(runCodegen, 500)
    }
  })

  console.log("👀 Watching GraphQL files for changes...")

  // Handle graceful shutdown
  const handleShutdown = () => {
    console.log("\n🛑 Shutting down development servers...")
    server.kill()
    vite.kill()
    process.exit(0)
  }

  process.on("SIGINT", handleShutdown)
  process.on("SIGTERM", handleShutdown)

  await Promise.all([server.exited, vite.exited])
}

// Create script runner
export const { runScript: runDev } = createScriptRunner(
  {
    name: "dev",
    description:
      "Start the development server with auto-restart on file changes",
    env: "development",
  },
  devHandler,
)
