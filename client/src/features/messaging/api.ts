import { api } from '../../shared/api'

export type SubmitReportInput = { messageId: string; reason: string; details: string }

export function submitReport({ messageId, reason, details }: SubmitReportInput) {
  return api('/api/reports', {
    method: 'POST',
    body: JSON.stringify({ messageId, reason, details }),
  })
}
