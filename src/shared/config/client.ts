import env from "env-var"
import packageJson from "../../../package.json"

// Global type for injected config
declare global {
  var __CONFIG__: ClientConfig | undefined
}

// Client-safe configuration (can be exposed to frontend)
export interface ClientConfig {
  APP_NAME: string
  APP_VERSION: string
  NODE_ENV: "development" | "production" | "test"
  API_URL: string
  SENTRY_DSN?: string
  // Web3 configuration (optional when WEB3_ENABLED=false)
  WEB3_ENABLED: boolean
  WEB3_WALLETCONNECT_PROJECT_ID?: string
  WEB3_FACTORY_CONTRACT_ADDRESS?: string
  WEB3_SUPPORTED_CHAINS?: string[]
}

// Browser environment detection - check for DOM availability
const isBrowser = typeof document !== "undefined"

// Helper to load web3-specific config
function loadWeb3Config(web3Enabled: boolean) {
  if (!web3Enabled) {
    return {
      WEB3_WALLETCONNECT_PROJECT_ID: undefined,
      WEB3_FACTORY_CONTRACT_ADDRESS: undefined,
      WEB3_SUPPORTED_CHAINS: undefined,
    }
  }

  return {
    WEB3_WALLETCONNECT_PROJECT_ID: env
      .get("WEB3_WALLETCONNECT_PROJECT_ID")
      .required()
      .asString(),
    WEB3_FACTORY_CONTRACT_ADDRESS: env
      .get("WEB3_FACTORY_CONTRACT_ADDRESS")
      .required()
      .asString(),
    WEB3_SUPPORTED_CHAINS: env
      .get("WEB3_SUPPORTED_CHAINS")
      .required()
      .asString()
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  }
}

// Load client configuration (browser or server)
const web3Enabled = isBrowser
  ? (globalThis.__CONFIG__?.WEB3_ENABLED ?? true)
  : env.get("WEB3_ENABLED").default("true").asBool()

export const clientConfig: ClientConfig =
  isBrowser && globalThis.__CONFIG__
    ? globalThis.__CONFIG__
    : {
        APP_NAME: env.get("APP_NAME").default("Echo").asString(),
        APP_VERSION: env
          .get("APP_VERSION")
          .default(packageJson.version)
          .asString(),
        NODE_ENV: env
          .get("NODE_ENV")
          .default("development")
          .asEnum(["development", "production", "test"]),
        API_URL: env.get("API_URL").required().asString(),
        SENTRY_DSN: env.get("SENTRY_DSN").asString(),
        WEB3_ENABLED: web3Enabled,
        ...loadWeb3Config(web3Enabled),
      }

// Validate critical client configuration on startup
export function validateClientConfig() {
  const requiredForClient = ["API_URL"]

  const missing = requiredForClient.filter((key) => {
    const value = clientConfig[key as keyof ClientConfig]
    if (Array.isArray(value)) {
      return value.length === 0
    }
    return !value || (typeof value === "string" && value.trim() === "")
  })

  if (missing.length > 0) {
    throw new Error(
      `Missing required client environment variables: ${missing.join(", ")}`,
    )
  }

  // Validate web3 config only when enabled
  if (clientConfig.WEB3_ENABLED) {
    if (
      !clientConfig.WEB3_WALLETCONNECT_PROJECT_ID ||
      clientConfig.WEB3_WALLETCONNECT_PROJECT_ID.trim() === ""
    ) {
      throw new Error(
        "WEB3_WALLETCONNECT_PROJECT_ID is required when WEB3_ENABLED=true",
      )
    }

    if (
      !clientConfig.WEB3_FACTORY_CONTRACT_ADDRESS ||
      clientConfig.WEB3_FACTORY_CONTRACT_ADDRESS.trim() === ""
    ) {
      throw new Error(
        "WEB3_FACTORY_CONTRACT_ADDRESS is required when WEB3_ENABLED=true",
      )
    }

    if (
      !clientConfig.WEB3_SUPPORTED_CHAINS ||
      clientConfig.WEB3_SUPPORTED_CHAINS.length === 0
    ) {
      throw new Error(
        "WEB3_SUPPORTED_CHAINS is required when WEB3_ENABLED=true",
      )
    }
  }
}
