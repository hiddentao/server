import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import type { ClientConfig } from "@shared/config/client"
import {
  getChainTransports,
  getPrimaryChain,
  getSupportedChains,
} from "@shared/contracts/chain"
import { createPublicClient, http } from "viem"

// Track if we've already shown the warning to avoid duplicates
let hasShownPlaceholderWarning = false

export const createWeb3Config = (clientConfig: ClientConfig) => {
  const supportedChains = getSupportedChains()
  const chains = supportedChains as any // Type assertion to work around RainbowKit type constraints

  // Handle placeholder WEB3_WALLETCONNECT_PROJECT_ID
  let projectId = clientConfig.WEB3_WALLETCONNECT_PROJECT_ID
  if (!projectId || projectId === "your_walletconnect_project_id") {
    if (!hasShownPlaceholderWarning) {
      console.warn(
        "⚠️  Using placeholder WEB3_WALLETCONNECT_PROJECT_ID - wallet connection may not work properly",
      )
      hasShownPlaceholderWarning = true
    }
    // Use a dummy ID that won't cause RainbowKit to fail
    projectId = "00000000000000000000000000000000"
  }

  return getDefaultConfig({
    appName: clientConfig.APP_NAME,
    projectId,
    chains,
    transports: getChainTransports(),
    ssr: false,
  })
}

// Create public client for read-only operations
export const createPublicWeb3Client = () => {
  const primaryChain = getPrimaryChain()

  return createPublicClient({
    chain: primaryChain,
    transport: http(),
  })
}
