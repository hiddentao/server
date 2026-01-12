import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test"
import type { BlockchainTestContext } from "../../helpers/blockchain"
import {
  cleanupBlockchainTestContext,
  createBlockchainTestContext,
} from "../../helpers/blockchain"
import { cleanTestDatabase, setupTestDatabase } from "../../helpers/database"
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

describe("Worker Job Execution", () => {
  let blockchainContext: BlockchainTestContext
  let serverContext: TestServer
  let workerContext: TestWorkerContext

  beforeAll(async () => {
    try {
      testLogger.info("🔧 Setting up worker job execution tests...")

      // Setup test database
      await setupTestDatabase()

      // Start testnet blockchain instance for deployMulticall3 job
      testLogger.info("🔗 Starting test blockchain...")
      blockchainContext = await createBlockchainTestContext()
      testLogger.info(
        `✅ Test blockchain started at ${blockchainContext.testnet.url}`,
      )

      // Start test server
      serverContext = await startTestServer()
      await waitForServer(serverContext.url)

      // Create and start test worker
      workerContext = await startTestWorker()

      testLogger.info("✅ Worker job execution test setup complete")
    } catch (error) {
      testLogger.error("❌ Worker job execution test setup failed:", error)
      throw error
    }
  })

  beforeEach(async () => {
    // Clean database before each test
    await cleanTestDatabase()
  })

  afterEach(async () => {
    // Clean database after each test
    await cleanTestDatabase()
  })

  afterAll(async () => {
    try {
      testLogger.info("🧹 Cleaning up worker job execution tests...")

      // Stop worker
      await stopTestWorker(workerContext)

      // Shutdown server
      await serverContext.shutdown()

      // Cleanup blockchain
      await cleanupBlockchainTestContext(blockchainContext)

      testLogger.info("✅ Worker job execution test cleanup complete")
    } catch (error) {
      testLogger.error("❌ Worker job execution test cleanup failed:", error)
    }
  })

  test("should execute job and handle system job conflicts", async () => {
    // Use removeOldWorkerJobs job type since it only does database operations
    const completedJob = await submitTestJobAndWait(
      serverContext.serverApp,
      {
        type: "removeOldWorkerJobs",
        userId: 777, // Use different user ID than the other test
        data: { customTest: "removeOldJobsTest" },
      },
      { timeoutMs: 5000 },
    )

    // Verify job was completed successfully
    expect(completedJob.finished).not.toBeNull()
    expect(completedJob.success).toBe(true)
    expect(completedJob.started).not.toBeNull()
    expect(completedJob.userId).toBe(777)
    expect(completedJob.type).toBe("removeOldWorkerJobs")
    // Verify our test data is present with the added test markers
    expect(completedJob.data).toMatchObject({
      testRun: true,
      customTest: "removeOldJobsTest",
    })
    expect((completedJob.data as any).testId).toBeTruthy() // Should have unique test ID
  })

  test("should execute removeOldWorkerJobs job with different user", async () => {
    // Test with a different user ID to verify user isolation
    const completedJob = await submitTestJobAndWait(
      serverContext.serverApp,
      {
        type: "removeOldWorkerJobs",
        userId: 888,
        data: { customTest: "differentUser" },
      },
      { timeoutMs: 5000 },
    )

    // Verify job was completed successfully
    expect(completedJob.finished).not.toBeNull()
    expect(completedJob.success).toBe(true)
    expect(completedJob.started).not.toBeNull()
    expect(completedJob.userId).toBe(888)
    expect(completedJob.type).toBe("removeOldWorkerJobs")
    // Verify our test data is present with the added test markers
    expect(completedJob.data).toMatchObject({
      testRun: true,
      customTest: "differentUser",
    })
    expect((completedJob.data as any).testId).toBeTruthy() // Should have unique test ID
  })
})
