import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test"
import { eq } from "drizzle-orm"
import { workerJobs } from "../../../src/server/db/schema"
import { scheduleCronJob, scheduleJob } from "../../../src/server/db/worker"
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
import { startTestWorker, stopTestWorker } from "../../helpers/worker"
// Import global test setup
import "../../setup"

describe("Worker Job Scheduling", () => {
  let blockchainContext: BlockchainTestContext
  let serverContext: TestServer
  let workerContext: TestWorkerContext

  beforeAll(async () => {
    try {
      testLogger.info("🔧 Setting up worker job scheduling tests...")

      // Setup test database
      await setupTestDatabase()

      // Start testnet blockchain instance for deployMulticall3 job
      testLogger.info("🔗 Starting test blockchain...")
      blockchainContext = await createBlockchainTestContext()
      testLogger.info(
        `✅ Test blockchain started at ${blockchainContext.testnet.url}`,
      )

      // Start test server (worker count is 0 in test env)
      serverContext = await startTestServer()
      await waitForServer(serverContext.url)

      // Start separate test worker
      workerContext = await startTestWorker()

      testLogger.info("✅ Worker job scheduling test setup complete")
    } catch (error) {
      testLogger.error("❌ Worker job scheduling test setup failed:", error)
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
      testLogger.info("🧹 Cleaning up worker job scheduling tests...")

      // Stop test worker
      await stopTestWorker(workerContext)

      // Shutdown server
      await serverContext.shutdown()

      // Cleanup blockchain
      await cleanupBlockchainTestContext(blockchainContext)

      testLogger.info("✅ Worker job scheduling test cleanup complete")
    } catch (error) {
      testLogger.error("❌ Worker job scheduling test cleanup failed:", error)
    }
  })

  test("should schedule a job successfully", async () => {
    const jobConfig = {
      tag: "test-job-1",
      type: "removeOldWorkerJobs",
      userId: 1,
      data: { test: true },
    }

    const job = await scheduleJob(serverContext.serverApp, jobConfig)

    expect(job.id).toBeGreaterThan(0)
    expect(job.tag).toBe("test-job-1")
    expect(job.type).toBe("removeOldWorkerJobs")
    expect(job.userId).toBe(1)
    expect(job.data).toMatchObject({ test: true })
    expect(job.finished).toBeNull()
    expect(job.success).toBeNull()
  })

  test("should schedule a cron job successfully", async () => {
    const cronSchedule = "0 * * * * *"
    const jobConfig = {
      tag: `cron:removeOldWorkerJobs:${cronSchedule}`,
      type: "removeOldWorkerJobs",
      userId: 0,
    }

    const job = await scheduleCronJob(
      serverContext.serverApp,
      jobConfig,
      cronSchedule,
    )

    expect(job.id).toBeGreaterThan(0)
    expect(job.tag).toBe(`cron:removeOldWorkerJobs:${cronSchedule}`)
    expect(job.type).toBe("removeOldWorkerJobs")
    expect(job.cronSchedule).toBe(cronSchedule)
    expect(job.due).toBeInstanceOf(Date)
  })

  test("should use default removeDelay when not specified", async () => {
    const job = await scheduleJob(serverContext.serverApp, {
      tag: "test-remove-delay",
      type: "removeOldWorkerJobs",
      userId: 1,
    })

    // Verify removeAt is approximately due + ONE_HOUR
    const timeDiff = job.removeAt.getTime() - job.due.getTime()
    const ONE_HOUR = 60 * 60 * 1000

    expect(timeDiff).toBeGreaterThanOrEqual(ONE_HOUR - 1000)
    expect(timeDiff).toBeLessThanOrEqual(ONE_HOUR + 1000)
  })

  test("should cancel existing pending jobs with same tag when scheduling new job", async () => {
    const tag = "unique-tag-for-cancellation-test"

    // Schedule first job
    const job1 = await scheduleJob(serverContext.serverApp, {
      tag,
      type: "removeOldWorkerJobs",
      userId: 1,
    })

    // Schedule second job with same tag (this should cancel job1)
    const job2 = await scheduleJob(serverContext.serverApp, {
      tag,
      type: "removeOldWorkerJobs",
      userId: 1,
    })

    expect(job2.id).not.toBe(job1.id)

    // Both jobs should exist in database
    const allJobs = await serverContext.serverApp.db
      .select()
      .from(workerJobs)
      .where(eq(workerJobs.tag, tag))

    expect(allJobs).toHaveLength(2)

    // job1 should be cancelled
    const updatedJob1 = allJobs.find((j) => j.id === job1.id)
    expect(updatedJob1).toBeDefined()
    expect(updatedJob1!.finished).not.toBeNull()
    expect(updatedJob1!.success).toBe(false)

    // job2 should be pending
    const updatedJob2 = allJobs.find((j) => j.id === job2.id)
    expect(updatedJob2).toBeDefined()
    expect(updatedJob2!.finished).toBeNull()
  })

  test("should not cancel jobs with different tags", async () => {
    // Schedule first job with tag A
    const job1 = await scheduleJob(serverContext.serverApp, {
      tag: "tag-a",
      type: "removeOldWorkerJobs",
      userId: 1,
    })

    // Schedule second job with tag B (should NOT cancel job1)
    const job2 = await scheduleJob(serverContext.serverApp, {
      tag: "tag-b",
      type: "removeOldWorkerJobs",
      userId: 1,
    })

    // Both jobs should exist and be pending
    const allJobs = await serverContext.serverApp.db
      .select()
      .from(workerJobs)
      .where(eq(workerJobs.userId, 1))

    expect(allJobs).toHaveLength(2)

    // job1 should still be pending (different tag)
    const updatedJob1 = allJobs.find((j) => j.id === job1.id)
    expect(updatedJob1).toBeDefined()
    expect(updatedJob1!.finished).toBeNull()
    expect(updatedJob1!.success).toBeNull()

    // job2 should be pending
    const updatedJob2 = allJobs.find((j) => j.id === job2.id)
    expect(updatedJob2).toBeDefined()
    expect(updatedJob2!.finished).toBeNull()
  })

  test("jobs with same type but different tags should not cancel each other", async () => {
    // Schedule two jobs with same type but different tags
    await scheduleJob(serverContext.serverApp, {
      tag: "session-1",
      type: "watchChain",
      userId: 1,
    })

    await scheduleJob(serverContext.serverApp, {
      tag: "session-2",
      type: "watchChain",
      userId: 1,
    })

    // Both jobs should exist and be pending
    const allJobs = await serverContext.serverApp.db
      .select()
      .from(workerJobs)
      .where(eq(workerJobs.userId, 1))

    expect(allJobs).toHaveLength(2)

    // Both should be pending
    expect(allJobs.every((j) => j.finished === null)).toBe(true)
  })

  test("cron jobs with same tag should cancel each other", async () => {
    const cronSchedule = "0 * * * * *"
    const tag = `cron:removeOldWorkerJobs:${cronSchedule}`

    // Schedule first cron job
    const cronJob1 = await scheduleCronJob(
      serverContext.serverApp,
      {
        tag,
        type: "removeOldWorkerJobs",
        userId: 1,
      },
      cronSchedule,
    )

    // Schedule second cron job with same tag (should cancel cronJob1)
    const cronJob2 = await scheduleCronJob(
      serverContext.serverApp,
      {
        tag,
        type: "removeOldWorkerJobs",
        userId: 1,
      },
      cronSchedule,
    )

    // Both jobs should exist
    const allJobs = await serverContext.serverApp.db
      .select()
      .from(workerJobs)
      .where(eq(workerJobs.tag, tag))

    expect(allJobs).toHaveLength(2)

    // cronJob1 should be cancelled
    const updatedCronJob1 = allJobs.find((j) => j.id === cronJob1.id)
    expect(updatedCronJob1).toBeDefined()
    expect(updatedCronJob1!.finished).not.toBeNull()
    expect(updatedCronJob1!.success).toBe(false)

    // cronJob2 should be pending
    const updatedCronJob2 = allJobs.find((j) => j.id === cronJob2.id)
    expect(updatedCronJob2).toBeDefined()
    expect(updatedCronJob2!.finished).toBeNull()
  })

  test("cron jobs with different tags (different schedules) should not cancel each other", async () => {
    const scheduleA = "0 * * * * *"
    const scheduleB = "0 0 * * * *"
    const tagA = `cron:removeOldWorkerJobs:${scheduleA}`
    const tagB = `cron:removeOldWorkerJobs:${scheduleB}`

    // Schedule first cron job with schedule A
    const cronJobA = await scheduleCronJob(
      serverContext.serverApp,
      {
        tag: tagA,
        type: "removeOldWorkerJobs",
        userId: 1,
      },
      scheduleA,
    )

    // Schedule cron job with different schedule B
    const cronJobB = await scheduleCronJob(
      serverContext.serverApp,
      {
        tag: tagB,
        type: "removeOldWorkerJobs",
        userId: 1,
      },
      scheduleB,
    )

    // Both jobs should exist and be pending
    const allJobs = await serverContext.serverApp.db
      .select()
      .from(workerJobs)
      .where(eq(workerJobs.userId, 1))

    expect(allJobs).toHaveLength(2)

    // Both should be pending
    const updatedCronJobA = allJobs.find((j) => j.id === cronJobA.id)
    expect(updatedCronJobA).toBeDefined()
    expect(updatedCronJobA!.finished).toBeNull()

    const updatedCronJobB = allJobs.find((j) => j.id === cronJobB.id)
    expect(updatedCronJobB).toBeDefined()
    expect(updatedCronJobB!.finished).toBeNull()
  })

  test("one-time jobs and cron jobs with different tags do not affect each other", async () => {
    // Schedule a one-time job
    const _oneTimeJob = await scheduleJob(serverContext.serverApp, {
      tag: "one-time-job",
      type: "removeOldWorkerJobs",
      userId: 1,
    })

    // Schedule a cron job with different tag
    const cronSchedule = "0 * * * * *"
    const _cronJob = await scheduleCronJob(
      serverContext.serverApp,
      {
        tag: `cron:removeOldWorkerJobs:${cronSchedule}`,
        type: "removeOldWorkerJobs",
        userId: 1,
      },
      cronSchedule,
    )

    // Both jobs should exist and be pending
    const allJobs = await serverContext.serverApp.db
      .select()
      .from(workerJobs)
      .where(eq(workerJobs.userId, 1))

    expect(allJobs).toHaveLength(2)

    // Both should be pending
    expect(allJobs.every((j) => j.finished === null)).toBe(true)
  })
})
