import { deleteMediaV2Job, listRecoverableMediaV2Jobs, patchMediaV2Job, type MediaV2UploadJob } from './jobStore'
import { deleteMediaV2Stage, hasMediaV2Stage } from './staging'

export type MediaV2RecoveryCandidate = {
  job: MediaV2UploadJob
  sourceAvailable: boolean
  needsReselection: boolean
}

export async function inspectMediaV2Recovery(): Promise<MediaV2RecoveryCandidate[]> {
  const jobs = await listRecoverableMediaV2Jobs()
  return Promise.all(jobs.map(async (job) => {
    const sourceAvailable = await hasMediaV2Stage(job.stagePath)
    return { job, sourceAvailable, needsReselection: !sourceAvailable }
  }))
}

export async function markMediaV2JobRecoverableFailure(jobId: string, message: string) {
  return patchMediaV2Job(jobId, { state: 'failed_recoverable', lastError: message })
}

export async function cleanupMediaV2Job(job: MediaV2UploadJob) {
  await deleteMediaV2Stage(job.stagePath)
  await deleteMediaV2Job(job.id)
}
