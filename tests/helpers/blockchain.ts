import type { ChildProcess } from "node:child_process"
import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { createPublicClient, createWalletClient, http, parseEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { foundry } from "viem/chains"
import { serverConfig } from "../../src/shared/config/server"
import { getMulticall3Info } from "../../src/shared/contracts"
import { testLogger } from "./logger"

// Abstract base class for blockchain node adapters
abstract class NodeAdapter {
  abstract startCommand(): { command: string; args: string[]; options?: any }
  abstract isReady(output: string): boolean
  abstract mineRPCMethod(): string
  abstract setNextBlockTimestampRPCMethod(): string
}

class AnvilAdapter extends NodeAdapter {
  constructor(private port: number) {
    super()
  }

  startCommand() {
    return {
      command: "anvil",
      args: [
        "--port",
        this.port.toString(),
        "--accounts",
        "10",
        "--balance",
        "10000",
        "--gas-price",
        "1000000000", // 1 gwei
        "--block-time",
        "1",
      ],
      options: {},
    }
  }

  isReady(output: string): boolean {
    return output.includes("Listening on")
  }

  mineRPCMethod(): string {
    return "anvil_mine"
  }

  setNextBlockTimestampRPCMethod(): string {
    return "anvil_setNextBlockTimestamp"
  }
}

class HardhatAdapter extends NodeAdapter {
  constructor(private port: number) {
    super()
  }

  startCommand() {
    return {
      command: process.env.BUN_PATH || "bun",
      args: [
        "hardhat",
        "node",
        "--hostname",
        "127.0.0.1",
        "--port",
        this.port.toString(),
      ],
      options: {
        cwd: path.resolve(process.cwd(), "sample-contracts"),
      },
    }
  }

  isReady(output: string): boolean {
    return output.includes("Started HTTP and WebSocket JSON-RPC server")
  }

  mineRPCMethod(): string {
    return "hardhat_mine"
  }

  setNextBlockTimestampRPCMethod(): string {
    return "evm_setNextBlockTimestamp"
  }
}

export interface TestnetInstance {
  process: ChildProcess
  url: string
  chainId: number
  accounts: string[]
  privateKeys: string[]
  adapter: NodeAdapter
}

export interface BlockchainTestContext {
  testnet: TestnetInstance
  publicClient: ReturnType<typeof createPublicClient>
  walletClient: ReturnType<typeof createWalletClient>
  testAccount: ReturnType<typeof privateKeyToAccount>
  erc20Address?: `0x${string}`
}

// Default testnet accounts (same as hardhat)
const DEFAULT_PRIVATE_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6",
  "0xf214f2b2cd398c806f84e317254e0f0b801d0643303237d97a22a48e01628897",
  "0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82",
  "0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1",
  "0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd",
  "0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa",
  "0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61",
]

/**
 * Gets the test blockchain port from server config
 */
const getTestBlockchainPort = (): number => {
  try {
    // Extract port from WEB3_ANVIL_RPC (e.g., "http://127.0.0.1:58545")
    const rpcUrl = serverConfig.WEB3_ANVIL_RPC
    if (rpcUrl) {
      const url = new URL(rpcUrl)
      return parseInt(url.port, 10) || 58545
    }
    return 58545
  } catch {
    // Fallback to default port if parsing fails
    return 58545
  }
}

/**
 * Starts a testnet instance for testing
 * Uses the port from serverConfig.SERVER_ANVIL_CHAIN_RPC if no port is provided
 * @param port Optional port number
 * @param nodeType Type of node to use (defaults to 'hardhat')
 */
export const startTestnet = async (
  port?: number,
  nodeType: "anvil" | "hardhat" = "hardhat",
): Promise<TestnetInstance> => {
  const testPort = port ?? getTestBlockchainPort()
  testLogger.info(`Starting ${nodeType} testnet on port ${testPort}`)

  const adapter =
    nodeType === "anvil"
      ? new AnvilAdapter(testPort)
      : new HardhatAdapter(testPort)
  const { command, args, options } = adapter.startCommand()

  return new Promise((resolve, reject) => {
    const testnetProcess = spawn(command, args, options)

    let isResolved = false
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true
        testnetProcess.kill()
        reject(new Error("Testnet failed to start within timeout"))
      }
    }, 10000) // 10 second timeout

    testnetProcess.stdout?.on("data", (data) => {
      const output = data.toString()

      // Use adapter to check if testnet is ready
      if (adapter.isReady(output) && !isResolved) {
        isResolved = true
        clearTimeout(timeout)

        const testnetInstance = {
          process: testnetProcess,
          url: `http://127.0.0.1:${testPort}`,
          chainId: foundry.id,
          accounts: DEFAULT_PRIVATE_KEYS.map(
            (pk) => privateKeyToAccount(pk as `0x${string}`).address,
          ),
          privateKeys: DEFAULT_PRIVATE_KEYS,
          adapter: adapter,
        }

        // Deploy Multicall3 immediately after testnet starts
        deployMulticall3ToTestnet(testnetInstance)
          .then(() => {
            resolve(testnetInstance)
          })
          .catch((error) => {
            testLogger.error("Failed to deploy Multicall3 to testnet:", error)
            resolve(testnetInstance) // Continue even if Multicall3 deployment fails
          })
      }
    })

    testnetProcess.stderr?.on("data", (data) => {
      const error = data.toString()
      if (!isResolved && error.includes("Error")) {
        isResolved = true
        clearTimeout(timeout)
        testnetProcess.kill()
        reject(new Error(`Testnet error: ${error}`))
      }
    })

    testnetProcess.on("error", (error) => {
      if (!isResolved) {
        isResolved = true
        clearTimeout(timeout)
        reject(error)
      }
    })
  })
}

/**
 * Stops a testnet instance
 */
export const stopTestnet = async (testnet: TestnetInstance): Promise<void> => {
  return new Promise((resolve) => {
    if (testnet.process.killed) {
      resolve()
      return
    }

    testnet.process.on("exit", () => {
      resolve()
    })

    testnet.process.kill("SIGTERM")

    // Force kill after 5 seconds if it doesn't exit gracefully
    setTimeout(() => {
      if (!testnet.process.killed) {
        testnet.process.kill("SIGKILL")
      }
      resolve()
    }, 5000)
  })
}

/**
 * Deploys Multicall3 to testnet immediately after startup
 */
const deployMulticall3ToTestnet = async (
  testnet: TestnetInstance,
): Promise<void> => {
  try {
    const multicall3Info = getMulticall3Info()

    testLogger.info(
      `Deploying Multicall3 to testnet at ${multicall3Info.contract}`,
    )

    // Create clients for this testnet instance (disable caching for accurate block numbers)
    const publicClient = createPublicClient({
      chain: foundry,
      transport: http(testnet.url),
      cacheTime: 0,
    })

    const testAccount = privateKeyToAccount(
      testnet.privateKeys[0] as `0x${string}`,
    )
    const walletClient = createWalletClient({
      chain: foundry,
      transport: http(testnet.url),
      account: testAccount,
    })

    // Check if Multicall3 is already deployed
    try {
      const bytecode = await publicClient.getCode({
        address: multicall3Info.contract,
      })

      if (bytecode && bytecode.length > 5) {
        testLogger.info("✅ Multicall3 already deployed on testnet")
        return
      }
    } catch {
      testLogger.debug("Multicall3 not found on testnet, will deploy")
    }

    // Fund the sender address with the required ETH
    const fundingTx = await walletClient.sendTransaction({
      account: testAccount,
      chain: foundry,
      to: multicall3Info.sender,
      value: BigInt(parseFloat(multicall3Info.eth) * 10 ** 18), // Convert ETH to wei
    })

    await publicClient.waitForTransactionReceipt({ hash: fundingTx })
    testLogger.info(
      `Funded Multicall3 deployer address ${multicall3Info.sender}`,
    )

    // Deploy using the pre-signed transaction
    const deployTx = await publicClient.sendRawTransaction({
      serializedTransaction: multicall3Info.signedDeploymentTx,
    })

    const deployReceipt = await publicClient.waitForTransactionReceipt({
      hash: deployTx,
    })

    if (deployReceipt.status === "success") {
      // Verify deployment
      const bytecode = await publicClient.getCode({
        address: multicall3Info.contract,
      })

      if (bytecode && bytecode.length > 5) {
        testLogger.info(
          `✅ Multicall3 deployed successfully to testnet at ${multicall3Info.contract}`,
        )
        testLogger.info(`Transaction hash: ${deployTx}`)
      } else {
        throw new Error("Multicall3 deployment verification failed")
      }
    } else {
      throw new Error("Deployment transaction failed")
    }
  } catch (error) {
    testLogger.error("Multicall3 deployment to testnet failed:", error)
    throw error
  }
}

/**
 * Creates a blockchain test context with clients and test account
 */
export const createBlockchainTestContext = async (
  port?: number,
): Promise<BlockchainTestContext> => {
  const testnet = await startTestnet(port)

  // Disable caching for accurate block numbers in tests
  const publicClient = createPublicClient({
    chain: foundry,
    transport: http(testnet.url),
    cacheTime: 0,
  })

  const testAccount = privateKeyToAccount(
    testnet.privateKeys[0] as `0x${string}`,
  )

  const walletClient = createWalletClient({
    chain: foundry,
    transport: http(testnet.url),
    account: testAccount,
  })

  return {
    testnet,
    publicClient,
    walletClient,
    testAccount,
  }
}

/**
 * Deploys a mock ERC20 token contract for testing
 */
export const deployMockERC20 = async (
  context: BlockchainTestContext,
  options: {
    name?: string
    symbol?: string
    initialSupply?: bigint
    decimals?: number
  } = {},
): Promise<`0x${string}`> => {
  const {
    name = "Test Token",
    symbol = "TEST",
    initialSupply = parseEther("1000000"),
    decimals = 18,
  } = options

  try {
    // Load the compiled contract artifacts
    const contractPath = path.join(
      __dirname,
      "contracts/out/TestToken.sol/TestToken.json",
    )

    if (!fs.existsSync(contractPath)) {
      throw new Error(
        `Contract artifact not found at ${contractPath}. Run 'forge build' first.`,
      )
    }

    const contractArtifact = JSON.parse(fs.readFileSync(contractPath, "utf8"))
    const bytecode = contractArtifact.bytecode.object as `0x${string}`
    const abi = contractArtifact.abi

    // Deploy the contract
    const hash = await context.walletClient.deployContract({
      abi,
      bytecode,
      args: [
        name,
        symbol,
        initialSupply,
        decimals,
        context.testAccount.address,
      ],
      account: context.testAccount,
      chain: foundry,
    })

    // Wait for the transaction to be mined
    const receipt = await context.publicClient.waitForTransactionReceipt({
      hash,
    })

    if (!receipt.contractAddress) {
      throw new Error(
        "Contract deployment failed - no contract address in receipt",
      )
    }

    return receipt.contractAddress
  } catch (error) {
    testLogger.error("ERC20 deployment failed:", error)

    // Fallback to mock address for tests that don't require actual deployment
    testLogger.warn("Falling back to mock address")
    return "0x1234567890123456789012345678901234567890" as `0x${string}`
  }
}

/**
 * Mines a specific number of blocks
 */
export const mineBlocks = async (
  context: BlockchainTestContext,
  blockCount: number,
): Promise<void> => {
  // Use adapter's mine RPC method
  for (let i = 0; i < blockCount; i++) {
    await context.publicClient.request({
      method: context.testnet.adapter.mineRPCMethod() as any,
      params: [],
    })
  }
}

/**
 * Sets the next block timestamp
 */
export const setNextBlockTimestamp = async (
  context: BlockchainTestContext,
  timestamp: number,
): Promise<void> => {
  await context.publicClient.request({
    method: context.testnet.adapter.setNextBlockTimestampRPCMethod() as any,
    params: [timestamp],
  })
}

/**
 * Gets the current block number
 */
export const getCurrentBlockNumber = async (
  context: BlockchainTestContext,
): Promise<bigint> => {
  return await context.publicClient.getBlockNumber()
}

/**
 * Gets ERC20 token information
 */
export const getERC20Info = async (
  context: BlockchainTestContext,
  tokenAddress: `0x${string}`,
): Promise<{
  name: string
  symbol: string
  decimals: number
  totalSupply: bigint
}> => {
  try {
    const contractPath = path.join(
      __dirname,
      "contracts/out/TestToken.sol/TestToken.json",
    )

    if (!fs.existsSync(contractPath)) {
      throw new Error(`Contract artifact not found at ${contractPath}`)
    }

    const contractArtifact = JSON.parse(fs.readFileSync(contractPath, "utf8"))
    const abi = contractArtifact.abi

    // Read contract information
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      context.publicClient.readContract({
        address: tokenAddress,
        abi,
        functionName: "name",
        args: [],
      }) as Promise<string>,
      context.publicClient.readContract({
        address: tokenAddress,
        abi,
        functionName: "symbol",
        args: [],
      }) as Promise<string>,
      context.publicClient.readContract({
        address: tokenAddress,
        abi,
        functionName: "decimals",
        args: [],
      }) as Promise<number>,
      context.publicClient.readContract({
        address: tokenAddress,
        abi,
        functionName: "totalSupply",
        args: [],
      }) as Promise<bigint>,
    ])

    return { name, symbol, decimals, totalSupply }
  } catch (error) {
    testLogger.error("Failed to get ERC20 info:", error)
    throw error
  }
}

/**
 * Transfers ERC20 tokens
 */
export const transferERC20 = async (
  context: BlockchainTestContext,
  tokenAddress: `0x${string}`,
  to: `0x${string}`,
  amount: bigint,
): Promise<`0x${string}`> => {
  try {
    const contractPath = path.join(
      __dirname,
      "contracts/out/TestToken.sol/TestToken.json",
    )

    const contractArtifact = JSON.parse(fs.readFileSync(contractPath, "utf8"))
    const abi = contractArtifact.abi

    // Send transfer transaction
    const hash = await context.walletClient.writeContract({
      address: tokenAddress,
      abi,
      functionName: "transfer",
      args: [to, amount],
      chain: foundry,
      account: context.testAccount,
    })

    // Wait for confirmation
    await context.publicClient.waitForTransactionReceipt({ hash })

    return hash
  } catch (error) {
    testLogger.error("Failed to transfer ERC20:", error)
    throw error
  }
}

/**
 * Deploys a TestTokenFactory contract for testing
 */
export const deployTokenFactory = async (
  context: BlockchainTestContext,
): Promise<`0x${string}`> => {
  try {
    // Load the compiled contract artifacts
    const contractPath = path.join(
      __dirname,
      "contracts/out/TestTokenFactory.sol/TestTokenFactory.json",
    )

    if (!fs.existsSync(contractPath)) {
      throw new Error(
        `Contract artifact not found at ${contractPath}. Run 'forge build' first.`,
      )
    }

    const contractArtifact = JSON.parse(fs.readFileSync(contractPath, "utf8"))
    const bytecode = contractArtifact.bytecode.object as `0x${string}`
    const abi = contractArtifact.abi

    // Deploy the factory contract
    const hash = await context.walletClient.deployContract({
      abi,
      bytecode,
      args: [],
      account: context.testAccount,
      chain: foundry,
    })

    // Wait for the transaction to be mined
    const receipt = await context.publicClient.waitForTransactionReceipt({
      hash,
    })

    if (!receipt.contractAddress) {
      throw new Error(
        "Factory deployment failed - no contract address in receipt",
      )
    }

    testLogger.info(`TestTokenFactory deployed at ${receipt.contractAddress}`)
    return receipt.contractAddress
  } catch (error) {
    testLogger.error("TokenFactory deployment failed:", error)
    throw error
  }
}

/**
 * Deploys a token via the TestTokenFactory
 */
export const deployTokenViaFactory = async (
  context: BlockchainTestContext,
  factoryAddress: `0x${string}`,
  options: {
    name?: string
    symbol?: string
    decimals?: number
    initialSupply?: bigint
  } = {},
): Promise<`0x${string}`> => {
  const {
    name = "Factory Token",
    symbol = "FACT",
    decimals = 18,
    initialSupply = parseEther("1000000"),
  } = options

  try {
    // Load the factory contract artifacts
    const contractPath = path.join(
      __dirname,
      "contracts/out/TestTokenFactory.sol/TestTokenFactory.json",
    )

    const contractArtifact = JSON.parse(fs.readFileSync(contractPath, "utf8"))
    const abi = contractArtifact.abi

    // Call erc20DeployToken on the factory
    const hash = await context.walletClient.writeContract({
      address: factoryAddress,
      abi,
      functionName: "erc20DeployToken",
      args: [
        {
          name,
          symbol,
          decimals,
        },
        initialSupply,
      ],
      chain: foundry,
      account: context.testAccount,
    })

    // Wait for the transaction to be mined
    const receipt = await context.publicClient.waitForTransactionReceipt({
      hash,
    })

    testLogger.debug(
      `Factory tx receipt: block=${receipt.blockNumber}, logs=${receipt.logs.length}`,
    )
    for (const log of receipt.logs) {
      testLogger.debug(
        `  Log from ${log.address}: topic0=${log.topics[0]}, topics=${log.topics.length}`,
      )
    }

    // Get the ERC20NewToken event to find the deployed token address
    const logs = await context.publicClient.getLogs({
      address: factoryAddress,
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    })

    testLogger.debug(
      `Logs from factory address ${factoryAddress}: ${logs.length}`,
    )
    for (const log of logs) {
      testLogger.debug(
        `  Factory log: topic0=${log.topics[0]}, topics=${log.topics.length}`,
      )
    }

    // Find the ERC20NewToken event log
    const tokenCreationLog = logs.find(
      (log) => log.topics[0] && log.topics.length >= 3,
    )

    if (!tokenCreationLog || !tokenCreationLog.topics[1]) {
      throw new Error("Could not find ERC20NewToken event in transaction logs")
    }

    // Extract token address from the event (first indexed parameter after event signature)
    const tokenAddress =
      `0x${tokenCreationLog.topics[1]!.slice(-40)}` as `0x${string}`

    testLogger.info(
      `Token ${symbol} deployed via factory at ${tokenAddress} (tx: ${hash})`,
    )
    return tokenAddress
  } catch (error) {
    testLogger.error("Factory token deployment failed:", error)
    throw error
  }
}

/**
 * Cleans up a blockchain test context
 */
export const cleanupBlockchainTestContext = async (
  context: BlockchainTestContext,
): Promise<void> => {
  await stopTestnet(context.testnet)
}
