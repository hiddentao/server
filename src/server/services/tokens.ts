import { type Address, isAddress } from "viem"
import erc20AbiJson from "../../shared/abi/data/erc20abi.json"
import { FactoryContract_ABI } from "../../shared/abi/generated"
import { clientConfig } from "../../shared/config/client"
import type { ServerApp } from "../types"

// Use the ERC20 ABI from the JSON file directly
const ERC20_ABI = erc20AbiJson

export interface TokenInfo {
  address: string
  name: string
  symbol: string
  decimals: number
  totalSupply: bigint
  balance: bigint
}

export interface CreateTokenParams {
  name: string
  symbol: string
  decimals: number
  initialSupply: bigint
  userAddress: Address
}

export interface TransferTokenParams {
  tokenAddress: Address
  to: Address
  amount: bigint
  userAddress: Address
}

export class TokenService {
  constructor(private serverApp: ServerApp) {}

  private get logger() {
    return this.serverApp.createLogger("token-service")
  }

  private requirePublicClient() {
    if (!this.serverApp.publicClient) {
      throw new Error(
        "Blockchain client not available - WEB3_ENABLED may be false",
      )
    }
    return this.serverApp.publicClient
  }

  /**
   * Get all tokens created by the factory
   */
  async getAllTokenAddresses(): Promise<Address[]> {
    try {
      if (!clientConfig.WEB3_FACTORY_CONTRACT_ADDRESS) {
        throw new Error("WEB3_FACTORY_CONTRACT_ADDRESS is not configured")
      }
      const factoryAddress =
        clientConfig.WEB3_FACTORY_CONTRACT_ADDRESS as Address
      const publicClient = this.requirePublicClient()

      const addresses = (await publicClient.readContract({
        address: factoryAddress,
        abi: FactoryContract_ABI,
        functionName: "getAllErc20Addresses",
      })) as Address[]

      this.logger.debug(`Found ${addresses.length} tokens from factory`)
      return addresses
    } catch (error) {
      this.logger.error("Failed to get token addresses from factory:", error)
      throw new Error("Failed to retrieve token addresses")
    }
  }

  /**
   * Get token information including balance for a specific user
   */
  async getTokenInfo(
    tokenAddress: Address,
    userAddress: Address,
  ): Promise<TokenInfo | null> {
    try {
      if (!isAddress(tokenAddress)) {
        throw new Error("Invalid token address")
      }

      const publicClient = this.requirePublicClient()

      // Read token metadata
      const [name, symbol, decimals, totalSupply, balance] = await Promise.all([
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "name",
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "symbol",
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "decimals",
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "totalSupply",
        }),
        publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [userAddress],
        }),
      ])

      return {
        address: tokenAddress,
        name: name as string,
        symbol: symbol as string,
        decimals: Number(decimals),
        totalSupply: totalSupply as bigint,
        balance: balance as bigint,
      }
    } catch (error) {
      this.logger.error(`Failed to get token info for ${tokenAddress}:`, error)
      return null
    }
  }

  /**
   * Get all tokens with their info for a specific user
   */
  async getUserTokens(userAddress: Address): Promise<TokenInfo[]> {
    try {
      const tokenAddresses = await this.getAllTokenAddresses()

      // Get token info for each address
      const tokenInfoPromises = tokenAddresses.map((address) =>
        this.getTokenInfo(address, userAddress),
      )

      const tokenInfos = await Promise.all(tokenInfoPromises)

      // Filter out null results and return only tokens with balance > 0
      return tokenInfos.filter(
        (info): info is TokenInfo => info !== null && info.balance > 0n,
      )
    } catch (error) {
      this.logger.error("Failed to get user tokens:", error)
      throw new Error("Failed to retrieve user tokens")
    }
  }

  /**
   * Get transaction data for token creation (to be signed by user's wallet)
   */
  async prepareCreateTokenTransaction(params: CreateTokenParams) {
    if (!clientConfig.WEB3_FACTORY_CONTRACT_ADDRESS) {
      throw new Error("WEB3_FACTORY_CONTRACT_ADDRESS is not configured")
    }
    const factoryAddress = clientConfig.WEB3_FACTORY_CONTRACT_ADDRESS as Address

    return {
      address: factoryAddress,
      abi: FactoryContract_ABI,
      functionName: "erc20DeployToken",
      args: [
        {
          name: params.name,
          symbol: params.symbol,
          decimals: params.decimals,
        },
        params.initialSupply,
      ],
    }
  }

  /**
   * Get transaction data for token transfer (to be signed by user's wallet)
   */
  async prepareTransferTokenTransaction(params: TransferTokenParams) {
    if (!isAddress(params.tokenAddress) || !isAddress(params.to)) {
      throw new Error("Invalid address provided")
    }

    return {
      address: params.tokenAddress,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [params.to, params.amount],
    }
  }

  /**
   * Wait for transaction confirmation and extract token address from logs
   */
  async waitForTokenCreation(
    txHash: Address,
  ): Promise<{ tokenAddress: Address | null }> {
    try {
      const publicClient = this.requirePublicClient()
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      })

      if (receipt.status !== "success") {
        throw new Error("Token creation transaction failed")
      }

      // Extract token address from ERC20NewToken event logs
      if (!clientConfig.WEB3_FACTORY_CONTRACT_ADDRESS) {
        throw new Error("WEB3_FACTORY_CONTRACT_ADDRESS is not configured")
      }
      const factoryAddress =
        clientConfig.WEB3_FACTORY_CONTRACT_ADDRESS as Address
      const tokenCreationLog = receipt.logs.find(
        (log) => log.address.toLowerCase() === factoryAddress.toLowerCase(),
      )

      if (
        tokenCreationLog &&
        tokenCreationLog.topics &&
        tokenCreationLog.topics[1]
      ) {
        // The token address is in the first indexed parameter (after event signature)
        const tokenAddress =
          `0x${tokenCreationLog.topics[1].slice(26)}` as Address
        this.logger.info(`Token created successfully: ${tokenAddress}`)
        return { tokenAddress }
      }

      // Fallback: get the latest token from the factory
      const allTokens = await this.getAllTokenAddresses()
      const tokenAddress = allTokens[allTokens.length - 1] || null

      return { tokenAddress }
    } catch (error) {
      this.logger.error("Failed to wait for token creation:", error)
      throw new Error("Failed to confirm token creation")
    }
  }
}
