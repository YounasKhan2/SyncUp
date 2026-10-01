import { Client, Storage } from 'node-appwrite'

type AppwriteConfiguration = {
  endpoint: string
  projectId: string
  apiKey: string
  bucketId: string
}

function configuration(): AppwriteConfiguration {
  const endpoint = process.env.APPWRITE_ENDPOINT
  const projectId = process.env.APPWRITE_PROJECT_ID
  const apiKey = process.env.APPWRITE_API_KEY
  const bucketId = process.env.APPWRITE_STORAGE_BUCKET_ID

  if (!endpoint || !projectId || !apiKey || !bucketId) {
    throw new Error('Configure APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, and APPWRITE_STORAGE_BUCKET_ID to use Appwrite Storage.')
  }
  return { endpoint: endpoint.replace(/\/$/u, ''), projectId, apiKey, bucketId }
}

export function createAppwriteStorage() {
  const config = configuration()
  const client = new Client()
    .setEndpoint(config.endpoint)
    .setProject(config.projectId)
    .setKey(config.apiKey)

  return { storage: new Storage(client), bucketId: config.bucketId }
}

export async function uploadAppwriteRange(input: {
  fileId: string
  filename: string
  bytes: Buffer
  start: number
  end: number
  total: number
}) {
  const config = configuration()
  const form = new FormData()
  form.append('fileId', input.fileId)
  const bytes = new Uint8Array(input.bytes.byteLength)
  bytes.set(input.bytes)
  form.append('file', new Blob([bytes.buffer]), input.filename)

  const headers: Record<string, string> = {
    'X-Appwrite-Project': config.projectId,
    'X-Appwrite-Key': config.apiKey,
    'Content-Range': `bytes ${input.start}-${input.end}/${input.total}`,
  }
  if (input.start > 0) headers['X-Appwrite-ID'] = input.fileId

  const response = await fetch(
    `${config.endpoint}/storage/buckets/${encodeURIComponent(config.bucketId)}/files`,
    { method: 'POST', headers, body: form },
  )
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    const error = new Error(`Appwrite resumable upload failed with status ${response.status}.`)
    Object.assign(error, { status: response.status, detail: detail.slice(0, 500) })
    throw error
  }
  return response.json() as Promise<{ $id: string; sizeOriginal: number; chunksTotal: number; chunksUploaded: number }>
}


export async function downloadAppwriteRange(input: { fileId: string; start: number; end: number }) {
  const config = configuration()
  const response = await fetch(
    `${config.endpoint}/storage/buckets/${encodeURIComponent(config.bucketId)}/files/${encodeURIComponent(input.fileId)}/download`,
    {
      headers: {
        'X-Appwrite-Project': config.projectId,
        'X-Appwrite-Key': config.apiKey,
        Range: `bytes=${input.start}-${input.end}`,
      },
    },
  )
  if (response.status !== 206 && response.status !== 200) {
    throw new Error(`Media download failed with status ${response.status}.`)
  }
  const fullBytes = Buffer.from(await response.arrayBuffer())
  const expected = input.end - input.start + 1
  // When Appwrite returns 200 (full body) instead of 206, extract the requested range
  const bytes = response.status === 200 && fullBytes.byteLength > expected
    ? fullBytes.subarray(input.start, input.start + expected)
    : fullBytes
  if (bytes.byteLength !== expected) throw new Error('Media download range size did not match the request.')
  return bytes
}
