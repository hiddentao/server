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

// Job data types for type safety
export interface RemoveOldWorkerJobsData {
  // No specific data needed for this job
}

export interface GenerateWaveformData {
  postId: number
  audioKey: string
}

// Discriminated union for job types
export type JobType = "removeOldWorkerJobs" | "generateWaveform"

// Type-safe job configurations
export type JobConfig<T extends JobType> = T extends "removeOldWorkerJobs"
  ? { type: T; data?: RemoveOldWorkerJobsData }
  : T extends "generateWaveform"
    ? { type: T; data: GenerateWaveformData }
    : never

// Helper type to extract job data type from job type
export type JobDataType<T extends JobType> = T extends "removeOldWorkerJobs"
  ? RemoveOldWorkerJobsData
  : T extends "generateWaveform"
    ? GenerateWaveformData
    : never

// Type guard for job types
export const isValidJobType = (type: string): type is JobType => {
  return type === "removeOldWorkerJobs" || type === "generateWaveform"
}

// Job registry type
export type JobRegistry = Record<JobType, Job>
