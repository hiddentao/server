import type { AbiEvent } from "viem"
import type { WorkerJob } from "../../db/schema"
import type { Logger } from "../../lib/logger"
import type { ServerApp } from "../../types"

export interface JobParams {
  serverApp: ServerApp
  log: Logger
  job: WorkerJob
}

export type JobRunner = (params: JobParams) => Promise<any>

export interface Job {
  run: JobRunner
}

// Chain log module types for blockchain monitoring (getLogs-based approach)
export interface ChainLogModule {
  getEvent: () => AbiEvent
  getContractAddress: () => `0x${string}` | null
  processLogs: (serverApp: ServerApp, log: Logger, logs: any[]) => Promise<void>
}

// Job data types for type safety
export interface RemoveOldWorkerJobsData {
  // No specific data needed for this job
}

export interface WatchChainData {
  // No specific data needed for this job
}

export interface DeployMulticall3Data {
  forceRedeploy?: boolean
}

export interface GenerateWaveformData {
  postId: number
  audioKey: string
}

// Discriminated union for job types
export type JobType =
  | "removeOldWorkerJobs"
  | "watchChain"
  | "deployMulticall3"
  | "generateWaveform"

// Type-safe job configurations
export type JobConfig<T extends JobType> = T extends "removeOldWorkerJobs"
  ? { type: T; data?: RemoveOldWorkerJobsData }
  : T extends "watchChain"
    ? { type: T; data?: WatchChainData }
    : T extends "deployMulticall3"
      ? { type: T; data?: DeployMulticall3Data }
      : T extends "generateWaveform"
        ? { type: T; data: GenerateWaveformData }
        : never

// Helper type to extract job data type from job type
export type JobDataType<T extends JobType> = T extends "removeOldWorkerJobs"
  ? RemoveOldWorkerJobsData
  : T extends "watchChain"
    ? WatchChainData
    : T extends "deployMulticall3"
      ? DeployMulticall3Data
      : T extends "generateWaveform"
        ? GenerateWaveformData
        : never

// Type guard for job types
export const isValidJobType = (type: string): type is JobType => {
  return (
    type === "removeOldWorkerJobs" ||
    type === "watchChain" ||
    type === "deployMulticall3" ||
    type === "generateWaveform"
  )
}

// Job registry type
export type JobRegistry = Record<JobType, Job>

// Chain log module registry type
export type ChainLogRegistry = Record<string, ChainLogModule>
