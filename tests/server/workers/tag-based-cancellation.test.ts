import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test"
import { eq, inArray } from "drizzle-orm"
import { workerJobs } from "../../../src/server/db/schema"
import {
  rescheduleCronJob,
  rescheduleFailedJob,
  scheduleCronJob,
  scheduleJob,
} from "../../../src/server/db/worker"
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
import "../../setup"

describe("Tag-Based Job Cancellation", () => {
  let blockchainContext: BlockchainTestContext
  let serverContext: TestServer
  let workerContext: TestWorkerContext

  beforeAll(async () => {
    try {
      testLogger.info("🔧 Setting up tag-based cancellation tests...")

      await setupTestDatabase()

      testLogger.info("🔗 Starting test blockchain...")
      blockchainContext = await createBlockchainTestContext()
      testLogger.info(
        `✅ Test blockchain started at ${blockchainContext.testnet.url}`,
      )

      serverContext = await startTestServer()
      await waitForServer(serverContext.url)

      workerContext = await startTestWorker()

      testLogger.info("✅ Tag-based cancellation test setup complete")
    } catch (error) {
      testLogger.error("❌ Tag-based cancellation test setup failed:", error)
      throw error
    }
  })

  beforeEach(async () => {
    await cleanTestDatabase()
  })

  afterEach(async () => {
    await cleanTestDatabase()
  })

  afterAll(async () => {
    try {
      testLogger.info("🧹 Cleaning up tag-based cancellation tests...")

      await stopTestWorker(workerContext)
      await serverContext.shutdown()
      await cleanupBlockchainTestContext(blockchainContext)

      testLogger.info("✅ Tag-based cancellation test cleanup complete")
    } catch (error) {
      testLogger.error("❌ Tag-based cancellation test cleanup failed:", error)
    }
  })

  describe("Basic Tag Cancellation", () => {
    test("scheduling a job with same tag cancels previous pending job", async () => {
      const tag = "test-cancellation-basic"

      const job1 = await scheduleJob(serverContext.serverApp, {
        tag,
        type: "removeOldWorkerJobs",
        userId: 1,
      })

      const job2 = await scheduleJob(serverContext.serverApp, {
        tag,
        type: "removeOldWorkerJobs",
        userId: 1,
      })

      const allJobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.tag, tag))

      expect(allJobs).toHaveLength(2)

      const cancelledJob = allJobs.find((j) => j.id === job1.id)
      expect(cancelledJob!.finished).not.toBeNull()
      expect(cancelledJob!.success).toBe(false)
      expect(cancelledJob!.result).toMatchObject({
        error: "Job cancelled due to new job being created",
      })

      const pendingJob = allJobs.find((j) => j.id === job2.id)
      expect(pendingJob!.finished).toBeNull()
      expect(pendingJob!.success).toBeNull()
    })

    test("scheduling jobs with different tags does not cancel anything", async () => {
      const _job1 = await scheduleJob(serverContext.serverApp, {
        tag: "tag-alpha",
        type: "removeOldWorkerJobs",
        userId: 1,
      })

      const _job2 = await scheduleJob(serverContext.serverApp, {
        tag: "tag-beta",
        type: "removeOldWorkerJobs",
        userId: 1,
      })

      const _job3 = await scheduleJob(serverContext.serverApp, {
        tag: "tag-gamma",
        type: "removeOldWorkerJobs",
        userId: 1,
      })

      const allJobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.userId, 1))

      expect(allJobs).toHaveLength(3)
      expect(allJobs.every((j) => j.finished === null)).toBe(true)
      expect(allJobs.every((j) => j.success === null)).toBe(true)
    })

    test("multiple pending jobs with same tag are all cancelled", async () => {
      const tag = "multi-cancel-test"

      // Directly insert multiple pending jobs without triggering cancellation
      const jobs = await Promise.all([
        serverContext.serverApp.db
          .insert(workerJobs)
          .values({
            tag,
            type: "removeOldWorkerJobs",
            userId: 1,
            data: {},
            due: new Date(),
            removeAt: new Date(Date.now() + 3600000),
          })
          .returning(),
        serverContext.serverApp.db
          .insert(workerJobs)
          .values({
            tag,
            type: "removeOldWorkerJobs",
            userId: 2,
            data: {},
            due: new Date(),
            removeAt: new Date(Date.now() + 3600000),
          })
          .returning(),
        serverContext.serverApp.db
          .insert(workerJobs)
          .values({
            tag,
            type: "removeOldWorkerJobs",
            userId: 3,
            data: {},
            due: new Date(),
            removeAt: new Date(Date.now() + 3600000),
          })
          .returning(),
      ])

      const jobIds = jobs.map((r) => r[0]!.id)

      // Now schedule a new job with same tag - should cancel all 3
      const newJob = await scheduleJob(serverContext.serverApp, {
        tag,
        type: "removeOldWorkerJobs",
        userId: 4,
      })

      const allJobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.tag, tag))

      expect(allJobs).toHaveLength(4)

      // All original jobs should be cancelled
      const cancelledJobs = allJobs.filter((j) => jobIds.includes(j.id))
      expect(cancelledJobs).toHaveLength(3)
      expect(cancelledJobs.every((j) => j.success === false)).toBe(true)
      expect(cancelledJobs.every((j) => j.finished !== null)).toBe(true)

      // New job should be pending
      const pendingJob = allJobs.find((j) => j.id === newJob.id)
      expect(pendingJob!.finished).toBeNull()
    })
  })

  describe("Tag Independence from Type and UserId", () => {
    test("same type different tags - no cancellation", async () => {
      const tag1 = "watchchain-100"
      const tag2 = "watchchain-200"

      const _job1 = await scheduleJob(serverContext.serverApp, {
        tag: tag1,
        type: "watchChain",
        userId: 1,
      })

      const _job2 = await scheduleJob(serverContext.serverApp, {
        tag: tag2,
        type: "watchChain",
        userId: 1,
      })

      const allJobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(inArray(workerJobs.tag, [tag1, tag2]))

      expect(allJobs).toHaveLength(2)
      expect(allJobs.every((j) => j.finished === null)).toBe(true)
    })

    test("different types same tag - still cancels (tag is the sole criterion)", async () => {
      const tag = "shared-tag"

      const job1 = await scheduleJob(serverContext.serverApp, {
        tag,
        type: "removeOldWorkerJobs",
        userId: 1,
      })

      const job2 = await scheduleJob(serverContext.serverApp, {
        tag,
        type: "watchChain",
        userId: 2,
      })

      const allJobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.tag, tag))

      expect(allJobs).toHaveLength(2)

      const cancelledJob = allJobs.find((j) => j.id === job1.id)
      expect(cancelledJob!.success).toBe(false)

      const pendingJob = allJobs.find((j) => j.id === job2.id)
      expect(pendingJob!.finished).toBeNull()
    })

    test("same user different tags - no cancellation", async () => {
      const _job1 = await scheduleJob(serverContext.serverApp, {
        tag: "user1-task-a",
        type: "removeOldWorkerJobs",
        userId: 1,
      })

      const _job2 = await scheduleJob(serverContext.serverApp, {
        tag: "user1-task-b",
        type: "removeOldWorkerJobs",
        userId: 1,
      })

      const allJobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.userId, 1))

      expect(allJobs).toHaveLength(2)
      expect(allJobs.every((j) => j.finished === null)).toBe(true)
    })

    test("different users same tag - still cancels", async () => {
      const tag = "cross-user-tag"

      const job1 = await scheduleJob(serverContext.serverApp, {
        tag,
        type: "removeOldWorkerJobs",
        userId: 100,
      })

      const _job2 = await scheduleJob(serverContext.serverApp, {
        tag,
        type: "removeOldWorkerJobs",
        userId: 200,
      })

      const allJobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.tag, tag))

      expect(allJobs).toHaveLength(2)

      const cancelledJob = allJobs.find((j) => j.id === job1.id)
      expect(cancelledJob!.success).toBe(false)
    })
  })

  describe("Cron Job Tag Handling", () => {
    test("cron jobs with same tag cancel each other", async () => {
      const cronSchedule = "*/10 * * * * *"
      const tag = `cron:removeOldWorkerJobs:${cronSchedule}`

      const cronJob1 = await scheduleCronJob(
        serverContext.serverApp,
        { tag, type: "removeOldWorkerJobs", userId: 0 },
        cronSchedule,
      )

      const cronJob2 = await scheduleCronJob(
        serverContext.serverApp,
        { tag, type: "removeOldWorkerJobs", userId: 0 },
        cronSchedule,
      )

      const allJobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.tag, tag))

      expect(allJobs).toHaveLength(2)

      const cancelled = allJobs.find((j) => j.id === cronJob1.id)
      expect(cancelled!.success).toBe(false)

      const pending = allJobs.find((j) => j.id === cronJob2.id)
      expect(pending!.finished).toBeNull()
    })

    test("cron jobs with different schedules (different tags) do not cancel each other", async () => {
      const schedule1 = "*/5 * * * * *"
      const schedule2 = "*/15 * * * * *"
      const tag1 = `cron:removeOldWorkerJobs:${schedule1}`
      const tag2 = `cron:removeOldWorkerJobs:${schedule2}`

      const _cronJob1 = await scheduleCronJob(
        serverContext.serverApp,
        { tag: tag1, type: "removeOldWorkerJobs", userId: 0 },
        schedule1,
      )

      const _cronJob2 = await scheduleCronJob(
        serverContext.serverApp,
        { tag: tag2, type: "removeOldWorkerJobs", userId: 0 },
        schedule2,
      )

      const allJobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.userId, 0))

      expect(allJobs).toHaveLength(2)
      expect(allJobs.every((j) => j.finished === null)).toBe(true)
    })

    test("one-time job and cron job with different tags do not affect each other", async () => {
      const oneTimeTag = "one-time-cleanup"
      const cronSchedule = "0 * * * * *"
      const cronTag = `cron:removeOldWorkerJobs:${cronSchedule}`

      const oneTimeJob = await scheduleJob(serverContext.serverApp, {
        tag: oneTimeTag,
        type: "removeOldWorkerJobs",
        userId: 1,
      })

      const cronJob = await scheduleCronJob(
        serverContext.serverApp,
        { tag: cronTag, type: "removeOldWorkerJobs", userId: 0 },
        cronSchedule,
      )

      const allJobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(inArray(workerJobs.id, [oneTimeJob.id, cronJob.id]))

      expect(allJobs).toHaveLength(2)
      expect(allJobs.every((j) => j.finished === null)).toBe(true)
    })
  })

  describe("Rescheduling Preserves Tags", () => {
    test("rescheduleCronJob preserves tag", async () => {
      const cronSchedule = "*/30 * * * * *"
      const tag = `cron:removeOldWorkerJobs:${cronSchedule}`

      const originalJob = await scheduleCronJob(
        serverContext.serverApp,
        { tag, type: "removeOldWorkerJobs", userId: 0 },
        cronSchedule,
      )

      const rescheduledJob = await rescheduleCronJob(
        serverContext.serverApp,
        originalJob,
      )

      expect(rescheduledJob.tag).toBe(tag)
      expect(rescheduledJob.rescheduledFromJob).toBe(originalJob.id)

      // Original should be cancelled
      const jobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.tag, tag))

      const original = jobs.find((j) => j.id === originalJob.id)
      expect(original!.success).toBe(false)

      const rescheduled = jobs.find((j) => j.id === rescheduledJob.id)
      expect(rescheduled!.finished).toBeNull()
    })

    test("rescheduleFailedJob preserves tag", async () => {
      const tag = "failed-job-reschedule-test"

      const originalJob = await scheduleJob(serverContext.serverApp, {
        tag,
        type: "removeOldWorkerJobs",
        userId: 1,
        autoRescheduleOnFailure: true,
        autoRescheduleOnFailureDelay: 1000,
      })

      const rescheduledJob = await rescheduleFailedJob(
        serverContext.serverApp,
        originalJob,
      )

      expect(rescheduledJob.tag).toBe(tag)
      expect(rescheduledJob.rescheduledFromJob).toBe(originalJob.id)

      // Original should be cancelled
      const jobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.tag, tag))

      const original = jobs.find((j) => j.id === originalJob.id)
      expect(original!.success).toBe(false)

      const rescheduled = jobs.find((j) => j.id === rescheduledJob.id)
      expect(rescheduled!.finished).toBeNull()
    })
  })

  describe("Edge Cases", () => {
    test("tag with special characters works correctly", async () => {
      const tag = "test:tag/with-special_chars.and:colons"

      const job1 = await scheduleJob(serverContext.serverApp, {
        tag,
        type: "removeOldWorkerJobs",
        userId: 1,
      })

      const job2 = await scheduleJob(serverContext.serverApp, {
        tag,
        type: "removeOldWorkerJobs",
        userId: 1,
      })

      const jobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.tag, tag))

      expect(jobs).toHaveLength(2)
      expect(jobs.find((j) => j.id === job1.id)!.success).toBe(false)
      expect(jobs.find((j) => j.id === job2.id)!.finished).toBeNull()
    })

    test("short tags are stored correctly", async () => {
      const tag1 = "a"
      const tag2 = "b"

      const job1 = await scheduleJob(serverContext.serverApp, {
        tag: tag1,
        type: "removeOldWorkerJobs",
        userId: 1,
      })

      const job2 = await scheduleJob(serverContext.serverApp, {
        tag: tag2,
        type: "removeOldWorkerJobs",
        userId: 1,
      })

      expect(job1.tag).toBe(tag1)
      expect(job2.tag).toBe(tag2)

      const allJobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.userId, 1))

      expect(allJobs).toHaveLength(2)
      expect(allJobs.every((j) => j.finished === null)).toBe(true)
    })

    test("only pending jobs are cancelled, not completed ones", async () => {
      const tag = "pending-only-test"

      // Create first job and mark as completed
      const completedJob = await scheduleJob(serverContext.serverApp, {
        tag,
        type: "removeOldWorkerJobs",
        userId: 1,
      })

      await serverContext.serverApp.db
        .update(workerJobs)
        .set({
          started: new Date(),
          finished: new Date(),
          success: true,
        })
        .where(eq(workerJobs.id, completedJob.id))

      // Create second pending job
      const pendingJob = await scheduleJob(serverContext.serverApp, {
        tag,
        type: "removeOldWorkerJobs",
        userId: 2,
      })

      // Third job should only cancel the pending one, not the completed one
      const thirdJob = await scheduleJob(serverContext.serverApp, {
        tag,
        type: "removeOldWorkerJobs",
        userId: 3,
      })

      const allJobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.tag, tag))

      expect(allJobs).toHaveLength(3)

      // Completed job should still be success=true
      const completed = allJobs.find((j) => j.id === completedJob.id)
      expect(completed!.success).toBe(true)

      // Previously pending job should now be cancelled
      const cancelled = allJobs.find((j) => j.id === pendingJob.id)
      expect(cancelled!.success).toBe(false)

      // New job should be pending
      const pending = allJobs.find((j) => j.id === thirdJob.id)
      expect(pending!.finished).toBeNull()
    })
  })

  describe("Real-World Tag Patterns", () => {
    test("watchChain pattern: multiple jobs for different contexts", async () => {
      // Simulate multiple chain watching jobs with unique tags
      const _context1Job = await scheduleJob(serverContext.serverApp, {
        tag: "watchchain-filter-100",
        type: "watchChain",
        userId: 1,
        data: { filterId: 100 },
      })

      const _context2Job = await scheduleJob(serverContext.serverApp, {
        tag: "watchchain-filter-200",
        type: "watchChain",
        userId: 1,
        data: { filterId: 200 },
      })

      const _context3Job = await scheduleJob(serverContext.serverApp, {
        tag: "watchchain-filter-300",
        type: "watchChain",
        userId: 2,
        data: { filterId: 300 },
      })

      // All should be pending since they have different tags
      const allJobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.type, "watchChain"))

      expect(allJobs).toHaveLength(3)
      expect(allJobs.every((j) => j.finished === null)).toBe(true)
    })

    test("watchChain pattern: resubmit replaces previous pending job", async () => {
      const filterId = 999

      // Submit job
      const firstAttempt = await scheduleJob(serverContext.serverApp, {
        tag: `watchchain-filter-${filterId}`,
        type: "watchChain",
        userId: 1,
        data: { filterId },
      })

      // Resubmit (e.g., due to error recovery)
      const secondAttempt = await scheduleJob(serverContext.serverApp, {
        tag: `watchchain-filter-${filterId}`,
        type: "watchChain",
        userId: 1,
        data: { filterId },
      })

      const jobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.tag, `watchchain-filter-${filterId}`))

      expect(jobs).toHaveLength(2)

      const first = jobs.find((j) => j.id === firstAttempt.id)
      expect(first!.success).toBe(false) // cancelled

      const second = jobs.find((j) => j.id === secondAttempt.id)
      expect(second!.finished).toBeNull() // pending
    })

    test("deployMulticall3 pattern: unique tag per deployment", async () => {
      const _deploy1 = await scheduleJob(serverContext.serverApp, {
        tag: "deploy-multicall3-chain-1",
        type: "deployMulticall3",
        userId: 0,
        data: { forceRedeploy: false },
      })

      const _deploy2 = await scheduleJob(serverContext.serverApp, {
        tag: "deploy-multicall3-chain-2",
        type: "deployMulticall3",
        userId: 0,
        data: { forceRedeploy: false },
      })

      // Both should be pending
      const allJobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.type, "deployMulticall3"))

      expect(allJobs).toHaveLength(2)
      expect(allJobs.every((j) => j.finished === null)).toBe(true)
    })

    test("cleanup pattern: system-wide cron tags", async () => {
      const cronTag = "cron:removeOldWorkerJobs"

      // First cron job
      const cron1 = await scheduleCronJob(
        serverContext.serverApp,
        { tag: cronTag, type: "removeOldWorkerJobs", userId: 0 },
        "0 0 * * * *",
      )

      // Reschedule with same tag (simulating cron restart)
      const cron2 = await scheduleCronJob(
        serverContext.serverApp,
        { tag: cronTag, type: "removeOldWorkerJobs", userId: 0 },
        "0 0 * * * *",
      )

      const jobs = await serverContext.serverApp.db
        .select()
        .from(workerJobs)
        .where(eq(workerJobs.tag, cronTag))

      expect(jobs).toHaveLength(2)

      // First should be cancelled
      const first = jobs.find((j) => j.id === cron1.id)
      expect(first!.success).toBe(false)

      // Second should be pending
      const second = jobs.find((j) => j.id === cron2.id)
      expect(second!.finished).toBeNull()
    })
  })
})
