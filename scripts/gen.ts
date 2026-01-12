#!/usr/bin/env bun

import { runDbGenerate } from "./db"
import { generateTypes } from "./shared/generate-types"
import { createScriptRunner, type ScriptOptions } from "./shared/script-runner"

async function genHandler(
  options: ScriptOptions,
  _config: { rootFolder: string; env: string },
) {
  console.log("🚀 Running code generation...")
  console.log("")

  console.log("📝 Step 1: Generating types (GraphQL + ABI)...")
  await generateTypes({ verbose: options.verbose || false })
  console.log("✅ Types generated")
  console.log("")

  console.log("🗄️  Step 2: Generating database migrations...")
  await runDbGenerate({ verbose: options.verbose || false })
  console.log("✅ Migrations generated")
  console.log("")

  console.log("✨ Code generation complete!")
}

createScriptRunner(
  {
    name: "Gen",
    description: "Generate types (GraphQL, ABI) and database migrations",
    env: "development",
  },
  genHandler,
)
