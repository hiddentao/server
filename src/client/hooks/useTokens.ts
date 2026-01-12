import {
  fetchMultipleTokensWithBalances,
  fetchTokenWithBalance,
  getFactoryContractInfo,
  readContract,
  type TokenWithBalance,
} from "@shared/contracts"
import { useQuery } from "@tanstack/react-query"
import type { Address } from "viem"
import { useAccount, usePublicClient } from "wagmi"

export interface Token extends TokenWithBalance {
  createdAt?: string
}

export interface TokensResponse {
  tokens: Token[]
  total: number
}

/**
 * Hook to get all tokens owned by the current user
 */
export function useMyTokens() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  return useQuery({
    queryKey: ["tokens", "my-tokens", address],
    queryFn: async (): Promise<TokensResponse> => {
      if (!publicClient || !address) {
        return { tokens: [], total: 0 }
      }

      // Get all token addresses from factory
      const factory = getFactoryContractInfo()
      const tokenAddresses = await readContract<Address[]>(
        {
          address: factory.address,
          abi: factory.abi,
          functionName: "getAllErc20Addresses",
        },
        publicClient,
      )

      if (!tokenAddresses || tokenAddresses.length === 0) {
        return { tokens: [], total: 0 }
      }

      // Fetch all tokens with balances using multicall
      const tokensWithBalances = await fetchMultipleTokensWithBalances(
        tokenAddresses,
        address,
        publicClient,
      )

      // Filter to only tokens with balance > 0 and add app-specific fields
      const userTokens: Token[] = tokensWithBalances
        .filter((token) => token.balance > 0n)
        .map((token) => ({
          ...token,
          createdAt: new Date().toISOString(),
        }))

      return {
        tokens: userTokens,
        total: userTokens.length,
      }
    },
    enabled: isConnected && !!address && !!publicClient,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 5, // 5 seconds
  })
}

/**
 * Hook to get information about a specific token
 */
export function useTokenInfo(tokenAddress: string | undefined) {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient()

  return useQuery({
    queryKey: ["tokens", "token-info", tokenAddress, address],
    queryFn: async (): Promise<Token | null> => {
      if (!publicClient || !address || !tokenAddress) {
        return null
      }

      try {
        const tokenWithBalance = await fetchTokenWithBalance(
          tokenAddress as Address,
          address,
          publicClient,
        )

        return {
          ...tokenWithBalance,
          createdAt: new Date().toISOString(),
        }
      } catch (error) {
        console.error(`Failed to fetch token info for ${tokenAddress}:`, error)
        return null
      }
    },
    enabled: isConnected && !!address && !!publicClient && !!tokenAddress,
    staleTime: 1000 * 60, // 1 minute
  })
}

/**
 * Hook to get the total count of tokens deployed by the factory
 */
export function useTokenCount() {
  const publicClient = usePublicClient()

  return useQuery({
    queryKey: ["tokens", "count"],
    queryFn: async (): Promise<number> => {
      if (!publicClient) {
        return 0
      }

      try {
        const factory = getFactoryContractInfo()
        const count = await readContract<bigint>(
          {
            address: factory.address,
            abi: factory.abi,
            functionName: "getNumErc20s",
          },
          publicClient,
        )

        return Number(count)
      } catch (error) {
        console.error("Failed to fetch token count:", error)
        return 0
      }
    },
    enabled: !!publicClient,
    staleTime: 1000 * 30, // 30 seconds
  })
}
