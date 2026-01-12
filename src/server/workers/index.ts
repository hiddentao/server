import { type ChildProcess, fork } from "node:child_process"
import os from "node:os"
import path from "node:path"
import { serverConfig } from "../../shared/config/server"
import { scheduleJob } from "../db/worker"
import type { Logger } from "../lib/logger"
import { LOG_CATEGORIES } from "../lib/logger"
import type { ServerApp } from "../types"
import {
  type BroadcastMessage,
  type SendToUserMessage,
  type WorkerIPCMessage,
  WorkerIPCMessageType,
} from "./ipc-types"

export interface WorkerJob {
  tag: string
  type: string
  data: unknown
  userId: number
}

export interface WorkerManager {
  submitJob: (job: WorkerJob) => Promise<void>
  getWorkerCount: () => number
  shutdown: () => Promise<void>
}

class WorkerProcess {
  private process: ChildProcess | null = null
  private isShuttingDown = false
  private logger: Logger

  constructor(
    private workerId: number,
    private serverApp: ServerApp,
  ) {
    this.logger = serverApp.createLogger(`${LOG_CATEGORIES.WORKER}-${workerId}`)
  }

  start(): void {
    this.logger.debug(`Starting worker ${this.workerId}`)

    // Fork the server entry point to create a worker
    // In development: use the TypeScript file
    // In production: use the JavaScript file being executed
    const serverEntryPoint =
      serverConfig.NODE_ENV === "production"
        ? process.argv[1] || path.resolve(__dirname, "../index.js") // Use the script file, not the binary
        : path.resolve(__dirname, "../index.ts")

    this.process = fork(serverEntryPoint!, [], {
      env: {
        ...process.env,
        WORKER_ID: this.workerId.toString(),
      },
      silent: false,
    })

    this.process.on("exit", (code) => {
      if (!this.isShuttingDown) {
        this.logger.warn(`Worker ${this.workerId} exited with code ${code}`)
        // Auto-restart worker if it wasn't intentionally shut down
        setTimeout(() => this.start(), 1000)
      }
    })

    this.process.on("error", (error) => {
      this.logger.error(`Worker ${this.workerId} error:`, error)
    })

    this.process.on("message", (message: WorkerIPCMessage) => {
      switch (message.type) {
        case WorkerIPCMessageType.WorkerStarted:
          this.logger.info(
            `Worker ${this.workerId} started (PID: ${message.pid})`,
          )
          break
        case WorkerIPCMessageType.WorkerShutdown:
          this.logger.info(
            `Worker ${this.workerId} shutdown (PID: ${message.pid})`,
          )
          break
        case WorkerIPCMessageType.WorkerError:
          this.logger.error(`Worker ${this.workerId} error: ${message.error}`)
          break
        case WorkerIPCMessageType.Heartbeat:
          this.logger.debug(`Worker ${this.workerId} heartbeat`)
          break
        case WorkerIPCMessageType.SendToUser: {
          const sendToUserMsg = message as SendToUserMessage
          this.logger.debug(
            `Worker ${this.workerId} sending message to user ${sendToUserMsg.userId}`,
          )
          this.serverApp.socketManager.sendToUser(
            sendToUserMsg.userId,
            sendToUserMsg.message,
          )
          break
        }
        case WorkerIPCMessageType.Broadcast: {
          const broadcastMsg = message as BroadcastMessage
          this.logger.debug(`Worker ${this.workerId} broadcasting message`)
          this.serverApp.socketManager.broadcast(broadcastMsg.message)
          break
        }
        default:
          this.logger.warn(
            `Unknown message type from worker ${this.workerId}:`,
            message.type,
          )
      }
    })
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true
    if (this.process) {
      this.logger.debug(`Shutting down worker ${this.workerId}`)
      this.process.kill("SIGTERM")

      // Give the process time to shut down gracefully
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) {
            this.logger.warn(`Force killing worker ${this.workerId}`)
            this.process.kill("SIGKILL")
          }
          resolve()
        }, 5000)

        this.process?.on("exit", () => {
          clearTimeout(timeout)
          resolve()
        })
      })
    }
  }
}

export const createWorkerManager = async (
  serverApp: ServerApp,
  workerCountOverride?: number,
): Promise<WorkerManager> => {
  const logger = serverApp.createLogger(LOG_CATEGORIES.WORKER_MANAGER)
  const workerCount =
    workerCountOverride ??
    (serverConfig.WORKER_COUNT === "cpus"
      ? os.cpus().length
      : serverConfig.WORKER_COUNT)

  const workers: WorkerProcess[] = []

  // Initialize workers
  for (let i = 0; i < workerCount; i++) {
    const worker = new WorkerProcess(i + 1, serverApp)
    worker.start()
    workers.push(worker)
  }

  logger.info(`Initialized ${workerCount} worker processes`)

  // Create the WorkerManager instance first so we can use submitJob
  const workerManager = {
    submitJob: async (job: WorkerJob) => {
      logger.debug(`Scheduling job ${job.tag} of type ${job.type}`)
      await scheduleJob(serverApp, {
        tag: job.tag,
        type: job.type,
        userId: job.userId,
        data: job.data,
      })
      logger.debug(`Job ${job.tag} scheduled successfully`)
    },

    getWorkerCount: () => workers.length,

    shutdown: async () => {
      logger.info("Shutting down all workers...")
      await Promise.all(workers.map((worker) => worker.shutdown()))
      logger.info("All workers shut down")
    },
  }

  return workerManager
}
