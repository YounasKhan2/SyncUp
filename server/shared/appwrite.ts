import { Client, Storage } from 'node-appwrite'

export function createAppwriteStorage() {
  const endpoint = process.env.APPWRITE_ENDPOINT
  const projectId = process.env.APPWRITE_PROJECT_ID
  const apiKey = process.env.APPWRITE_API_KEY
  const bucketId = process.env.APPWRITE_STORAGE_BUCKET_ID

  if (!endpoint || !projectId || !apiKey || !bucketId) {
    throw new Error('Configure APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, and APPWRITE_STORAGE_BUCKET_ID to use Appwrite Storage.')
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey)

  return { storage: new Storage(client), bucketId }
}
