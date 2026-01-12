import type { Chain } from "viem"
import { requireChainRpcEndpoint } from "../../shared/config/server"
import {
  getChain as getChainByName,
  getChainId as getChainIdByName,
  getPrimaryChain as getSharedPrimaryChain,
  getPrimaryChainName as getSharedPrimaryChainName,
} from "../../shared/contracts/chain"

/**
 * Get the primary chain ID (first chain in SUPPORTED_CHAINS)
 */
export function getChainId(): number {
  return getSharedPrimaryChain().id
}

/**
 * Get the primary viem chain object (first chain in SUPPORTED_CHAINS)
 */
export function getChain(): Chain {
  return getSharedPrimaryChain()
}

/**
 * Get the primary chain name (first chain in SUPPORTED_CHAINS)
 */
export function getChainName(): string {
  return getSharedPrimaryChainName()
}

/**
 * Get the RPC URL for the primary chain
 */
export function getChainRpcUrl(): string {
  return requireChainRpcEndpoint(getChainName())
}

// Re-export for convenience
export { getChainByName, getChainIdByName }
