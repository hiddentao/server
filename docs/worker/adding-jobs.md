# Adding Jobs

To add a custom job type, create a job file, define its data type, and register it in the job registry.

## Create the Job File

Jobs are defined in [`src/server/workers/jobs/`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/workers/jobs/). Each job exports a `Job` object with a `run` function:

```typescript
// src/server/workers/jobs/myCustomJob.ts
import type { Job, JobParams } from "./types"

export const myCustomJob: Job = {
  async run({ serverApp, log, job }: JobParams) {
    log.info("Starting custom job", { jobId: job.id })

    // Access database
    const users = await serverApp.db.select().from(users)

    // Access blockchain clients (when Web3 enabled)
    if (serverApp.publicClient) {
      const balance = await serverApp.publicClient.getBalance({ address })
    }

    // Create notifications
    await serverApp.createNotification(job.userId, {
      type: "job_completed",
      message: "Your job finished"
    })

    log.info("Job completed", { jobId: job.id })
  }
}
```

The `JobParams` object provides:
- `serverApp` — Full access to database, blockchain clients, notifications
- `log` — Logger scoped to this job execution
- `job` — The job record including `id`, `type`, `data`, `userId`

## Define Data Types

Add your job's data type in [`src/server/workers/jobs/types.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/workers/jobs/types.ts):

```typescript
export interface MyCustomJobData {
  targetUserId: number
  action: string
}

export type JobType =
  | "removeOldWorkerJobs"
  | "watchChain"
  | "deployMulticall3"
  | "myCustomJob"  // Add your type
```

## Register the Job

Add your job to the [`jobRegistry`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/workers/jobs/registry.ts):

```typescript
import { myCustomJob } from "./myCustomJob"

export const jobRegistry: JobRegistry = {
  removeOldWorkerJobs: removeOldWorkerJobsJob,
  watchChain: watchChainJob,
  deployMulticall3: deployMulticall3Job,
  myCustomJob: myCustomJob,
}
```

## Submit Jobs

Once registered, submit jobs from anywhere with `ServerApp` access:

```typescript
await serverApp.workerManager.submitJob({
  tag: "process-user-42",
  type: "myCustomJob",
  userId: currentUser.id,
  data: { targetUserId: 42, action: "sync" }
})
```

## Best Practices

**Idempotency**: Design jobs to be safely re-runnable. If a job fails mid-execution and restarts, it should handle duplicate processing gracefully.

**Logging**: Use the provided `log` parameter for structured logging. Include the `jobId` in log entries for tracing.

**Error Handling**: Let errors bubble up—the worker system handles retries based on job configuration. Log errors before throwing for debugging.

**Duration**: Keep jobs under 5 minutes. For longer work, break into multiple jobs or use progress tracking.

**Database Transactions**: Use `withTransaction` for operations that need atomicity. The transaction wrapper handles serialization conflicts automatically.
