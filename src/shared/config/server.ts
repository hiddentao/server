import env from "env-var"
import { type ClientConfig, clientConfig } from "./client"

export interface FirebaseServiceAccountKey {
  type: string
  project_id: string
  private_key_id: string
  private_key: string
  client_email: string
  client_id: string
  auth_uri: string
  token_uri: string
  auth_provider_x509_cert_url: string
  client_x509_cert_url: string
}

// Server-only configuration (extends client config)
export interface ServerConfig extends ClientConfig {
  // Server settings
  WEB_ENABLED: boolean
  HOST: string
  PORT: number
  WORKER_COUNT: number | "cpus"
  WORKER_ID?: string
  STATIC_ASSETS_FOLDER?: string

  // Logging
  LOG_LEVEL: "trace" | "debug" | "info" | "warn" | "error"
  WORKER_LOG_LEVEL: "trace" | "debug" | "info" | "warn" | "error"

  // Database
  DATABASE_URL: string

  // Security
  SESSION_ENCRYPTION_KEY: string

  // Web3 configuration (optional when WEB3_ENABLED=false)
  WEB3_SERVER_WALLET_PRIVATE_KEY?: string
  WEB3_ALLOWED_SIWE_ORIGINS?: string[]
  WEB3_ANVIL_RPC?: string
  WEB3_MAINNET_RPC?: string
  WEB3_SEPOLIA_RPC?: string
  WEB3_BASE_RPC?: string

  // OAuth configuration (optional)
  OAUTH_GOOGLE_CLIENT_ID?: string
  OAUTH_GOOGLE_CLIENT_SECRET?: string
  OAUTH_FACEBOOK_CLIENT_ID?: string
  OAUTH_FACEBOOK_CLIENT_SECRET?: string
  OAUTH_GITHUB_CLIENT_ID?: string
  OAUTH_GITHUB_CLIENT_SECRET?: string
  OAUTH_X_CLIENT_ID?: string
  OAUTH_X_CLIENT_SECRET?: string
  OAUTH_TIKTOK_CLIENT_KEY?: string
  OAUTH_TIKTOK_CLIENT_SECRET?: string
  OAUTH_LINKEDIN_CLIENT_ID?: string
  OAUTH_LINKEDIN_CLIENT_SECRET?: string
  OAUTH_CALLBACK_BASE_URL?: string

  // WebSocket configuration
  SOCKET_MAX_CONNECTIONS_PER_USER: number
  SOCKET_MAX_TOTAL_CONNECTIONS: number

  // External services (optional)
  MAILGUN_API_KEY?: string
  MAILGUN_API_ENDPOINT?: string
  MAILGUN_FROM_ADDRESS?: string

  // Sentry configuration
  SENTRY_DSN?: string
  SENTRY_WORKER_DSN?: string
  SENTRY_TRACES_SAMPLE_RATE: number
  SENTRY_PROFILE_SESSION_SAMPLE_RATE: number

  DIGITALOCEAN_ACCESS_TOKEN?: string

  // Cloudflare R2 configuration
  CLOUDFLARE_ACCOUNT_ID?: string
  CLOUDFLARE_R2_ACCESS_KEY_ID?: string
  CLOUDFLARE_R2_SECRET_ACCESS_KEY?: string
  CLOUDFLARE_R2_BUCKET_NAME?: string
  CLOUDFLARE_R2_PUBLIC_URL?: string

  // Firebase configuration
  FIREBASE_PROJECT_ID?: string
  FIREBASE_SERVICE_ACCOUNT_KEY?: FirebaseServiceAccountKey
}

export function parseFirebaseServiceAccountKey(
  value: string | undefined,
): FirebaseServiceAccountKey | undefined {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value) as FirebaseServiceAccountKey
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n")
    }
    return parsed
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY must be valid JSON")
  }
}

// Helper to load web3-specific server config
function loadWeb3ServerConfig(web3Enabled: boolean) {
  if (!web3Enabled) {
    return {
      WEB3_SERVER_WALLET_PRIVATE_KEY: undefined,
      WEB3_ALLOWED_SIWE_ORIGINS: undefined,
      WEB3_ANVIL_RPC: undefined,
      WEB3_MAINNET_RPC: undefined,
      WEB3_SEPOLIA_RPC: undefined,
      WEB3_BASE_RPC: undefined,
    }
  }

  return {
    WEB3_SERVER_WALLET_PRIVATE_KEY: env
      .get("WEB3_SERVER_WALLET_PRIVATE_KEY")
      .required()
      .asString(),
    WEB3_ALLOWED_SIWE_ORIGINS: env
      .get("WEB3_ALLOWED_SIWE_ORIGINS")
      .required()
      .asString()
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
    WEB3_ANVIL_RPC: env.get("WEB3_ANVIL_RPC").asString(),
    WEB3_MAINNET_RPC: env.get("WEB3_MAINNET_RPC").asString(),
    WEB3_SEPOLIA_RPC: env.get("WEB3_SEPOLIA_RPC").asString(),
    WEB3_BASE_RPC: env.get("WEB3_BASE_RPC").asString(),
  }
}

// Load and validate server configuration
export const serverConfig: ServerConfig = {
  ...clientConfig,

  // Server settings
  WEB_ENABLED: env.get("WEB_ENABLED").default("true").asBool(),
  HOST: env.get("HOST").default("localhost").asString(),
  PORT: env.get("PORT").default(3000).asPortNumber(),
  WORKER_COUNT:
    env.get("WORKER_COUNT").default("1").asString() === "cpus"
      ? "cpus"
      : env.get("WORKER_COUNT").default(1).asInt(),
  WORKER_ID: env.get("WORKER_ID").asString(),
  STATIC_ASSETS_FOLDER: env.get("STATIC_ASSETS_FOLDER").asString(),

  // Logging
  LOG_LEVEL: env
    .get("LOG_LEVEL")
    .default("info")
    .asEnum(["trace", "debug", "info", "warn", "error"]),
  WORKER_LOG_LEVEL: env
    .get("WORKER_LOG_LEVEL")
    .default("info")
    .asEnum(["trace", "debug", "info", "warn", "error"]),

  // Database
  DATABASE_URL: env.get("DATABASE_URL").required().asString(),

  // Security
  SESSION_ENCRYPTION_KEY: env
    .get("SESSION_ENCRYPTION_KEY")
    .required()
    .asString(),

  // Web3 configuration (conditional)
  ...loadWeb3ServerConfig(clientConfig.WEB3_ENABLED),

  // OAuth configuration
  OAUTH_GOOGLE_CLIENT_ID: env.get("OAUTH_GOOGLE_CLIENT_ID").asString(),
  OAUTH_GOOGLE_CLIENT_SECRET: env.get("OAUTH_GOOGLE_CLIENT_SECRET").asString(),
  OAUTH_FACEBOOK_CLIENT_ID: env.get("OAUTH_FACEBOOK_CLIENT_ID").asString(),
  OAUTH_FACEBOOK_CLIENT_SECRET: env
    .get("OAUTH_FACEBOOK_CLIENT_SECRET")
    .asString(),
  OAUTH_GITHUB_CLIENT_ID: env.get("OAUTH_GITHUB_CLIENT_ID").asString(),
  OAUTH_GITHUB_CLIENT_SECRET: env.get("OAUTH_GITHUB_CLIENT_SECRET").asString(),
  OAUTH_X_CLIENT_ID: env.get("OAUTH_X_CLIENT_ID").asString(),
  OAUTH_X_CLIENT_SECRET: env.get("OAUTH_X_CLIENT_SECRET").asString(),
  OAUTH_TIKTOK_CLIENT_KEY: env.get("OAUTH_TIKTOK_CLIENT_KEY").asString(),
  OAUTH_TIKTOK_CLIENT_SECRET: env.get("OAUTH_TIKTOK_CLIENT_SECRET").asString(),
  OAUTH_LINKEDIN_CLIENT_ID: env.get("OAUTH_LINKEDIN_CLIENT_ID").asString(),
  OAUTH_LINKEDIN_CLIENT_SECRET: env
    .get("OAUTH_LINKEDIN_CLIENT_SECRET")
    .asString(),
  OAUTH_CALLBACK_BASE_URL: env.get("OAUTH_CALLBACK_BASE_URL").asString(),

  // WebSocket configuration
  SOCKET_MAX_CONNECTIONS_PER_USER: env
    .get("SOCKET_MAX_CONNECTIONS_PER_USER")
    .default(5)
    .asInt(),
  SOCKET_MAX_TOTAL_CONNECTIONS: env
    .get("SOCKET_MAX_TOTAL_CONNECTIONS")
    .default(10000)
    .asInt(),

  // External services (optional)
  MAILGUN_API_KEY: env.get("MAILGUN_API_KEY").asString(),
  MAILGUN_API_ENDPOINT: env.get("MAILGUN_API_ENDPOINT").asString(),
  MAILGUN_FROM_ADDRESS: env.get("MAILGUN_FROM_ADDRESS").asString(),

  // Sentry configuration
  SENTRY_DSN: env.get("SENTRY_DSN").asString(),
  SENTRY_WORKER_DSN: env.get("SENTRY_WORKER_DSN").asString(),
  SENTRY_TRACES_SAMPLE_RATE: env
    .get("SENTRY_TRACES_SAMPLE_RATE")
    .default("1.0")
    .asFloat(),
  SENTRY_PROFILE_SESSION_SAMPLE_RATE: env
    .get("SENTRY_PROFILE_SESSION_SAMPLE_RATE")
    .default("1.0")
    .asFloat(),

  DIGITALOCEAN_ACCESS_TOKEN: env.get("DIGITALOCEAN_ACCESS_TOKEN").asString(),

  // Cloudflare R2 configuration
  CLOUDFLARE_ACCOUNT_ID: env.get("CLOUDFLARE_ACCOUNT_ID").asString(),
  CLOUDFLARE_R2_ACCESS_KEY_ID: env
    .get("CLOUDFLARE_R2_ACCESS_KEY_ID")
    .asString(),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: env
    .get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
    .asString(),
  CLOUDFLARE_R2_BUCKET_NAME: env.get("CLOUDFLARE_R2_BUCKET_NAME").asString(),
  CLOUDFLARE_R2_PUBLIC_URL: env.get("CLOUDFLARE_R2_PUBLIC_URL").asString(),

  // Firebase configuration
  FIREBASE_PROJECT_ID: env.get("FIREBASE_PROJECT_ID").asString(),
  FIREBASE_SERVICE_ACCOUNT_KEY: parseFirebaseServiceAccountKey(
    env.get("FIREBASE_SERVICE_ACCOUNT_KEY").asString(),
  ),
}

// Helper to check if a config value is empty
function isConfigValueEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  return false
}

// Validate critical configuration on startup
export function validateConfig() {
  const requiredForAll: (keyof ServerConfig)[] = [
    "DATABASE_URL",
    "SESSION_ENCRYPTION_KEY",
    "API_URL",
  ]

  const missing = requiredForAll.filter((key) =>
    isConfigValueEmpty(serverConfig[key]),
  )

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    )
  }

  // Validate session key length
  if (serverConfig.SESSION_ENCRYPTION_KEY.length < 32) {
    throw new Error(
      "SESSION_ENCRYPTION_KEY must be at least 32 characters long",
    )
  }

  // Validate web3 config when enabled
  if (serverConfig.WEB3_ENABLED) {
    const requiredForWeb3: (keyof ServerConfig)[] = [
      "WEB3_SERVER_WALLET_PRIVATE_KEY",
      "WEB3_ALLOWED_SIWE_ORIGINS",
      "WEB3_WALLETCONNECT_PROJECT_ID",
      "WEB3_SUPPORTED_CHAINS",
    ]

    const missingWeb3 = requiredForWeb3.filter((key) =>
      isConfigValueEmpty(serverConfig[key]),
    )

    if (missingWeb3.length > 0) {
      throw new Error(
        `Missing required web3 environment variables (WEB3_ENABLED=true): ${missingWeb3.join(", ")}`,
      )
    }
  }
}

// Get RPC endpoint for a specific chain
export function getChainRpcEndpoint(chainName: string): string | undefined {
  const normalizedName = chainName.toLowerCase()
  switch (normalizedName) {
    case "anvil":
      return serverConfig.WEB3_ANVIL_RPC
    case "mainnet":
    case "ethereum":
      return serverConfig.WEB3_MAINNET_RPC
    case "sepolia":
      return serverConfig.WEB3_SEPOLIA_RPC
    case "base":
      return serverConfig.WEB3_BASE_RPC
    default:
      return undefined
  }
}

// Get RPC endpoint for a specific chain, throwing if not configured
export function requireChainRpcEndpoint(chainName: string): string {
  const rpcUrl = getChainRpcEndpoint(chainName)
  if (!rpcUrl) {
    const envVarName = `WEB3_${chainName.toUpperCase()}_RPC`
    throw new Error(
      `RPC endpoint not configured for chain "${chainName}". ` +
        `Set the ${envVarName} environment variable.`,
    )
  }
  return rpcUrl
}

// Re-export client config and types for convenience
export { type ClientConfig, clientConfig } from "./client"
