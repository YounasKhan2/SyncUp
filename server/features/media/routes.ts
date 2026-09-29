import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Router } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { requireAuth, type AuthenticatedRequest } from '../auth/middleware.js'
import { pool } from '../../db.js'

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const fileTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'text/plain',
])
const maxImageBytes = 10 * 1024 * 1024
const maxFileBytes = 25 * 1024 * 1024
const nonceSchema = z.string().regex(/^[A-Za-z0-9_-]{16}$/)
const envelopesSchema = z.record(z.uuid(), z.string().regex(/^[A-Za-z0-9_-]+$/).min(16).max(16_384))
const limiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => (request as AuthenticatedRequest).auth?.userId ?? ipKeyGenerator(request.ip ?? ''),
  message: { error: { code: 'rate_limited', message: 'Too many upload requests. Try again shortly.' } },
})

export const uploadsRouter = Router()
uploadsRouter.use(requireAuth)

let bucketReady: Promise<void> | null = null
let storageClient: S3Client | null = null
let storageSettingsKey: string | null = null

function storageConfiguration() {
  const endpoint = process.env.S3_ENDPOINT
  const bucket = process.env.S3_BUCKET
  const accessKeyId = process.env.S3_ACCESS_KEY
  const secretAccessKey = process.env.S3_SECRET_KEY
  const region = process.env.S3_REGION ?? 'us-east-1'
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null
  const settingsKey = [endpoint, bucket, region, accessKeyId, secretAccessKey].join('\u0000')
  if (settingsKey !== storageSettingsKey) {
    storageClient?.destroy()
    storageClient = new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    })
    storageSettingsKey = settingsKey
    bucketReady = null
  }
  const client = storageClient
  if (!client) throw new Error('Unable to initialize object storage.')
  return { bucket, client }
}

async function prepareBucket(storage: NonNullable<ReturnType<typeof storageConfiguration>>) {
  if (!bucketReady) {
    bucketReady = (async () => {
      if (process.env.S3_AUTO_CREATE_BUCKET !== 'true') return
      try {
        await storage.client.send(new CreateBucketCommand({ Bucket: storage.bucket }))
      } catch (error) {
        if (typeof error !== 'object' || error === null || !('name' in error)
          || (error.name !== 'BucketAlreadyOwnedByYou' && error.name !== 'BucketAlreadyExists')) {
          throw error
        }
      }
      await storage.client.send(new PutBucketCorsCommand({
        Bucket: storage.bucket,
        CORSConfiguration: {
          CORSRules: [{
            AllowedOrigins: [process.env.WEB_ORIGIN ?? 'http://localhost:5173'],
            AllowedMethods: ['GET', 'PUT', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 300,
          }],
        },
      }))
    })().catch((error: unknown) => {
      bucketReady = null
      throw error
    })
  }
  await bucketReady
}

uploadsRouter.post('/uploads/intent', limiter, async (request: AuthenticatedRequest, response, next) => {
  const input = z.object({
    chatId: z.uuid(),
    filename: z.string().trim().min(1).max(200).refine((value) => !/[\\/\u0000-\u001f]/u.test(value)),
    contentType: z.string().min(1).max(120),
    sizeBytes: z.number().int().positive(),
    nonce: nonceSchema,
    keyEnvelopes: envelopesSchema.refine((value) => Object.keys(value).length >= 2 && Object.keys(value).length <= 32),
  }).safeParse(request.body)
  if (!input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a supported file and valid encrypted key envelopes.' } })
    return
  }
  const image = imageTypes.has(input.data.contentType)
  if ((!image && !fileTypes.has(input.data.contentType))
    || input.data.sizeBytes > (image ? maxImageBytes : maxFileBytes)) {
    response.status(400).json({ error: { code: 'validation', message: 'Images are limited to 10 MB; supported files are limited to 25 MB.' } })
    return
  }
  const storage = storageConfiguration()
  if (!storage) {
    response.status(503).json({ error: { code: 'service_unavailable', message: 'File storage is not configured.' } })
    return
  }

  try {
    await prepareBucket(storage)
    const members = await pool.query<{ user_id: string }>(
      `SELECT cm.user_id FROM chat_members cm
       JOIN chats c ON c.id = cm.chat_id
       WHERE cm.chat_id = $1 AND cm.left_at IS NULL
         AND c.kind IN ('direct', 'group')
         AND NOT EXISTS (
           SELECT 1 FROM message_requests mr WHERE mr.chat_id = c.id
             AND mr.to_user = $2 AND mr.state IN ('pending', 'ignored')
         )`,
      [input.data.chatId, request.auth!.userId],
    )
    const allowedMemberIds = members.rows.map((member) => member.user_id).sort()
    const envelopeMemberIds = Object.keys(input.data.keyEnvelopes).sort()
    if (!allowedMemberIds.includes(request.auth!.userId)
      || allowedMemberIds.length < 2
      || allowedMemberIds.length > 32
      || allowedMemberIds.length !== envelopeMemberIds.length
      || allowedMemberIds.some((id, index) => id !== envelopeMemberIds[index])) {
      response.status(404).json({ error: { code: 'not_found', message: 'Chat not found.' } })
      return
    }
    const id = uuidv7()
    const objectKey = `encrypted/${input.data.chatId}/${id}`
    await pool.query(
      `INSERT INTO attachments
         (id, chat_id, uploaded_by, object_key, filename, content_type, size_bytes, nonce, key_envelopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now() + interval '15 minutes')`,
      [
        id,
        input.data.chatId,
        request.auth!.userId,
        objectKey,
        input.data.filename,
        input.data.contentType,
        input.data.sizeBytes,
        input.data.nonce,
        JSON.stringify(input.data.keyEnvelopes),
      ],
    )
    const uploadUrl = await getSignedUrl(
      storage.client,
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: objectKey,
        ContentType: 'application/octet-stream',
        ContentLength: input.data.sizeBytes + 16,
      }),
      { expiresIn: 300 },
    )
    response.status(201).json({ attachmentId: id, uploadUrl, uploadContentType: 'application/octet-stream' })
  } catch (error) {
    next(error)
  }
})

uploadsRouter.post('/uploads/:id/complete', limiter, async (request: AuthenticatedRequest, response, next) => {
  const attachmentId = z.uuid().safeParse(request.params.id)
  if (!attachmentId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid attachment id.' } })
    return
  }
  const storage = storageConfiguration()
  if (!storage) {
    response.status(503).json({ error: { code: 'service_unavailable', message: 'File storage is not configured.' } })
    return
  }
  try {
    const attachment = await pool.query<{ object_key: string; size_bytes: string }>(
      `SELECT object_key, size_bytes FROM attachments
       WHERE id = $1 AND uploaded_by = $2 AND status = 'pending' AND expires_at > now()`,
      [attachmentId.data, request.auth!.userId],
    )
    if (!attachment.rows[0]) {
      response.status(404).json({ error: { code: 'not_found', message: 'Upload not found or expired.' } })
      return
    }
    const object = await storage.client.send(new HeadObjectCommand({
      Bucket: storage.bucket,
      Key: attachment.rows[0].object_key,
    }))
    const size = Number(attachment.rows[0].size_bytes)
    if (object.ContentLength !== size + 16) {
      response.status(400).json({ error: { code: 'validation', message: 'Uploaded ciphertext size does not match the declared file.' } })
      return
    }
    const updated = await pool.query(
      `UPDATE attachments SET status = 'ready'
       WHERE id = $1 AND uploaded_by = $2 AND status = 'pending' AND expires_at > now()
       RETURNING id`,
      [attachmentId.data, request.auth!.userId],
    )
    if (!updated.rows[0]) {
      response.status(409).json({ error: { code: 'conflict', message: 'Upload was already completed or expired.' } })
      return
    }
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

uploadsRouter.get('/uploads/:id', limiter, async (request: AuthenticatedRequest, response, next) => {
  const attachmentId = z.uuid().safeParse(request.params.id)
  if (!attachmentId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid attachment id.' } })
    return
  }
  const storage = storageConfiguration()
  if (!storage) {
    response.status(503).json({ error: { code: 'service_unavailable', message: 'File storage is not configured.' } })
    return
  }
  try {
    const result = await pool.query(
      `SELECT a.id, a.object_key, a.filename, a.content_type, a.size_bytes, a.nonce,
              a.key_envelopes -> $2::text AS key_envelope
       FROM attachments a
       JOIN message_attachments ma ON ma.attachment_id = a.id
       JOIN messages m ON m.id = ma.message_id AND m.chat_id = a.chat_id
       JOIN chat_members cm ON cm.chat_id = a.chat_id AND cm.user_id = $2 AND cm.left_at IS NULL
       WHERE a.id = $1 AND a.status = 'ready'
         AND NOT EXISTS (
           SELECT 1 FROM message_requests mr WHERE mr.chat_id = a.chat_id
             AND mr.to_user = $2 AND mr.state IN ('pending', 'ignored')
         )`,
      [attachmentId.data, request.auth!.userId],
    )
    if (!result.rows[0]) {
      response.status(404).json({ error: { code: 'not_found', message: 'Attachment not found.' } })
      return
    }
    const attachment = result.rows[0]
    const downloadUrl = await getSignedUrl(
      storage.client,
      new GetObjectCommand({
        Bucket: storage.bucket,
        Key: attachment.object_key,
        ResponseContentType: 'application/octet-stream',
      }),
      { expiresIn: 300 },
    )
    response.json({
      attachment: {
        id: attachment.id,
        filename: attachment.filename,
        contentType: attachment.content_type,
        sizeBytes: Number(attachment.size_bytes),
        nonce: attachment.nonce,
        keyEnvelope: attachment.key_envelope,
        downloadUrl,
      },
    })
  } catch (error) {
    next(error)
  }
})
