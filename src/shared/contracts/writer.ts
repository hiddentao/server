import type { PublicClient, TransactionReceipt, WalletClient } from "viem"
import type { TransactionRequest } from "./types"

/**
 * Simple logger interface for contract writer
 */
interface Logger {
  info: (message: string) => void
  error: (message: string) => void
}

/**
 * Default console logger implementation
 */
const defaultLogger: Logger = {
  info: (message: string) => console.log(`[contract-writer] ${message}`),
  error: (message: string) => console.error(`[contract-writer] ${message}`),
}

/**
 * Create a transaction request for contract writes
 */
export function createContractWrite(
  address: string,
  abi: any,
  functionName: string,
  args?: readonly unknown[],
  value?: bigint,
  overrides?: object,
): TransactionRequest {
  return {
    address: address as `0x${string}`,
    abi,
    functionName,
    args,
    ...(value ? { value } : {}),
    ...overrides,
  }
}

/**
 * Execute parameters for contract writes
 */
export interface ContractWriteExecArgs {
  args?: readonly unknown[]
  value?: bigint | string
  overrides?: object
  onTransactionSubmitted?: (txHash: `0x${string}`) => void
  onTransactionConfirmed?: (receipt: TransactionReceipt) => void
  logger?: Logger
}

/**
 * Contract writer state
 */
export interface ContractWriterState {
  isLoading: boolean
  isSuccess: boolean
  error: Error | null
  txHash?: `0x${string}`
  receipt?: TransactionReceipt
}

/**
 * Contract writer interface - mirrors v2 ChainSetterFunction
 */
export interface ContractWriter extends ContractWriterState {
  reset: () => void
  exec: (execArgs?: ContractWriteExecArgs) => Promise<TransactionReceipt>
  canExec: boolean
}

/**
 * Create a contract writer instance with v2-style robust error handling
 * This mirrors the useSetContractValue hook from v2 but as a class-based approach
 */
export class ContractWriterInstance implements ContractWriter {
  public isLoading: boolean = false
  public isSuccess: boolean = false
  public error: Error | null = null
  public txHash?: `0x${string}`
  public receipt?: TransactionReceipt

  private publicClient: PublicClient
  private walletClient: WalletClient
  private baseRequest: TransactionRequest
  private logger: Logger

  constructor(
    publicClient: PublicClient,
    walletClient: WalletClient,
    baseRequest: TransactionRequest,
    logger: Logger = defaultLogger,
  ) {
    this.publicClient = publicClient
    this.walletClient = walletClient
    this.baseRequest = baseRequest
    this.logger = logger
  }

  get canExec(): boolean {
    return !!(
      this.publicClient &&
      this.walletClient &&
      this.walletClient.account
    )
  }

  /**
   * Reset the writer state - allows for retries
   */
  reset(): void {
    this.isLoading = false
    this.isSuccess = false
    this.error = null
    this.txHash = undefined
    this.receipt = undefined
  }

  /**
   * Execute the contract write with robust error handling
   */
  async exec(
    execArgs: ContractWriteExecArgs = {},
  ): Promise<TransactionReceipt> {
    let simulationResult: any

    // Use logger from execArgs if provided, otherwise use instance logger
    const logger = execArgs.logger || this.logger

    logger.info(
      `🚀 Starting contract execution: ${this.baseRequest.functionName}`,
    )
    logger.info(`📍 Contract address: ${this.baseRequest.address}`)
    logger.info(`👤 Account: ${this.walletClient.account?.address}`)

    try {
      // Reset state at start of execution
      this.isLoading = true
      this.isSuccess = false
      this.error = null
      this.txHash = undefined
      this.receipt = undefined

      if (!this.canExec) {
        const errorMsg =
          "Cannot execute: missing public client, wallet client, or account"
        logger.error(`❌ ${errorMsg}`)
        throw new Error(errorMsg)
      }

      // Build the complete request
      const request = {
        ...this.baseRequest,
        account: this.walletClient.account!,
        ...(execArgs.args !== undefined ? { args: execArgs.args } : {}),
        ...(execArgs.value !== undefined
          ? {
              value:
                typeof execArgs.value === "string"
                  ? BigInt(execArgs.value)
                  : execArgs.value,
            }
          : {}),
        ...execArgs.overrides,
      }

      logger.info(`🎯 Function: ${request.functionName}`)
      if (request.args && request.args.length > 0) {
        // Handle BigInt serialization in arguments
        const argsString = JSON.stringify(request.args, (_key, value) =>
          typeof value === "bigint" ? `${value.toString()}n` : value,
        )
        logger.info(`📝 Arguments: ${argsString}`)
      }
      if (request.value) {
        logger.info(`💰 Value: ${request.value} wei`)
      }

      // Step 1: Simulate the transaction
      logger.info("🧪 Simulating transaction...")
      simulationResult = await this.publicClient.simulateContract(request)
      logger.info("✅ Transaction simulation successful")
    } catch (simulationError) {
      this.error =
        simulationError instanceof Error
          ? simulationError
          : new Error(String(simulationError))
      this.isLoading = false

      logger.error(`❌ Simulation failed: ${this.error.message}`)

      // Enhance error message for simulation failures
      const enhancedError = new Error(
        `Transaction simulation failed: ${this.error.message}`,
      )
      enhancedError.cause = this.error
      this.error = enhancedError

      throw this.error
    }

    try {
      // Step 2: Execute the transaction
      logger.info("📤 Submitting transaction to blockchain...")
      this.txHash = await this.walletClient.writeContract(
        simulationResult.request,
      )

      logger.info(`🔗 Transaction submitted: ${this.txHash}`)

      // // Log explorer link based on chain
      // const chainId = await this.publicClient.getChainId()
      // let explorerUrl = ""
      // switch (chainId) {
      //   case 1: // Mainnet
      //     explorerUrl = `https://etherscan.io/tx/${this.txHash}`
      //     break
      //   case 11155111: // Sepolia
      //     explorerUrl = `https://sepolia.etherscan.io/tx/${this.txHash}`
      //     break
      //   case 8453: // Base
      //     explorerUrl = `https://basescan.org/tx/${this.txHash}`
      //     break
      //   case 31337: // Anvil/Local
      //     explorerUrl = `Local anvil tx: ${this.txHash}`
      //     break
      //   default:
      //     explorerUrl = `Chain ${chainId} tx: ${this.txHash}`
      // }

      // logger.info(`🔍 ${explorerUrl}`)

      // Notify caller of transaction submission
      if (execArgs.onTransactionSubmitted) {
        execArgs.onTransactionSubmitted(this.txHash)
      }

      // Step 3: Wait for transaction confirmation
      logger.info("⏳ Waiting for transaction confirmation...")
      this.receipt = await this.publicClient.waitForTransactionReceipt({
        hash: this.txHash,
        timeout: 60000, // 60 second timeout
      })

      // Check transaction status
      if (this.receipt.status !== "success") {
        const errorMsg = `Transaction failed with status: ${this.receipt.status}`
        logger.error(`❌ ${errorMsg}`)
        logger.error(`🔗 Failed tx: ${this.txHash}`)
        throw new Error(errorMsg)
      }

      // Success!
      this.isSuccess = true
      this.isLoading = false

      logger.info(
        `🎉 Transaction confirmed in block: ${this.receipt.blockNumber}`,
      )

      // Notify caller of transaction confirmation
      if (execArgs.onTransactionConfirmed) {
        execArgs.onTransactionConfirmed(this.receipt)
      }

      return this.receipt
    } catch (executionError) {
      this.error =
        executionError instanceof Error
          ? executionError
          : new Error(String(executionError))
      this.isLoading = false

      // Enhance error message based on stage of failure
      if (this.txHash) {
        logger.error(`❌ Transaction execution failed: ${this.error.message}`)
        logger.error(`🔗 Failed tx hash: ${this.txHash}`)

        const enhancedError = new Error(
          `Transaction execution failed (txHash: ${this.txHash}): ${this.error.message}`,
        )
        enhancedError.cause = this.error
        this.error = enhancedError
      } else {
        logger.error(`❌ Transaction submission failed: ${this.error.message}`)

        const enhancedError = new Error(
          `Transaction submission failed: ${this.error.message}`,
        )
        enhancedError.cause = this.error
        this.error = enhancedError
      }

      throw this.error
    }
  }
}

/**
 * Factory function to create a contract writer instance
 */
export function createContractWriter(
  publicClient: PublicClient,
  walletClient: WalletClient,
  request: TransactionRequest,
  logger?: Logger,
): ContractWriter {
  return new ContractWriterInstance(publicClient, walletClient, request, logger)
}

/**
 * Contract write with full error handling and state management
 * This is the main function to use for contract writes in v3
 */
export async function writeContract(
  publicClient: PublicClient,
  walletClient: WalletClient,
  request: TransactionRequest,
  execArgs?: ContractWriteExecArgs,
): Promise<TransactionReceipt> {
  const writer = createContractWriter(publicClient, walletClient, request)
  return await writer.exec(execArgs)
}
