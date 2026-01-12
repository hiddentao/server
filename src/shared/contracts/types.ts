import type { Abi, Address } from "viem"

/**
 * Generic contract call configuration
 */
export interface ContractCall {
  address: Address
  abi: Abi
  functionName: string
  args?: readonly unknown[]
}

/**
 * Multicall3 request structure
 */
export interface MulticallRequest {
  target: Address
  allowFailure?: boolean
  callData: `0x${string}`
}

/**
 * Multicall3 response structure
 */
export interface MulticallResponse {
  success: boolean
  returnData: `0x${string}`
}

/**
 * Transaction request for contract writes
 */
export interface TransactionRequest {
  address: Address
  abi: Abi
  functionName: string
  args?: readonly unknown[]
  value?: bigint
}

/**
 * Common ERC20 token metadata (useful for most apps)
 */
export interface TokenMetadata {
  address: string
  name: string
  symbol: string
  decimals: number
  totalSupply: bigint
}

/**
 * Token metadata with user balance
 */
export interface TokenWithBalance extends TokenMetadata {
  balance: bigint
}

/**
 * Contract call result with error handling
 */
export interface ContractCallResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Batch operation result
 */
export interface BatchCallResult<T = unknown> {
  results: ContractCallResult<T>[]
  errors: string[]
}
