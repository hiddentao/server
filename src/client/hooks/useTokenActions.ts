import {
  createContractWrite,
  getERC20ContractInfo,
  getFactoryContractInfo,
  writeContract,
} from "@shared/contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { type Address, parseUnits } from "viem"
import {
  useAccount,
  usePublicClient,
  useWaitForTransactionReceipt,
  useWalletClient,
} from "wagmi"

export interface CreateTokenParams {
  name: string
  symbol: string
  decimals: number
  initialSupply: string
}

export interface TransferTokenParams {
  tokenAddress: string
  to: string
  amount: string
  decimals: number
}

/**
 * Hook to create a new ERC20 token
 */
export function useCreateToken() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: CreateTokenParams) => {
      if (!address) {
        throw new Error("Wallet not connected")
      }

      if (!publicClient) {
        throw new Error("Public client not available")
      }

      if (!walletClient) {
        throw new Error("Wallet client not available")
      }

      const factory = getFactoryContractInfo()
      const initialSupplyWei = parseUnits(params.initialSupply, params.decimals)

      const contractCall = createContractWrite(
        factory.address,
        factory.abi,
        "erc20DeployToken",
        [
          {
            name: params.name,
            symbol: params.symbol,
            decimals: params.decimals,
          },
          initialSupplyWei,
        ],
      )

      const receipt = await writeContract(
        publicClient,
        walletClient,
        contractCall,
      )
      return { hash: receipt.transactionHash, params }
    },
    onSuccess: () => {
      // Invalidate and refetch token-related queries
      queryClient.invalidateQueries({ queryKey: ["tokens"] })
    },
  })
}

/**
 * Hook to transfer ERC20 tokens
 */
export function useTransferToken() {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: TransferTokenParams) => {
      if (!address) {
        throw new Error("Wallet not connected")
      }

      if (!publicClient) {
        throw new Error("Public client not available")
      }

      if (!walletClient) {
        throw new Error("Wallet client not available")
      }

      const amountWei = parseUnits(params.amount, params.decimals)
      const erc20Contract = getERC20ContractInfo(params.tokenAddress)

      const contractCall = createContractWrite(
        erc20Contract.address,
        erc20Contract.abi,
        "transfer",
        [params.to as Address, amountWei],
      )

      const receipt = await writeContract(
        publicClient,
        walletClient,
        contractCall,
      )
      return { hash: receipt.transactionHash, params }
    },
    onSuccess: () => {
      // Invalidate and refetch token-related queries
      queryClient.invalidateQueries({ queryKey: ["tokens"] })
    },
  })
}

/**
 * Hook to wait for a transaction receipt and handle success/error states
 */
export function useTransactionStatus(hash: Address | undefined) {
  const {
    data: receipt,
    isLoading,
    isSuccess,
    isError,
    error,
  } = useWaitForTransactionReceipt({
    hash,
    query: {
      enabled: !!hash,
    },
  })

  return {
    receipt,
    isLoading,
    isSuccess: isSuccess && receipt?.status === "success",
    isError: isError || receipt?.status === "reverted",
    error,
  }
}
