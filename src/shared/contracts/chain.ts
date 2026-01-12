import type { Chain, Transport } from "viem"
import { http } from "viem"
import * as chains from "viem/chains"
import { clientConfig } from "../config/client"

export const CHAIN_IDS = {
  ANVIL: 31337,
  MAINNET: 1,
  SEPOLIA: 11155111,
  BASE: 8453,
} as const

// Custom anvil chain with hardcoded localhost RPC for development
const anvil: Chain = {
  ...chains.hardhat,
  id: CHAIN_IDS.ANVIL,
  name: "Anvil",
  rpcUrls: {
    default: { http: ["http://localhost:8545"] },
    public: { http: ["http://localhost:8545"] },
  },
}

const ALL_CHAINS: Chain[] = [anvil, chains.mainnet, chains.sepolia, chains.base]

/**
 * Get the viem chain object for the given chain name
 */
export function getChain(chainName: string): Chain {
  switch (chainName) {
    case "anvil":
      return anvil
    case "mainnet":
    case "ethereum":
      return chains.mainnet
    case "sepolia":
      return chains.sepolia
    case "base":
      return chains.base
    default:
      throw new Error(`Unknown chain: ${chainName}`)
  }
}

/**
 * Get the chain ID for the given chain name
 */
export function getChainId(chainName: string): number {
  return getChain(chainName).id
}

/**
 * Get the viem chain object for the given chain ID
 */
export function getChainById(chainId: number): Chain {
  const chain = ALL_CHAINS.find((c) => c.id === chainId)
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }
  return chain
}

/**
 * Get supported chains as an array based on WEB3_SUPPORTED_CHAINS config
 */
export function getSupportedChains(): Chain[] {
  const chainNames = clientConfig.WEB3_SUPPORTED_CHAINS
  if (!chainNames || chainNames.length === 0) {
    return []
  }

  const result: Chain[] = []
  for (const name of chainNames) {
    try {
      result.push(getChain(name))
    } catch {
      // Ignore unknown chain names
    }
  }
  return result
}

/**
 * Get the primary chain (first in SUPPORTED_CHAINS)
 */
export function getPrimaryChain(): Chain {
  const supported = getSupportedChains()
  if (supported.length === 0) {
    throw new Error("No supported chains configured")
  }
  return supported[0] as Chain
}

/**
 * Get the primary chain name (first in WEB3_SUPPORTED_CHAINS)
 */
export function getPrimaryChainName(): string {
  const chainNames = clientConfig.WEB3_SUPPORTED_CHAINS
  if (!chainNames || chainNames.length === 0) {
    throw new Error("No supported chains configured")
  }
  return chainNames[0] as string
}

/**
 * Get chain transports for RainbowKit config (uses viem built-in public RPCs)
 */
export function getChainTransports(): Record<number, Transport> {
  return {
    [CHAIN_IDS.ANVIL]: http(),
    [CHAIN_IDS.MAINNET]: http(),
    [CHAIN_IDS.SEPOLIA]: http(),
    [CHAIN_IDS.BASE]: http(),
  }
}
