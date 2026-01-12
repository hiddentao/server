import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test"
import { eq } from "drizzle-orm"
import { notifications, workerJobs } from "../../../src/server/db/schema"
import { setLastProcessedBlock } from "../../../src/server/db/settings"
import { scheduleJob } from "../../../src/server/db/worker"
import { getPrimaryChainName } from "../../../src/shared/contracts/chain"
import type { BlockchainTestContext } from "../../helpers/blockchain"
import {
  cleanupBlockchainTestContext,
  createBlockchainTestContext,
  deployMockERC20,
  deployTokenFactory,
  deployTokenViaFactory,
  mineBlocks,
  transferERC20,
} from "../../helpers/blockchain"
import { createTestUser, setupTestDatabase } from "../../helpers/database"
import { testLogger } from "../../helpers/logger"
import type { TestServer } from "../../helpers/server"
import { startTestServer, waitForServer } from "../../helpers/server"
import type { TestWorkerContext } from "../../helpers/worker"
import {
  startTestWorker,
  stopTestWorker,
  submitTestJobAndWait,
} from "../../helpers/worker"
// Import global test setup
import "../../setup"

function getChainName(): string {
  return getPrimaryChainName()
}

describe("Worker Blockchain Integration Tests", () => {
  let blockchainContext: BlockchainTestContext
  let serverContext: TestServer
  let workerContext: TestWorkerContext

  beforeAll(async () => {
    try {
      testLogger.info("Setting up blockchain integration tests...")

      await setupTestDatabase()

      // Start blockchain FIRST so server/workers can connect to it
      testLogger.info("Starting test blockchain...")
      blockchainContext = await createBlockchainTestContext()
      testLogger.info(
        `Test blockchain started at ${blockchainContext.testnet.url}`,
      )

      // Now start server - its workers will connect to the running blockchain
      serverContext = await startTestServer()
      await waitForServer(serverContext.url)

      testLogger.info("Starting test worker...")
      workerContext = await startTestWorker()
      testLogger.info(
        `Test worker started: ${workerContext.isRunning ? "RUNNING" : "NOT RUNNING"}`,
      )

      if (!workerContext.isRunning) {
        throw new Error("Test worker failed to start properly")
      }

      testLogger.info("Blockchain test setup complete")
    } catch (error) {
      testLogger.error("Blockchain test setup failed:", error)
      throw error
    }
  })

  afterAll(async () => {
    try {
      testLogger.info("Cleaning up blockchain integration tests...")

      if (workerContext) {
        await stopTestWorker(workerContext)
      }

      if (blockchainContext) {
        await cleanupBlockchainTestContext(blockchainContext)
      }

      if (serverContext) {
        await serverContext.shutdown()
      }

      testLogger.info("Blockchain test cleanup complete")
    } catch (error) {
      testLogger.error("Blockchain test cleanup failed:", error)
    }
  })

  const runWatchChain = async () => {
    const job = await submitTestJobAndWait(
      serverContext.serverApp,
      {
        tag: `test-watch-chain-${Date.now()}`,
        type: "watchChain",
        userId: 0,
        data: {},
      },
      { timeoutMs: 10000 },
    )

    if (!job.success) {
      throw new Error(`watchChain job failed: ${JSON.stringify(job.result)}`)
    }
  }

  describe("Blockchain Event Monitoring", () => {
    beforeEach(async () => {
      await setupTestDatabase()
      await serverContext.serverApp.db.delete(workerJobs)
    })

    test(
      "should monitor ERC20 transfer events and create notifications",
      async () => {
        const sender = blockchainContext.testnet.accounts[0] as `0x${string}`
        const testUser = await createTestUser({
          web3Wallet: sender.toLowerCase(),
        })

        testLogger.info(
          `Created test user ${testUser.id} with wallet ${sender.toLowerCase()}`,
        )

        // Set lastProcessedBlock to current block to isolate from previous tests
        const currentBlock =
          await blockchainContext.publicClient.getBlockNumber()
        await setLastProcessedBlock(
          serverContext.serverApp.db,
          getChainName(),
          currentBlock,
        )
        testLogger.info(`Set lastProcessedBlock to ${currentBlock}`)

        // Deploy token and perform transfer
        testLogger.info("Deploying test ERC20 token...")
        const tokenAddress = await deployMockERC20(blockchainContext, {
          name: "Test Token",
          symbol: "TEST",
          initialSupply: 1000000n * 10n ** 18n,
        })
        testLogger.info(`Token deployed at ${tokenAddress}`)

        const recipient = blockchainContext.testnet.accounts[1] as `0x${string}`
        const transferAmount = 1000n * 10n ** 18n

        testLogger.info(
          `Transferring tokens from ${sender.toLowerCase()} to ${recipient}`,
        )
        await transferERC20(
          blockchainContext,
          tokenAddress,
          recipient,
          transferAmount,
        )
        await mineBlocks(blockchainContext, 1)
        testLogger.info("Token transfer completed")

        // Get the current block from the test's perspective
        const currentBlockBeforeWatch =
          await blockchainContext.publicClient.getBlockNumber()
        testLogger.info(
          `Current block before watchChain: ${currentBlockBeforeWatch}`,
        )

        // Run watchChain to process events
        await runWatchChain()

        // Check notifications
        const userNotifications = await serverContext.serverApp.db
          .select()
          .from(notifications)
          .where(eq(notifications.userId, testUser.id))

        testLogger.info(
          `Found ${userNotifications.length} notifications for user ${testUser.id}`,
        )

        expect(userNotifications.length).toBeGreaterThan(0)

        const transferNotification = userNotifications.find((n) => {
          const data = n.data as any
          return data.type === "token_transfer"
        })

        expect(transferNotification).toBeDefined()

        const notificationData = transferNotification!.data as any
        expect(notificationData.type).toBe("token_transfer")
        expect(notificationData.tokenAddress).toBe(tokenAddress.toLowerCase())
        expect(notificationData.from.toLowerCase()).toBe(sender.toLowerCase())
        expect(notificationData.to.toLowerCase()).toBe(recipient.toLowerCase())
        expect(notificationData.amount).toBe(transferAmount.toString())
        expect(notificationData.tokenSymbol).toBe("TEST")
        expect(notificationData.tokenName).toBe("Test Token")

        testLogger.info("Transfer notification verified")
      },
      { timeout: 15000 },
    )

    test(
      "should monitor token creation events and create notifications",
      async () => {
        const creator = blockchainContext.testnet.accounts[0] as `0x${string}`
        const testUser = await createTestUser({
          web3Wallet: creator.toLowerCase(),
        })

        testLogger.info(
          `Created test user ${testUser.id} with wallet ${creator.toLowerCase()}`,
        )

        // Set lastProcessedBlock to current block to isolate from previous tests
        const startBlock = await blockchainContext.publicClient.getBlockNumber()
        testLogger.info(
          `Current block before setting lastProcessedBlock: ${startBlock}`,
        )
        await setLastProcessedBlock(
          serverContext.serverApp.db,
          getChainName(),
          startBlock,
        )
        testLogger.info(`Set lastProcessedBlock to ${startBlock}`)

        // Deploy factory and create token
        testLogger.info("Deploying TestTokenFactory...")
        const factoryAddress = await deployTokenFactory(blockchainContext)
        const afterFactoryBlock =
          await blockchainContext.publicClient.getBlockNumber()
        testLogger.info(
          `Factory deployed at ${factoryAddress} (block ${afterFactoryBlock})`,
        )

        testLogger.info("Deploying token via factory...")
        const tokenAddress = await deployTokenViaFactory(
          blockchainContext,
          factoryAddress,
          {
            name: "Factory Created Token",
            symbol: "FCT",
            decimals: 18,
            initialSupply: 500000n * 10n ** 18n,
          },
        )
        const afterTokenBlock =
          await blockchainContext.publicClient.getBlockNumber()
        testLogger.info(
          `Token created at ${tokenAddress} (block ${afterTokenBlock})`,
        )

        await mineBlocks(blockchainContext, 1)
        const finalBlock = await blockchainContext.publicClient.getBlockNumber()
        testLogger.info(`After mining: block ${finalBlock}`)

        // Run watchChain to process events
        await runWatchChain()

        // Check notifications
        const userNotifications = await serverContext.serverApp.db
          .select()
          .from(notifications)
          .where(eq(notifications.userId, testUser.id))

        testLogger.info(
          `Found ${userNotifications.length} notifications for user ${testUser.id}`,
        )
        userNotifications.forEach((n, i) => {
          const data = n.data as any
          testLogger.info(
            `  Notification ${i + 1}: type=${data.type}, symbol=${data.tokenSymbol}`,
          )
        })

        expect(userNotifications.length).toBeGreaterThan(0)

        const creationNotification = userNotifications.find((n) => {
          const data = n.data as any
          return data.type === "token_created"
        })

        expect(creationNotification).toBeDefined()

        const notificationData = creationNotification!.data as any
        expect(notificationData.type).toBe("token_created")
        expect(notificationData.tokenAddress).toBe(tokenAddress.toLowerCase())
        expect(notificationData.creator.toLowerCase()).toBe(
          creator.toLowerCase(),
        )
        expect(notificationData.tokenSymbol).toBe("FCT")
        expect(notificationData.tokenName).toBe("Factory Created Token")
        expect(notificationData.initialSupply).toBe(
          (500000n * 10n ** 18n).toString(),
        )

        testLogger.info("Token creation notification verified")
      },
      { timeout: 15000 },
    )

    test(
      "should handle multiple token contracts being monitored",
      async () => {
        const walletAddress =
          blockchainContext.testnet.accounts[0]!.toLowerCase()
        const testUser = await createTestUser({
          web3Wallet: walletAddress,
        })

        testLogger.info(
          `Created test user ${testUser.id} with wallet ${walletAddress}`,
        )

        // Set lastProcessedBlock to current block to isolate from previous tests
        const currentBlock =
          await blockchainContext.publicClient.getBlockNumber()
        await setLastProcessedBlock(
          serverContext.serverApp.db,
          getChainName(),
          currentBlock,
        )
        testLogger.info(`Set lastProcessedBlock to ${currentBlock}`)

        // Deploy factory
        testLogger.info("Deploying token factory...")
        const factoryAddress = await deployTokenFactory(blockchainContext)
        testLogger.info(`Factory deployed at ${factoryAddress}`)

        // Deploy two tokens via factory
        testLogger.info("Deploying first test token via factory...")
        const token1 = await deployTokenViaFactory(
          blockchainContext,
          factoryAddress,
          {
            name: "Token One",
            symbol: "TK1",
            initialSupply: 500000n * 10n ** 18n,
          },
        )

        testLogger.info("Deploying second test token via factory...")
        const token2 = await deployTokenViaFactory(
          blockchainContext,
          factoryAddress,
          {
            name: "Token Two",
            symbol: "TK2",
            initialSupply: 750000n * 10n ** 18n,
          },
        )

        await mineBlocks(blockchainContext, 1)
        testLogger.info("Token deployments completed")

        // Perform transfers on both tokens
        const recipient1 = blockchainContext.testnet
          .accounts[2] as `0x${string}`
        const recipient2 = blockchainContext.testnet
          .accounts[3] as `0x${string}`

        testLogger.info("Executing transfers on both tokens...")
        await transferERC20(
          blockchainContext,
          token1,
          recipient1,
          100n * 10n ** 18n,
        )
        await transferERC20(
          blockchainContext,
          token2,
          recipient2,
          200n * 10n ** 18n,
        )
        await mineBlocks(blockchainContext, 1)
        testLogger.info("Transfer transactions completed")

        // Run watchChain to process all events
        await runWatchChain()

        // Check notifications
        const userNotifications = await serverContext.serverApp.db
          .select()
          .from(notifications)
          .where(eq(notifications.userId, testUser.id))

        testLogger.info(
          `Found ${userNotifications.length} notifications for user ${testUser.id}`,
        )
        userNotifications.forEach((n, i) => {
          const data = n.data as any
          testLogger.info(
            `  Notification ${i + 1}: type=${data.type}, symbol=${data.tokenSymbol}`,
          )
        })

        // Should have at least 4 notifications (2 token creations + 2 token transfers)
        expect(userNotifications.length).toBeGreaterThanOrEqual(4)

        const creationNotifications = userNotifications.filter((n) => {
          const data = n.data as any
          return data.type === "token_created"
        })

        const transferNotifications = userNotifications.filter((n) => {
          const data = n.data as any
          return data.type === "token_transfer"
        })

        testLogger.info(
          `Notification breakdown: ${creationNotifications.length} creations, ${transferNotifications.length} transfers`,
        )

        expect(creationNotifications.length).toBe(2)
        expect(transferNotifications.length).toBe(2)

        const tokenSymbols = [
          ...creationNotifications.map((n) => (n.data as any).tokenSymbol),
          ...transferNotifications.map((n) => (n.data as any).tokenSymbol),
        ]

        expect(tokenSymbols).toContain("TK1")
        expect(tokenSymbols).toContain("TK2")
      },
      { timeout: 15000 },
    )

    test("should handle blockchain job scheduling gracefully", async () => {
      const watchJob = await scheduleJob(serverContext.serverApp, {
        tag: "test:graceful-watchchain",
        type: "watchChain",
        userId: 0,
        data: {},
      })

      expect(watchJob.id).toBeGreaterThan(0)
      expect(watchJob.type).toBe("watchChain")
      expect(watchJob.userId).toBe(0)

      testLogger.info(`Successfully scheduled watchChain job ${watchJob.id}`)
    })

    test("should handle deployMulticall3 job scheduling", async () => {
      const deployJob = await scheduleJob(serverContext.serverApp, {
        tag: "test:deploy-multicall3",
        type: "deployMulticall3",
        userId: 0,
        data: { forceRedeploy: false },
      })

      expect(deployJob.id).toBeGreaterThan(0)
      expect(deployJob.type).toBe("deployMulticall3")
      expect(deployJob.userId).toBe(0)
      expect(deployJob.data).toMatchObject({ forceRedeploy: false })

      testLogger.info(
        `Successfully scheduled deployMulticall3 job ${deployJob.id}`,
      )
    })
  })
})
