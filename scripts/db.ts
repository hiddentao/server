#!/usr/bin/env bun

import { $ } from "bun"
import {
  createScriptRunner,
  type ScriptOptions,
  type SubcommandConfig,
} from "./shared/script-runner"

interface DbOptions extends ScriptOptions {
  force?: boolean
}

export async function runDrizzleCommand(args: string[]): Promise<void> {
  // Use tee to both display output and capture it
  const tempFile = `/tmp/drizzle-output-${Date.now()}.txt`

  try {
    // Run command with tee to capture output while showing it
    await $`drizzle-kit ${args} 2>&1 | tee ${tempFile}`.nothrow()

    // Read captured output for error checking
    const result = await $`cat ${tempFile}`.text()

    // Check for error patterns in output regardless of exit code
    if (
      result.includes("PostgresError") ||
      result.includes("ERROR") ||
      result.includes("permission denied")
    ) {
      throw new Error("Command failed with database error")
    }
  } finally {
    // Clean up temp file
    await $`rm -f ${tempFile}`.nothrow()
  }
}

export async function runDbGenerate(
  options: { verbose?: boolean } = {},
): Promise<void> {
  if (options.verbose) {
    console.log("🔧 Generating DrizzleORM migrations...")
  }
  await runDrizzleCommand(["generate"])
  if (options.verbose) {
    console.log("✅ Migrations generated successfully")
  }
}

async function generateHandler(
  options: DbOptions,
  _config: { rootFolder: string; env: string },
) {
  console.log("🔧 Generating DrizzleORM migrations...")
  try {
    await runDrizzleCommand(["generate"])
    console.log("✅ Migrations generated successfully")
  } catch (error) {
    console.error("❌ Failed to generate migrations:", error)
    process.exit(1)
  }
}

async function migrateHandler(
  _options: DbOptions,
  _config: { rootFolder: string; env: string },
) {
  console.log("🚀 Running DrizzleORM migrations...")
  try {
    await runDrizzleCommand(["migrate"])
    console.log("✅ Migrations applied successfully")
  } catch (error) {
    console.error("❌ Failed to run migrations:", error)
    process.exit(1)
  }
}

async function pushHandler(
  options: DbOptions,
  _config: { rootFolder: string; env: string },
) {
  console.log("📦 Pushing schema changes to database...")
  try {
    const args = options.force ? ["push", "--force"] : ["push"]
    await runDrizzleCommand(args)
    console.log("✅ Schema changes pushed successfully")
  } catch (error) {
    console.error("❌ Failed to push schema changes:", error)
    process.exit(1)
  }
}

// Define subcommands
const subcommands: SubcommandConfig[] = [
  {
    name: "generate",
    description: "Generate DrizzleORM migrations",
    handler: generateHandler,
  },
  {
    name: "migrate",
    description: "Run DrizzleORM migrations",
    handler: migrateHandler,
  },
  {
    name: "push",
    description: "Push schema changes to database",
    handler: pushHandler,
    options: (cmd) => cmd.option("-f, --force", "force the operation"),
  },
]

// Only run CLI when executed directly (not when imported)
if (import.meta.main) {
  createScriptRunner({
    name: "db",
    description: "Database management utilities",
    env: process.env.NODE_ENV || "development",
    subcommands,
  })
}
