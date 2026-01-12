import type { PublicClient } from "viem"
import { batchContractReads } from "./multicall"
import type { ContractCall } from "./types"

/**
 * Execute a single contract read call
 */
export async function readContract<T = unknown>(
  call: ContractCall,
  publicClient: PublicClient,
): Promise<T> {
  try {
    const result = await publicClient.readContract({
      address: call.address,
      abi: call.abi,
      functionName: call.functionName,
      args: call.args,
    })

    return result as T
  } catch (error) {
    throw new Error(
      `Contract read failed for ${call.functionName} on ${call.address}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
}

/**
 * Execute multiple contract read calls on the same contract
 * Uses multicall3 for efficient batching
 */
export async function readContractMultiple<T = unknown>(
  calls: ContractCall[],
  publicClient: PublicClient,
): Promise<T[]> {
  if (calls.length === 0) {
    return []
  }

  if (calls.length === 1) {
    const firstCall = calls[0]
    if (!firstCall) {
      throw new Error("First call is undefined")
    }
    const result = await readContract<T>(firstCall, publicClient)
    return [result]
  }

  const batchResult = await batchContractReads<T>(calls, publicClient)

  // Extract successful results, preserving order
  const results: T[] = []
  for (let i = 0; i < batchResult.results.length; i++) {
    const result = batchResult.results[i]
    if (!result) {
      throw new Error(`Missing result for call at index ${i}`)
    }
    if (result.success && result.data !== undefined) {
      results.push(result.data)
    } else {
      throw new Error(
        result.error || `Contract read failed for call at index ${i}`,
      )
    }
  }

  return results
}

/**
 * Execute multiple contract read calls with error tolerance
 * Returns partial results even if some calls fail
 */
export async function readContractMultipleWithFallback<T = unknown>(
  calls: ContractCall[],
  publicClient: PublicClient,
): Promise<{
  results: (T | null)[]
  errors: string[]
  successCount: number
}> {
  if (calls.length === 0) {
    return { results: [], errors: [], successCount: 0 }
  }

  const batchResult = await batchContractReads<T>(calls, publicClient)

  const results: (T | null)[] = []
  let successCount = 0

  for (const result of batchResult.results) {
    if (result.success && result.data !== undefined) {
      results.push(result.data)
      successCount++
    } else {
      results.push(null)
    }
  }

  return {
    results,
    errors: batchResult.errors,
    successCount,
  }
}

/**
 * Create a contract call configuration object
 */
export function createContractCall(
  address: string,
  abi: any,
  functionName: string,
  args?: readonly unknown[],
): ContractCall {
  return {
    address: address as `0x${string}`,
    abi,
    functionName,
    args,
  }
}

/**
 * Retry a contract read with exponential backoff
 */
export async function readContractWithRetry<T = unknown>(
  call: ContractCall,
  publicClient: PublicClient,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError: Error = new Error("Unknown error")

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await readContract<T>(call, publicClient)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === maxRetries) {
        break
      }

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw new Error(
    `Contract read failed after ${maxRetries + 1} attempts: ${lastError.message}`,
  )
}
