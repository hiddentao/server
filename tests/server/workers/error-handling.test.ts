import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test"
import { and, eq } from "drizzle-orm"
import { workerJobs } from "../../../src/server/db/schema"
import { scheduleJob } from "../../../src/server/db/worker"
import type { BlockchainTestContext } from "../../helpers/blockchain"
import {
  cleanupBlockchainTestContext,
  createBlockchainTestContext,
} from "../../helpers/blockchain"
import { setupTestDatabase } from "../../helpers/database"
import { testLogger } from "../../helpers/logger"
import type { TestServer } from "../../helpers/server"
import { startTestServer, waitForServer } from "../../helpers/server"
import type { TestWorkerContext } from "../../helpers/worker"
import {
  createTestJobConfig,
  startTestWorker,
  stopTestWorker,
  waitForTestJobCompletion,
} from "../../helpers/worker"
// Import global test setup
import "../../setup"

describe("Worker Error Handling", () => {
  let blockchainContext: BlockchainTestContext
  let serverContext: TestServer
  let workerContext: TestWorkerContext

  beforeAll(async () => {
    try {
      testLogger.info("🔧 Setting up worker error handling tests...")

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

      testLogger.info("✅ Worker error handling test setup complete")
    } catch (error) {
      testLogger.error("❌ Worker error handling test setup failed:", error)
      throw error
    }
  })

  beforeEach(async () => {
    // No database cleaning needed - tests use different user IDs to avoid conflicts
  })

  afterEach(async () => {
    // No database cleaning needed - tests use different user IDs to avoid conflicts
  })

  afterAll(async () => {
    try {
      testLogger.info("🧹 Cleaning up worker error handling tests...")

      // Stop worker
      await stopTestWorker(workerContext)

      // Shutdown server
      await serverContext.shutdown()

      // Cleanup blockchain
      await cleanupBlockchainTestContext(blockchainContext)

      testLogger.info("✅ Worker error handling test cleanup complete")
    } catch (error) {
      testLogger.error("❌ Worker error handling test cleanup failed:", error)
    }
  })

  test("should handle job execution errors gracefully", async () => {
    // Schedule a job with invalid type using test job config
    const jobConfig = createTestJobConfig({
      type: "nonExistentJob" as any,
      userId: 999, // Use high user ID to avoid conflicts
      data: { customTest: "errorHandling" },
    })

    await scheduleJob(serverContext.serverApp, jobConfig)

    // Wait for the job to complete using robust helper
    const completedJob = await waitForTestJobCompletion(
      serverContext.serverApp,
      {
        type: "nonExistentJob",
        userId: 999,
        data: jobConfig.data,
      },
      { timeoutMs: 5000 },
    )

    // Verify the job was marked as failed
    expect(completedJob.finished).not.toBeNull()
    expect(completedJob.success).toBe(false)
    expect(completedJob.result).toMatchObject({
      error: expect.stringContaining("Unknown job type"),
    })
    // Verify our test data is present
    expect(completedJob.data).toMatchObject({
      testRun: true,
      customTest: "errorHandling",
    })
  })

  test("should reschedule failed jobs when configured", async () => {
    // Schedule a job that will fail with auto-reschedule enabled using test job config
    const jobConfig = createTestJobConfig({
      type: "nonExistentJob" as any,
      userId: 888, // Use different user ID from first test
      autoRescheduleOnFailure: true,
      autoRescheduleOnFailureDelay: 1000,
      data: { customTest: "rescheduleTest" },
    })

    await scheduleJob(serverContext.serverApp, jobConfig)

    // Wait for the original job to complete and fail using robust helper
    const failedJob = await waitForTestJobCompletion(
      serverContext.serverApp,
      {
        type: "nonExistentJob",
        userId: 888,
        data: jobConfig.data,
      },
      { timeoutMs: 5000 },
    )

    // Verify the original job failed
    expect(failedJob.success).toBe(false)
    expect(failedJob.finished).not.toBeNull()
    expect(failedJob.data).toMatchObject({
      testRun: true,
      customTest: "rescheduleTest",
    })

    // Wait a bit more for rescheduling to happen
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Check that a rescheduled job was created
    const allJobsForUser = await serverContext.serverApp.db
      .select()
      .from(workerJobs)
      .where(
        and(eq(workerJobs.type, "nonExistentJob"), eq(workerJobs.userId, 888)),
      )

    // Should have at least 2 jobs: the failed one and the rescheduled one
    expect(allJobsForUser.length).toBeGreaterThanOrEqual(2)
  })
})
