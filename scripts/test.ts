#!/usr/bin/env bun

import { existsSync, unlinkSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { $, Glob, spawn } from "bun"
import {
  type CommandSetup,
  createScriptRunner,
  type ScriptOptions,
} from "./shared/script-runner"

interface TestOptions extends ScriptOptions {
  pattern?: string
  watch?: boolean
  timeout?: number
  testFile?: string
  bail?: boolean
  serial?: boolean
}

async function testHandler(options: TestOptions) {
  const { pattern = "", timeout = 30000, testFile, bail = false } = options

  // Create temporary .env.test.local for debug logging if verbose
  const envTestLocalPath = resolve(process.cwd(), ".env.test.local")
  let createdTempEnvFile = false

  if (options.verbose) {
    console.log("🔧 Creating temporary debug logging configuration...")
    writeFileSync(
      envTestLocalPath,
      `# Temporary debug logging for tests
LOG_LEVEL=debug
WORKER_LOG_LEVEL=debug
`,
    )
    createdTempEnvFile = true
    console.log("✅ Debug logging enabled")
    console.log("")
  }

  // Cleanup function to remove temporary files
  const cleanup = () => {
    if (createdTempEnvFile && existsSync(envTestLocalPath)) {
      console.log("🧹 Cleaning up temporary debug logging configuration...")
      unlinkSync(envTestLocalPath)
      console.log("✅ Temporary files cleaned up")
    }
  }

  // Set up cleanup on exit
  process.on("exit", cleanup)
  process.on("SIGINT", () => {
    cleanup()
    process.exit(0)
  })
  process.on("SIGTERM", () => {
    cleanup()
    process.exit(0)
  })

  try {
    // Set up test database first
    console.log("📦 Setting up test database...")
    try {
      await $`bun run db push --force`
      console.log("✅ Test database schema updated successfully")
    } catch (error) {
      console.error("❌ Failed to set up test database:", error)
      cleanup()
      process.exit(1)
    }
    console.log("")

    // Build contracts
    console.log("🔨 Building contracts...")
    try {
      await $`cd tests/helpers/contracts && forge build`
      console.log("✅ Contracts built successfully")
    } catch (error) {
      console.error("❌ Failed to build contracts:", error)
      cleanup()
      process.exit(1)
    }
    console.log("")

    // Get all test files for isolation mode
    const testDir = "tests/"
    const glob = new Glob("**/*.test.ts")
    const testFiles = []
    for await (const file of glob.scan(testDir)) {
      testFiles.push(`${testDir}${file}`)
    }

    // Filter test files based on options
    let filesToRun = testFiles
    if (testFile) {
      filesToRun = [testFile]
    } else if (pattern) {
      filesToRun = testFiles.filter((file) => file.includes(pattern))
    }

    if (filesToRun.length === 0) {
      console.log("❌ No test files found matching criteria")
      cleanup()
      process.exit(1)
    }

    console.log("🚀 Running tests in isolation mode...")
    console.log(`   Found ${filesToRun.length} test file(s):`)
    for (const file of filesToRun) {
      console.log(`   - ${file}`)
    }
    console.log("")

    let totalPassed = 0
    let totalFailed = 0
    const failedFiles = []

    // Run each test file in isolation
    for (const [index, file] of filesToRun.entries()) {
      console.log(`[${index + 1}/${filesToRun.length}] Running: ${file}`)

      const args = ["test", `./${file}`]

      if (timeout) {
        args.push("--timeout", timeout.toString())
      }

      if (options.verbose) {
        args.push("--verbose")
      }

      // Always run in serial mode for isolation
      args.push("--concurrency", "1")

      const result = await spawn(["bun", ...args], {
        stdio: ["inherit", "inherit", "inherit"],
        cwd: process.cwd(), // Ensure we stay in the current directory
        env: {
          ...process.env,
          NODE_ENV: "test", // Force test environment
        },
      }).exited

      if (result === 0) {
        totalPassed++
        console.log(`✅ ${file} passed`)
      } else {
        totalFailed++
        failedFiles.push(file)
        console.log(`❌ ${file} failed`)

        if (bail) {
          console.log("")
          console.log("🛑 Stopping due to --bail flag")
          break
        }
      }

      console.log("")
    }

    // Summary
    console.log("📊 Test Summary:")
    console.log(`   Passed: ${totalPassed}`)
    console.log(`   Failed: ${totalFailed}`)

    if (failedFiles.length > 0) {
      console.log("   Failed files:")
      for (const file of failedFiles) {
        console.log(`   - ${file}`)
      }
    }

    if (totalFailed > 0) {
      console.log("")
      console.log("❌ Some tests failed!")
      cleanup()
      process.exit(1)
    } else {
      console.log("")
      console.log("✅ All tests passed!")
      cleanup()
    }
  } catch (error) {
    console.error("❌ Test execution failed:", error)
    cleanup()
    process.exit(1)
  }
}

// Command setup function for test-specific options
const setupTestCommand: CommandSetup = (program) => {
  return program
    .option("-p, --pattern <pattern>", "test pattern to match")
    .option("-f, --test-file <file>", "specific test file to run")
    .option("-w, --watch", "run tests in watch mode")
    .option("-t, --timeout <ms>", "test timeout in milliseconds", "30000")
    .option("-b, --bail", "stop on first test failure")
    .option("-s, --serial", "run tests serially (one at a time)")
}

// Create script runner
createScriptRunner(
  {
    name: "test",
    description: "Run the test suite",
    env: "test",
  },
  testHandler,
  setupTestCommand,
)
