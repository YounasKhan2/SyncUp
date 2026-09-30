import express, { Router } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import { InputFile } from 'node-appwrite/file'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { requireAuth, type AuthenticatedRequest } from '../auth/middleware.js'
import { pool } from '../../db.js'
import { createAppwriteStorage } from '../../shared/appwrite.js'

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const videoTypes = new Set(['video/mp4', 'video/webm'])
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
const maxVideoBytes = 25 * 1024 * 1024
const nonceSchema = z.string().regex(/^[A-Za-z0-9_-]{16}$/)
const envelopesSchema = z.record(z.uuid(), z.string().regex(/^[A-Za-z0-9_-]+$/).min(16).max(16_384))
const createUploadLimiter = (limit: number) => rateLimit({
  windowMs: 60_000,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => (request as AuthenticatedRequest).auth?.userId ?? ipKeyGenerator(request.ip ?? ''),
  message: { error: { code: 'rate_limited', message: 'Too many upload requests. Try again shortly.' } },
})
const uploadIntentLimiter = createUploadLimiter(20)
const uploadContentLimiter = createUploadLimiter(20)
const uploadCompleteLimiter = createUploadLimiter(20)
const attachmentMetadataLimiter = createUploadLimiter(60)
const attachmentDownloadLimiter = createUploadLimiter(120)

export const uploadsRouter = Router()
uploadsRouter.use(requireAuth)

function appwriteStorageConfiguration() {
  try {
    return createAppwriteStorage()
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Configure APPWRITE_')) return null
    throw error
  }
}

uploadsRouter.post('/uploads/intent', uploadIntentLimiter, async (request: AuthenticatedRequest, response, next) => {
  const input = z.object({
    chatId: z.uuid(),
    filename: z.string().trim().min(1).max(200).refine((value) => !/[\\/\u0000-\u001f]/u.test(value)),
    contentType: z.string().min(1).max(120),
    sizeBytes: z.number().int().positive(),
    nonce: nonceSchema,
    keyEnvelopes: envelopesSchema.refine((value) => Object.keys(value).length >= 2 && Object.keys(value).length <= 32),
    parentVideoId: z.uuid().optional(),
  }).safeParse(request.body)
  if (!input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a supported file and valid encrypted key envelopes.' } })
    return
  }
  const image = imageTypes.has(input.data.contentType)
  const video = videoTypes.has(input.data.contentType)
  if ((!image && !video && !fileTypes.has(input.data.contentType))
    || input.data.sizeBytes > (image ? maxImageBytes : video ? maxVideoBytes : maxFileBytes)) {
    response.status(400).json({ error: { code: 'validation', message: 'Images are limited to 10 MB; MP4/WebM videos and supported files are limited to 25 MB.' } })
    return
  }
  const appwrite = appwriteStorageConfiguration()
  if (!appwrite) {
    response.status(503).json({ error: { code: 'service_unavailable', message: 'File storage is not configured.' } })
    return
  }

  try {
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
    if (input.data.parentVideoId) {
      if (!image) {
        response.status(400).json({ error: { code: 'validation', message: 'Video preview must be an image.' } })
        return
      }
      const parent = await pool.query(
        `SELECT id FROM attachments WHERE id = $1 AND chat_id = $2 AND uploaded_by = $3
         AND transport_version = 2 AND media_kind = 'video' AND status = 'pending'`,
        [input.data.parentVideoId, input.data.chatId, request.auth!.userId],
      )
      if (!parent.rows[0]) {
        response.status(404).json({ error: { code: 'not_found', message: 'Video not found.' } })
        return
      }
    }
    const id = uuidv7()
    const objectKey = `appwrite:${id}`
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
    if (input.data.parentVideoId) {
      await pool.query(
        'UPDATE attachments SET poster_attachment_id = $1 WHERE id = $2 AND uploaded_by = $3',
        [id, input.data.parentVideoId, request.auth!.userId],
      )
    }
    response.status(201).json({ attachmentId: id })
  } catch (error) {
    next(error)
  }
})

uploadsRouter.put(
  '/uploads/:id/content',
  uploadContentLimiter,
  express.raw({ type: 'application/octet-stream', limit: maxFileBytes + 16 }),
  async (request: AuthenticatedRequest, response, next) => {
    const attachmentId = z.uuid().safeParse(request.params.id)
    if (!attachmentId.success || !Buffer.isBuffer(request.body)) {
      response.status(400).json({ error: { code: 'validation', message: 'Invalid encrypted upload.' } })
      return
    }
    const appwrite = appwriteStorageConfiguration()
    if (!appwrite) {
      response.status(503).json({ error: { code: 'service_unavailable', message: 'Appwrite file storage is not configured.' } })
      return
    }
    try {
      const attachment = await pool.query<{ object_key: string; size_bytes: string }>(
        `SELECT object_key, size_bytes FROM attachments
         WHERE id = $1 AND uploaded_by = $2 AND status = 'pending' AND expires_at > now()`,
        [attachmentId.data, request.auth!.userId],
      )
      const pending = attachment.rows[0]
      if (!pending || pending.object_key !== `appwrite:${attachmentId.data}`) {
        response.status(404).json({ error: { code: 'not_found', message: 'Upload not found or expired.' } })
        return
      }
      if (request.body.byteLength !== Number(pending.size_bytes) + 16) {
        response.status(400).json({ error: { code: 'validation', message: 'Uploaded ciphertext size does not match the declared file.' } })
        return
      }
      await appwrite.storage.createFile({
        bucketId: appwrite.bucketId,
        fileId: attachmentId.data,
        file: InputFile.fromBuffer(request.body, `${attachmentId.data}.bin`),
        permissions: [],
      })
      response.status(204).end()
    } catch (error) {
      next(error)
    }
  },
)

uploadsRouter.post('/uploads/:id/complete', uploadCompleteLimiter, async (request: AuthenticatedRequest, response, next) => {
  const attachmentId = z.uuid().safeParse(request.params.id)
  if (!attachmentId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid attachment id.' } })
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
    const size = Number(attachment.rows[0].size_bytes)
    if (attachment.rows[0].object_key !== `appwrite:${attachmentId.data}`) {
      response.status(503).json({ error: { code: 'storage_migration_required', message: 'Attachment storage migration is incomplete.' } })
      return
    }
    const appwrite = appwriteStorageConfiguration()
    if (!appwrite) {
      response.status(503).json({ error: { code: 'service_unavailable', message: 'Appwrite file storage is not configured.' } })
      return
    }
    const object = await appwrite.storage.getFile({
      bucketId: appwrite.bucketId,
      fileId: attachmentId.data,
    })
    if (object.sizeOriginal !== size + 16) {
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

uploadsRouter.get('/uploads/:id', attachmentMetadataLimiter, async (request: AuthenticatedRequest, response, next) => {
  const attachmentId = z.uuid().safeParse(request.params.id)
  if (!attachmentId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid attachment id.' } })
    return
  }
  try {
    const result = await pool.query(
      `SELECT a.id, a.object_key, a.filename, a.content_type, a.size_bytes, a.nonce,
              a.key_envelopes -> $2::text AS key_envelope
       FROM attachments a
       LEFT JOIN message_attachments ma ON ma.attachment_id = a.id
       LEFT JOIN attachments parent ON parent.poster_attachment_id = a.id
       LEFT JOIN message_attachments pma ON pma.attachment_id = parent.id
       JOIN messages m ON m.chat_id = a.chat_id
         AND (m.id = ma.message_id OR m.id = pma.message_id)
       JOIN chat_members cm ON cm.chat_id = a.chat_id AND cm.user_id = $2 AND cm.left_at IS NULL
       WHERE a.id = $1 AND a.status = 'ready'
         AND (ma.message_id IS NOT NULL OR (pma.message_id IS NOT NULL AND parent.status = 'ready'))
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
    if (attachment.object_key !== `appwrite:${attachment.id}`) {
      response.status(503).json({ error: { code: 'storage_migration_required', message: 'Attachment storage migration is incomplete.' } })
      return
    }
    if (!appwriteStorageConfiguration()) {
      response.status(503).json({ error: { code: 'service_unavailable', message: 'File storage is not configured.' } })
      return
    }
    response.json({
      attachment: {
        id: attachment.id,
        filename: attachment.filename,
        contentType: attachment.content_type,
        sizeBytes: Number(attachment.size_bytes),
        nonce: attachment.nonce,
        keyEnvelope: attachment.key_envelope,
        downloadUrl: `/api/uploads/${attachment.id}/content`,
      },
    })
  } catch (error) {
    next(error)
  }
})

uploadsRouter.get('/uploads/:id/content', attachmentDownloadLimiter, async (request: AuthenticatedRequest, response, next) => {
  const attachmentId = z.uuid().safeParse(request.params.id)
  if (!attachmentId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid attachment id.' } })
    return
  }
  const appwrite = appwriteStorageConfiguration()
  if (!appwrite) {
    response.status(503).json({ error: { code: 'service_unavailable', message: 'Appwrite file storage is not configured.' } })
    return
  }
  try {
    const access = await pool.query(
      `SELECT a.object_key FROM attachments a
       LEFT JOIN message_attachments ma ON ma.attachment_id = a.id
       LEFT JOIN attachments parent ON parent.poster_attachment_id = a.id
       LEFT JOIN message_attachments pma ON pma.attachment_id = parent.id
       JOIN messages m ON m.chat_id = a.chat_id
         AND (m.id = ma.message_id OR m.id = pma.message_id)
       JOIN chat_members cm ON cm.chat_id = a.chat_id AND cm.user_id = $2 AND cm.left_at IS NULL
       WHERE a.id = $1 AND a.status = 'ready' AND a.object_key = $3
         AND (ma.message_id IS NOT NULL OR (pma.message_id IS NOT NULL AND parent.status = 'ready'))
         AND NOT EXISTS (
           SELECT 1 FROM message_requests mr WHERE mr.chat_id = a.chat_id
             AND mr.to_user = $2 AND mr.state IN ('pending', 'ignored')
         )`,
      [attachmentId.data, request.auth!.userId, `appwrite:${attachmentId.data}`],
    )
    if (!access.rows[0]) {
      response.status(404).json({ error: { code: 'not_found', message: 'Attachment not found.' } })
      return
    }
    const ciphertext = await appwrite.storage.getFileDownload({
      bucketId: appwrite.bucketId,
      fileId: attachmentId.data,
    })
    response
      .set({
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(ciphertext.byteLength),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(Buffer.from(ciphertext))
  } catch (error) {
    next(error)
  }
})
