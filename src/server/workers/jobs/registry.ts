import { generateWaveformJob } from "./generateWaveform"
import { removeOldWorkerJobsJob } from "./removeOldWorkerJobs"
import type { JobRegistry } from "./types"

// Job registry containing all available jobs
export const jobRegistry: JobRegistry = {
  removeOldWorkerJobs: removeOldWorkerJobsJob,
  generateWaveform: generateWaveformJob,
}

// Export individual job objects (avoiding conflicts from multiple 'run' exports)
export { generateWaveformJob } from "./generateWaveform"
export { removeOldWorkerJobsJob } from "./removeOldWorkerJobs"
