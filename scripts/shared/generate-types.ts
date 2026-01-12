import { $ } from "bun"
import { existsSync } from "fs"
import path from "path"

export interface GenerateTypesOptions {
  verbose?: boolean
  watch?: boolean
}

export async function generateTypes(options: GenerateTypesOptions = {}) {
  const { verbose = false, watch = false } = options

  try {
    // GraphQL codegen
    if (verbose) console.log("🔧 Generating GraphQL types...")

    const args = ["--config", "src/shared/graphql/codegen.ts"]
    if (watch) args.push("--watch")

    await $`./node_modules/.bin/graphql-codegen ${args}`

    if (verbose) console.log("✅ GraphQL types generated")

    // ABI codegen (if exists - for compatibility)
    const abiCodegenPath = path.join(process.cwd(), "src/shared/abi/codegen.ts")
    if (existsSync(abiCodegenPath)) {
      if (verbose) console.log("🔧 Generating ABI types...")
      await $`bun run ${abiCodegenPath} --no-overwrite`
      if (verbose) console.log("✅ ABI types generated")
    }
  } catch (error) {
    console.error("❌ Type generation failed:", error)
    throw error
  }
}
