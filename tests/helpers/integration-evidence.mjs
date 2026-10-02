// Optional Node preload for the unchanged integration command. Records only
// sanitized method/path/status, never credentials, payloads, cookies or keys.
import { appendFileSync } from 'node:fs'
const destination = process.env.SYNCUP_INTEGRATION_EVIDENCE
if (!destination) throw new Error('SYNCUP_INTEGRATION_EVIDENCE must name a validation artifact')
const original = globalThis.fetch
globalThis.fetch = async (input, options) => {
  const url = new URL(String(input))
  const path = url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/giu, ':id')
  const response = await original(input, options)
  appendFileSync(destination, JSON.stringify({ method: options?.method ?? 'GET', path, status: response.status }) + '\n')
  return response
}
