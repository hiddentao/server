import type { PublicClient } from "viem"
import { decodeFunctionResult, encodeFunctionData } from "viem"
import { getMulticall3Info } from "./index"
import type {
  BatchCallResult,
  ContractCall,
  ContractCallResult,
  MulticallRequest,
  MulticallResponse,
} from "./types"

/**
 * Multicall3 ABI - only the functions we need
 */
const MULTICALL3_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" },
        ],
        name: "calls",
        type: "tuple[]",
      },
    ],
    name: "aggregate3",
    outputs: [
      {
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
        name: "returnData",
        type: "tuple[]",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
] as const

/**
 * Encode a contract call into multicall calldata
 */
function encodeContractCall(call: ContractCall): `0x${string}` {
  return encodeFunctionData({
    abi: call.abi,
    functionName: call.functionName,
    args: call.args,
  })
}

/**
 * Decode multicall response data for a specific contract call
 */
function decodeContractCallResult<T = unknown>(
  call: ContractCall,
  returnData: `0x${string}`,
): T {
  return decodeFunctionResult({
    abi: call.abi,
    functionName: call.functionName,
    data: returnData,
  }) as T
}

/**
 * Execute multiple contract calls using multicall3 for efficient batching
 * Falls back to individual calls if multicall3 fails or is unavailable
 */
export async function batchContractReads<T = unknown>(
  calls: ContractCall[],
  publicClient: PublicClient,
): Promise<BatchCallResult<T>> {
  if (calls.length === 0) {
    return { results: [], errors: [] }
  }

  try {
    const multicall3 = getMulticall3Info()

    // Prepare multicall requests
    const multicallRequests: MulticallRequest[] = calls.map((call) => ({
      target: call.address,
      allowFailure: true, // Allow individual calls to fail without breaking the batch
      callData: encodeContractCall(call),
    }))

    // Execute multicall3.aggregate3
    const multicallResults = (await publicClient.readContract({
      address: multicall3.contract,
      abi: MULTICALL3_ABI,
      functionName: "aggregate3",
      args: [multicallRequests],
    })) as MulticallResponse[]

    // Process results
    const results: ContractCallResult<T>[] = []
    const errors: string[] = []

    for (let i = 0; i < calls.length; i++) {
      const call = calls[i]
      const result = multicallResults[i]

      if (!call) {
        const error = `Missing call at index ${i}`
        results.push({ success: false, error })
        errors.push(error)
        continue
      }

      if (result?.success && result.returnData !== "0x") {
        try {
          const decoded = decodeContractCallResult<T>(call, result.returnData)
          results.push({ success: true, data: decoded })
        } catch (decodeError) {
          const error = `Failed to decode result for ${call.functionName}: ${
            decodeError instanceof Error
              ? decodeError.message
              : String(decodeError)
          }`
          results.push({ success: false, error })
          errors.push(error)
        }
      } else {
        const error = `Contract call failed: ${call.functionName} on ${call.address}`
        results.push({ success: false, error })
        errors.push(error)
      }
    }

    return { results, errors }
  } catch (multicallError) {
    // Fallback to individual calls if multicall3 fails
    console.warn(
      "Multicall3 failed, falling back to individual calls:",
      multicallError,
    )
    return await fallbackIndividualCalls(calls, publicClient)
  }
}

/**
 * Fallback function to execute calls individually when multicall3 fails
 */
async function fallbackIndividualCalls<T = unknown>(
  calls: ContractCall[],
  publicClient: PublicClient,
): Promise<BatchCallResult<T>> {
  const results: ContractCallResult<T>[] = []
  const errors: string[] = []

  for (const call of calls) {
    try {
      const result = (await publicClient.readContract({
        address: call.address,
        abi: call.abi,
        functionName: call.functionName,
        args: call.args,
      })) as T

      results.push({ success: true, data: result })
    } catch (error) {
      const errorMessage = `Individual call failed: ${call.functionName} on ${call.address}: ${
        error instanceof Error ? error.message : String(error)
      }`
      results.push({ success: false, error: errorMessage })
      errors.push(errorMessage)
    }
  }

  return { results, errors }
}

/**
 * Helper function to extract successful results from batch operation
 */
export function extractSuccessfulResults<T>(
  batchResult: BatchCallResult<T>,
): T[] {
  return batchResult.results
    .filter(
      (result): result is ContractCallResult<T> & { data: T } =>
        result.success && result.data !== undefined,
    )
    .map((result) => result.data)
}

/**
 * Helper function to check if all calls in a batch were successful
 */
export function allCallsSuccessful<T>(
  batchResult: BatchCallResult<T>,
): boolean {
  return batchResult.results.every((result) => result.success)
}
