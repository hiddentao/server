/**
 * Contract test helpers for Echo
 *
 * Utilities for managing contract compilation and deployment in tests.
 */

import { testLogger } from "@tests/helpers/logger"
import { $ } from "bun"

/**
 * Build contracts using Forge
 * Compiles all Solidity contracts in the tests/helpers/contracts directory
 */
export async function buildContracts(): Promise<void> {
  testLogger.info("🔨 Building contracts with Forge...")

  try {
    // Change to the contracts directory and run forge build
    const contractsDir = "tests/helpers/contracts"
    await $`cd ${contractsDir} && forge build`

    testLogger.info("✅ Contracts built successfully")
  } catch (error) {
    testLogger.error("❌ Contract build failed:", error)
    throw error
  }
}

/**
 * Setup contracts for tests
 * Ensures contracts are compiled and ready for use in tests
 */
export async function setupContracts(): Promise<void> {
  testLogger.info("📦 Setting up contracts for tests...")

  try {
    await buildContracts()
    testLogger.info("✅ Contract setup complete")
  } catch (error) {
    testLogger.error("❌ Contract setup failed:", error)
    throw error
  }
}
