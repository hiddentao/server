import { removeOldJobs } from "../../db/worker"
import type { JobParams, JobRunner } from "./types"

export const run: JobRunner = async (params: JobParams) => {
  const { serverApp, job } = params

  // Remove old jobs, excluding the current job to prevent self-deletion
  await removeOldJobs(serverApp, { exclude: [job.id] })
}

export const removeOldWorkerJobsJob = {
  run,
}
