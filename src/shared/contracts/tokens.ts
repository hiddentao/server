import type { Address, PublicClient } from "viem"
import { getERC20ContractInfo } from "./index"
import { batchContractReads, extractSuccessfulResults } from "./multicall"
import { createContractCall, readContract } from "./reader"
import type { ContractCall, TokenMetadata, TokenWithBalance } from "./types"

/**
 * Standard ERC20 function names for metadata
 */
const ERC20_METADATA_FUNCTIONS = [
  "name",
  "symbol",
  "decimals",
  "totalSupply",
] as const
const ERC20_BALANCE_FUNCTION = "balanceOf"

/**
 * Fetch metadata for a single token
 */
export async function fetchTokenMetadata(
  tokenAddress: Address,
  publicClient: PublicClient,
): Promise<TokenMetadata> {
  const erc20Contract = getERC20ContractInfo(tokenAddress)
  const calls: ContractCall[] = ERC20_METADATA_FUNCTIONS.map((fn) =>
    createContractCall(tokenAddress, erc20Contract.abi, fn),
  )

  const batchResult = await batchContractReads(calls, publicClient)

  // Ensure all calls succeeded
  if (batchResult.errors.length > 0) {
    throw new Error(
      `Failed to fetch token metadata for ${tokenAddress}: ${batchResult.errors.join(", ")}`,
    )
  }

  const results = extractSuccessfulResults(batchResult)
  if (results.length !== 4) {
    throw new Error(`Incomplete token metadata for ${tokenAddress}`)
  }

  const [name, symbol, decimals, totalSupply] = results

  return {
    address: tokenAddress,
    name: name as string,
    symbol: symbol as string,
    decimals: Number(decimals),
    totalSupply: totalSupply as bigint,
  }
}

/**
 * Fetch metadata for multiple tokens efficiently using multicall
 */
export async function fetchMultipleTokenMetadata(
  tokenAddresses: Address[],
  publicClient: PublicClient,
): Promise<TokenMetadata[]> {
  if (tokenAddresses.length === 0) {
    return []
  }

  // Create all calls for all tokens
  const calls: ContractCall[] = tokenAddresses.flatMap((address) => {
    const erc20Contract = getERC20ContractInfo(address)
    return ERC20_METADATA_FUNCTIONS.map((fn) =>
      createContractCall(address, erc20Contract.abi, fn),
    )
  })

  const batchResult = await batchContractReads(calls, publicClient)
  return parseTokenMetadataResults(tokenAddresses, batchResult.results)
}

/**
 * Fetch token metadata with user balance
 */
export async function fetchTokenWithBalance(
  tokenAddress: Address,
  userAddress: Address,
  publicClient: PublicClient,
): Promise<TokenWithBalance> {
  const erc20Contract = getERC20ContractInfo(tokenAddress)
  const calls: ContractCall[] = [
    ...ERC20_METADATA_FUNCTIONS.map((fn) =>
      createContractCall(tokenAddress, erc20Contract.abi, fn),
    ),
    createContractCall(
      tokenAddress,
      erc20Contract.abi,
      ERC20_BALANCE_FUNCTION,
      [userAddress],
    ),
  ]

  const batchResult = await batchContractReads(calls, publicClient)

  if (batchResult.errors.length > 0) {
    throw new Error(
      `Failed to fetch token info for ${tokenAddress}: ${batchResult.errors.join(", ")}`,
    )
  }

  const results = extractSuccessfulResults(batchResult)
  if (results.length !== 5) {
    throw new Error(`Incomplete token info for ${tokenAddress}`)
  }

  const [name, symbol, decimals, totalSupply, balance] = results

  return {
    address: tokenAddress,
    name: name as string,
    symbol: symbol as string,
    decimals: Number(decimals),
    totalSupply: totalSupply as bigint,
    balance: balance as bigint,
  }
}

/**
 * Fetch multiple tokens with balances efficiently using multicall
 */
export async function fetchMultipleTokensWithBalances(
  tokenAddresses: Address[],
  userAddress: Address,
  publicClient: PublicClient,
): Promise<TokenWithBalance[]> {
  if (tokenAddresses.length === 0) {
    return []
  }

  // Create calls for metadata + balance for each token
  const calls: ContractCall[] = tokenAddresses.flatMap((address) => {
    const erc20Contract = getERC20ContractInfo(address)
    return [
      ...ERC20_METADATA_FUNCTIONS.map((fn) =>
        createContractCall(address, erc20Contract.abi, fn),
      ),
      createContractCall(address, erc20Contract.abi, ERC20_BALANCE_FUNCTION, [
        userAddress,
      ]),
    ]
  })

  const batchResult = await batchContractReads(calls, publicClient)
  return parseTokenWithBalanceResults(tokenAddresses, batchResult.results)
}

/**
 * Get token balance for a specific user
 */
export async function fetchTokenBalance(
  tokenAddress: Address,
  userAddress: Address,
  publicClient: PublicClient,
): Promise<bigint> {
  const erc20Contract = getERC20ContractInfo(tokenAddress)
  const call = createContractCall(
    tokenAddress,
    erc20Contract.abi,
    ERC20_BALANCE_FUNCTION,
    [userAddress],
  )

  return await readContract<bigint>(call, publicClient)
}

/**
 * Get balances for multiple tokens for a specific user
 */
export async function fetchMultipleTokenBalances(
  tokenAddresses: Address[],
  userAddress: Address,
  publicClient: PublicClient,
): Promise<{ address: Address; balance: bigint }[]> {
  if (tokenAddresses.length === 0) {
    return []
  }

  const calls: ContractCall[] = tokenAddresses.map((address) => {
    const erc20Contract = getERC20ContractInfo(address)
    return createContractCall(
      address,
      erc20Contract.abi,
      ERC20_BALANCE_FUNCTION,
      [userAddress],
    )
  })

  const batchResult = await batchContractReads<bigint>(calls, publicClient)
  const balances = extractSuccessfulResults(batchResult)

  return tokenAddresses.map((address, index) => ({
    address,
    balance: balances[index] || 0n,
  }))
}

/**
 * Parse token metadata results from multicall batch
 */
function parseTokenMetadataResults(
  tokenAddresses: Address[],
  results: any[],
): TokenMetadata[] {
  const tokens: TokenMetadata[] = []
  const metadataFieldCount = ERC20_METADATA_FUNCTIONS.length

  for (let i = 0; i < tokenAddresses.length; i++) {
    const startIndex = i * metadataFieldCount
    const tokenResults = results.slice(
      startIndex,
      startIndex + metadataFieldCount,
    )

    // Skip tokens where any call failed
    if (tokenResults.some((result) => !result.success)) {
      console.warn(
        `Skipping token ${tokenAddresses[i]} due to failed metadata calls`,
      )
      continue
    }

    const [nameResult, symbolResult, decimalsResult, totalSupplyResult] =
      tokenResults

    tokens.push({
      address: tokenAddresses[i] || "",
      name: nameResult.data as string,
      symbol: symbolResult.data as string,
      decimals: Number(decimalsResult.data),
      totalSupply: totalSupplyResult.data as bigint,
    })
  }

  return tokens
}

/**
 * Parse token metadata + balance results from multicall batch
 */
function parseTokenWithBalanceResults(
  tokenAddresses: Address[],
  results: any[],
): TokenWithBalance[] {
  const tokens: TokenWithBalance[] = []
  const fieldsPerToken = ERC20_METADATA_FUNCTIONS.length + 1 // metadata + balance

  for (let i = 0; i < tokenAddresses.length; i++) {
    const startIndex = i * fieldsPerToken
    const tokenResults = results.slice(startIndex, startIndex + fieldsPerToken)

    // Skip tokens where any call failed
    if (tokenResults.some((result) => !result.success)) {
      console.warn(`Skipping token ${tokenAddresses[i]} due to failed calls`)
      continue
    }

    const [
      nameResult,
      symbolResult,
      decimalsResult,
      totalSupplyResult,
      balanceResult,
    ] = tokenResults

    tokens.push({
      address: tokenAddresses[i] || "",
      name: nameResult.data as string,
      symbol: symbolResult.data as string,
      decimals: Number(decimalsResult.data),
      totalSupply: totalSupplyResult.data as bigint,
      balance: balanceResult.data as bigint,
    })
  }

  return tokens
}
