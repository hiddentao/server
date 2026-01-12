#!/usr/bin/env bun

import path from "node:path"
import { $ } from "bun"

/**
 * Generate ABIs from contract artifacts and ABI configuration
 */
export async function generateAbis(options: { verbose?: boolean } = {}) {
  const { verbose = false } = options

  if (verbose) {
    console.log("🔧 Generating contract ABIs...")
  }

  try {
    const rootFolder = path.resolve(import.meta.dir, "../..")
    const abiCodegenPath = path.join(rootFolder, "src/shared/abi/codegen.ts")

    // Run the ABI codegen script
    await $`bun ${abiCodegenPath}`.cwd(rootFolder)

    if (verbose) {
      console.log("✅ ABI generation completed")
    }
  } catch (error) {
    console.error("❌ ABI generation failed:", error)
    throw error
  }
}
