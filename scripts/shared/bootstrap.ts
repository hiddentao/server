#!/usr/bin/env bun

import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { config } from "dotenv"

/**
 * Bootstrap utility for scripts
 *
 * Loads environment variables in the following order:
 * 1. .env (base configuration)
 * 2. .env.{NODE_ENV} (environment-specific overrides)
 * 3. .env.local (local overrides, if exists)
 *
 * Loads environment variables in layered order for scripts
 */

export interface BootstrapOptions {
  env?: string
  verbose?: boolean
}

export interface BootstrapResult {
  rootFolder: string
  env: string
  parsedEnv: Record<string, string>
}

interface EnvFileInfo {
  name: string
  path: string
  required: boolean
  override?: boolean
}

/**
 * Load a single environment file
 */
function loadEnvFile(
  fileInfo: EnvFileInfo,
  verbose: boolean,
): Record<string, string> {
  const { name, path, required, override = false } = fileInfo

  if (existsSync(path)) {
    const result = config({ path, override })
    if (verbose && result.error) {
      console.warn(`⚠️  Warning loading ${name}: ${result.error}`)
    } else if (verbose) {
      console.log(`✅ Loaded ${name}`)
    }
    return result.parsed!
  } else if (required && verbose) {
    console.warn(`⚠️  ${name} file not found at ${path}`)
  } else if (verbose) {
    console.log(`ℹ️  No ${name} file found (optional)`)
  }

  return {}
}

/**
 * Display environment information
 */
function showEnvironmentInfo(
  parsedEnv: Record<string, string>,
  verbose: boolean,
): void {
  if (!verbose) return

  console.log(`📊 Environment configured:`)

  // Sensitive keys that should be masked
  const sensitiveKeys = new Set([
    "DATABASE_URL",
    "SESSION_ENCRYPTION_KEY",
    "SERVER_WALLET_PRIVATE_KEY",
    "MAILGUN_API_KEY",
    "SENTRY_WORKER_DSN",
    "SENTRY_AUTH_TOKEN",
    "DIGITALOCEAN_ACCESS_TOKEN",
    "WALLETCONNECT_PROJECT_ID",
  ])

  // Sort keys for consistent display
  const sortedKeys = Object.keys(parsedEnv).sort()

  for (const key of sortedKeys) {
    const value = parsedEnv[key]
    if (sensitiveKeys.has(key)) {
      // Mask sensitive values
      if (key === "DATABASE_URL") {
        console.log(
          `   ${key}: ${value?.replace(/:[^@]*@/, ":***@") || "not set"}`,
        )
      } else {
        console.log(`   ${key}: ${value ? "***" : "not set"}`)
      }
    } else {
      console.log(`   ${key}: ${value || "not set"}`)
    }
  }
  console.log("")
}

export async function bootstrap(
  options: BootstrapOptions = {},
): Promise<BootstrapResult> {
  const { verbose = false } = options
  let { env } = options

  try {
    // Determine environment - prioritize parameter over existing NODE_ENV
    env = env || process.env.NODE_ENV || "development"
    process.env.NODE_ENV = env

    const rootFolder = resolve(import.meta.dir, "..", "..")

    if (verbose) {
      console.log(`🚀 Bootstrapping Echo scripts (env: ${env})`)
    }

    // Define environment files to load in order
    const envFiles: EnvFileInfo[] = [
      {
        name: "base .env",
        path: resolve(rootFolder, ".env"),
        required: true,
      },
      {
        name: `.env.${env}`,
        path: resolve(rootFolder, `.env.${env}`),
        required: false,
        override: true,
      },
      {
        name: `.env.${env}.local`,
        path: resolve(rootFolder, `.env.${env}.local`),
        required: false,
        override: true,
      },
      // Skip .env.local in test and production modes to avoid interference from local dev settings
      ...(env !== "test" && env !== "production"
        ? [
            {
              name: ".env.local",
              path: resolve(rootFolder, ".env.local"),
              required: false,
              override: true,
            },
          ]
        : []),
    ]

    // Load all environment files and collect parsed variables
    const parsedEnv: Record<string, string> = {}

    envFiles.forEach((fileInfo) => {
      const fileEnv = loadEnvFile(fileInfo, verbose)
      Object.assign(parsedEnv, fileEnv)
    })

    parsedEnv.NODE_ENV = env

    // Show configuration summary
    showEnvironmentInfo(parsedEnv, verbose)

    return {
      rootFolder,
      env,
      parsedEnv,
    }
  } catch (error) {
    console.error("💥 Bootstrap failed:", error)
    process.exit(1)
  }
}
