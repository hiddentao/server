# Background Jobs

This page covers the internal implementation of the worker system. For adding custom jobs, see [Adding Jobs](./adding-jobs.md).

## Job Storage

Jobs are stored in the [`workerJobs`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/db/schema.ts) table with these key fields:

| Field | Purpose |
|-------|---------|
| `tag` | Identifier for logging and debugging |
| `type` | Job type name matching the registry |
| `userId` | Associated user (0 for system jobs) |
| `data` | JSON payload passed to the job runner |
| `due` | When the job should run |
| `started` | When execution began |
| `finished` | When execution completed |
| `success` | Whether the job succeeded |
| `result` | Return value from the job runner |
| `cronSchedule` | Cron expression for recurring jobs |
| `persistent` | Whether job survives server restarts |
| `autoRescheduleOnFailure` | Retry on failure |
| `autoRescheduleOnFailureDelay` | Seconds to wait before retry |
| `removeDelay` | Seconds to keep completed job |

## Worker Process

Each worker runs as a forked child process with its own `ServerApp` instance. The [`start-worker.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/start-worker.ts) entry point handles:

1. Creating a `ServerApp` without the `WorkerManager` (to avoid recursive spawning)
2. Connecting to the database with a smaller connection pool
3. Starting the job polling loop
4. Graceful shutdown on SIGTERM

Workers poll the database every second for jobs where `due <= now` and `started IS NULL`. They use `FOR UPDATE SKIP LOCKED` to claim jobs without blocking other workers.

## IPC Communication

Workers communicate with the main server through Node.js IPC. Message types are defined in [`ipc-types.ts`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/workers/ipc-types.ts):

- `WorkerStarted` — Worker process initialized
- `WorkerShutdown` — Worker shutting down
- `WorkerError` — Unhandled error in worker
- `Heartbeat` — Keep-alive signal
- `SendToUser` — Route WebSocket message to specific user
- `Broadcast` — Send WebSocket message to all connected clients

When a job needs to send a real-time notification, it uses [`serverApp.createNotification()`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/bootstrap.ts) which saves to the database and sends an IPC message. The main server receives this and routes it through the `SocketManager`.

## Cron Scheduling

Jobs with a `cronSchedule` field automatically reschedule after completion. The schedule uses standard cron syntax:

```
┌───────────── second (0-59)
│ ┌───────────── minute (0-59)
│ │ ┌───────────── hour (0-23)
│ │ │ ┌───────────── day of month (1-31)
│ │ │ │ ┌───────────── month (1-12)
│ │ │ │ │ ┌───────────── day of week (0-6)
│ │ │ │ │ │
* * * * * *
```

The [`removeOldWorkerJobs`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/workers/jobs/removeOldWorkerJobs.ts) job runs hourly. The [`watchChain`](https://github.com/QuickDapp/QuickDapp/blob/main/src/server/workers/jobs/watchChain.ts) job runs every few seconds when Web3 is enabled.

## Error Handling

When a job throws an error:

1. The `finished` timestamp and `success = false` are recorded
2. If `autoRescheduleOnFailure` is true, a new job is scheduled after the configured delay
3. The error is logged with the job context

Jobs don't retry infinitely—the rescheduled job is a new record. The original failed job remains for debugging until the cleanup job removes it.

## Monitoring

Job execution is logged with structured data including job ID, type, duration, and result. Enable debug logging with `WORKER_LOG_LEVEL=debug` for detailed execution traces.

The `workerJobs` table serves as both queue and audit log. Query it to check pending jobs, recent failures, or execution patterns.
