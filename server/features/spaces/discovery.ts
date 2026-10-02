import express, { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { InputFile } from 'node-appwrite/file'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { pool } from '../../db.js'
import type { AuthenticatedRequest } from '../auth/types.js'
import { createAppwriteStorage } from '../../shared/appwrite.js'
import { searchLimiter } from '../messaging/limits.js'
import { allowedTypes, fileMaxBytes, fileNameSchema, imageMaxBytes } from './file-validation.js'

export const spaceDiscoveryRoutes = Router()
const fileUploadLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => (request as AuthenticatedRequest).auth!.userId,
  message: { error: { code: 'rate_limited', message: 'Too many file uploads. Try again shortly.' } },
})

const idSchema = z.string().uuid()

type ChannelAccess = { can_view: boolean; can_send: boolean }

async function channelAccess(spaceId: string, channelId: string, userId: string): Promise<ChannelAccess | null> {
  const result = await pool.query<ChannelAccess>(
    `SELECT
       (sm.role IN ('owner', 'admin') OR COALESCE(permission.can_view, true)) AS can_view,
       (sm.role IN ('owner', 'admin') OR COALESCE(permission.can_send, true)) AS can_send
     FROM space_channels sc
     JOIN space_members sm ON sm.space_id = sc.space_id AND sm.user_id = $3
     JOIN chat_members grant_member ON grant_member.chat_id = sc.chat_id
       AND grant_member.user_id = $3 AND grant_member.left_at IS NULL
     LEFT JOIN space_channel_role_permissions permission
       ON permission.space_id = sc.space_id AND permission.chat_id = sc.chat_id
         AND permission.role = sm.role
     WHERE sc.space_id = $1 AND sc.chat_id = $2 AND sc.channel_type <> 'voice'`,
    [spaceId, channelId, userId],
  )
  return result.rows[0] ?? null
}

function validSpaceAndChannel(request: AuthenticatedRequest) {
  return {
    spaceId: idSchema.safeParse(request.params.spaceId),
    channelId: idSchema.safeParse(request.params.channelId),
  }
}

spaceDiscoveryRoutes.get('/spaces/:spaceId/search', searchLimiter, async (request: AuthenticatedRequest, response, next) => {
  const input = z.object({
    q: z.string().trim().min(2).max(80),
    from: idSchema.optional(),
    after: z.iso.date().optional(),
    before: z.iso.date().optional(),
    has: z.enum(['file', 'image']).optional(),
    objectType: z.enum(['poll', 'event', 'checklist', 'decision']).optional(),
  }).safeParse(request.query)
  const spaceId = idSchema.safeParse(request.params.spaceId)
  if (!spaceId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Enter a search term and valid filters.' } })
    return
  }
  const { q, from, after, before, has, objectType } = input.data
  if (after && before && after > before) {
    response.status(400).json({ error: { code: 'validation', message: 'The start date must be before the end date.' } })
    return
  }
  const escapedQuery = q.replace(/[\\%_]/gu, '\\$&')
  try {
    const [messages, files, objects] = await Promise.all([
      has || objectType
        ? Promise.resolve({ rows: [] })
        : pool.query(
          `SELECT 'message' AS type, m.id, m.chat_id AS channel_id, sc.name AS channel_name,
                  m.sender_id AS author_id, u.display_name AS author_name, u.username AS author_username,
                  m.body AS title, m.body AS excerpt, m.server_seq::text AS server_seq, m.created_at
           FROM channel_messages m
           JOIN space_channels sc ON sc.chat_id = m.chat_id AND sc.space_id = $1
           JOIN space_members sm ON sm.space_id = sc.space_id AND sm.user_id = $2
           JOIN chat_members grant_member ON grant_member.chat_id = sc.chat_id
             AND grant_member.user_id = $2 AND grant_member.left_at IS NULL
           LEFT JOIN space_channel_role_permissions permission
             ON permission.space_id = sc.space_id AND permission.chat_id = sc.chat_id
               AND permission.role = sm.role
           JOIN users u ON u.id = m.sender_id
           WHERE sc.channel_type <> 'voice'
             AND (sm.role IN ('owner', 'admin') OR COALESCE(permission.can_view, true))
             AND m.body ILIKE '%' || $3 || '%' ESCAPE '\\'
             AND ($4::uuid IS NULL OR m.sender_id = $4)
             AND ($5::date IS NULL OR m.created_at >= $5::date)
             AND ($6::date IS NULL OR m.created_at < ($6::date + 1))
           ORDER BY m.created_at DESC LIMIT 50`,
          [spaceId.data, request.auth!.userId, escapedQuery, from ?? null, after ?? null, before ?? null],
        ),
      objectType
        ? Promise.resolve({ rows: [] })
        : pool.query(
          `SELECT 'file' AS type, f.id, f.chat_id AS channel_id, sc.name AS channel_name,
                  f.uploaded_by AS author_id, u.display_name AS author_name, u.username AS author_username,
                  f.filename AS title, f.content_type, f.size_bytes::text AS size_bytes,
                  f.created_at
           FROM channel_files f
           JOIN space_channels sc ON sc.chat_id = f.chat_id AND sc.space_id = $1
           JOIN space_members sm ON sm.space_id = sc.space_id AND sm.user_id = $2
           JOIN chat_members grant_member ON grant_member.chat_id = sc.chat_id
             AND grant_member.user_id = $2 AND grant_member.left_at IS NULL
           LEFT JOIN space_channel_role_permissions permission
             ON permission.space_id = sc.space_id AND permission.chat_id = sc.chat_id
               AND permission.role = sm.role
           JOIN users u ON u.id = f.uploaded_by
           WHERE sc.channel_type <> 'voice' AND f.status = 'ready'
             AND (sm.role IN ('owner', 'admin') OR COALESCE(permission.can_view, true))
             AND f.filename ILIKE '%' || $3 || '%' ESCAPE '\\'
             AND ($4::uuid IS NULL OR f.uploaded_by = $4)
             AND ($5::date IS NULL OR f.created_at >= $5::date)
             AND ($6::date IS NULL OR f.created_at < ($6::date + 1))
             AND ($7::text IS NULL OR $7 = 'file' OR ($7 = 'image' AND f.content_type LIKE 'image/%'))
           ORDER BY f.created_at DESC LIMIT 50`,
          [spaceId.data, request.auth!.userId, escapedQuery, from ?? null, after ?? null, before ?? null, has ?? null],
        ),
      has
        ? Promise.resolve({ rows: [] })
        : pool.query(
          `SELECT 'object' AS type, o.id, o.chat_id AS channel_id, sc.name AS channel_name,
                  o.created_by AS author_id, u.display_name AS author_name, u.username AS author_username,
                  o.object_type, o.title, m.id AS message_id, m.server_seq::text AS server_seq,
                  o.created_at
           FROM channel_shared_objects o
           JOIN space_channels sc ON sc.chat_id = o.chat_id AND sc.space_id = $1
           JOIN space_members sm ON sm.space_id = sc.space_id AND sm.user_id = $2
           JOIN chat_members grant_member ON grant_member.chat_id = sc.chat_id
             AND grant_member.user_id = $2 AND grant_member.left_at IS NULL
           LEFT JOIN space_channel_role_permissions permission
             ON permission.space_id = sc.space_id AND permission.chat_id = sc.chat_id
               AND permission.role = sm.role
           JOIN users u ON u.id = o.created_by
           JOIN channel_messages m ON m.id = o.message_id
           WHERE sc.channel_type <> 'voice'
             AND (sm.role IN ('owner', 'admin') OR COALESCE(permission.can_view, true))
             AND (o.title ILIKE '%' || $3 || '%' ESCAPE '\\'
               OR o.payload::text ILIKE '%' || $3 || '%' ESCAPE '\\')
             AND ($4::uuid IS NULL OR o.created_by = $4)
             AND ($5::date IS NULL OR o.created_at >= $5::date)
             AND ($6::date IS NULL OR o.created_at < ($6::date + 1))
             AND ($7::text IS NULL OR o.object_type = $7)
           ORDER BY o.created_at DESC LIMIT 50`,
          [spaceId.data, request.auth!.userId, escapedQuery, from ?? null, after ?? null, before ?? null, objectType ?? null],
        ),
    ])
    response.json({ results: [...messages.rows, ...files.rows, ...objects.rows].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    ).slice(0, 100) })
  } catch (error) {
    next(error)
  }
})

spaceDiscoveryRoutes.get('/spaces/:spaceId/channels/:channelId/files', async (request: AuthenticatedRequest, response, next) => {
  const { spaceId, channelId } = validSpaceAndChannel(request)
  if (!spaceId.success || !channelId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a valid Space channel.' } })
    return
  }
  try {
    const access = await channelAccess(spaceId.data, channelId.data, request.auth!.userId)
    if (!access?.can_view) {
      response.status(404).json({ error: { code: 'not_found', message: 'Channel not found.' } })
      return
    }
    const files = await pool.query(
      `SELECT f.id, f.filename, f.content_type, f.size_bytes::text AS size_bytes,
              f.uploaded_by AS author_id, u.display_name AS author_name, f.created_at
       FROM channel_files f JOIN users u ON u.id = f.uploaded_by
       WHERE f.chat_id = $1 AND f.status = 'ready'
       ORDER BY f.created_at DESC LIMIT 200`,
      [channelId.data],
    )
    response.json({ files: files.rows })
  } catch (error) {
    next(error)
  }
})

spaceDiscoveryRoutes.post('/spaces/:spaceId/channels/:channelId/files', fileUploadLimiter, async (request: AuthenticatedRequest, response, next) => {
  const { spaceId, channelId } = validSpaceAndChannel(request)
  const input = z.object({
    filename: fileNameSchema,
    contentType: z.string().trim().toLowerCase().max(120),
    sizeBytes: z.number().int().positive().max(fileMaxBytes),
  }).safeParse(request.body)
  if (!spaceId.success || !channelId.success || !input.success || !allowedTypes.has(input.data?.contentType ?? '')) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a supported file up to 25 MB.' } })
    return
  }
  if (input.data.contentType.startsWith('image/') && input.data.sizeBytes > imageMaxBytes) {
    response.status(400).json({ error: { code: 'validation', message: 'Images must be 10 MB or smaller.' } })
    return
  }
  try {
    const access = await channelAccess(spaceId.data, channelId.data, request.auth!.userId)
    if (!access?.can_view) {
      response.status(404).json({ error: { code: 'not_found', message: 'Channel not found.' } })
      return
    }
    if (!access.can_send) {
      response.status(403).json({ error: { code: 'forbidden', message: 'You cannot add files to this channel.' } })
      return
    }
    createAppwriteStorage()
    const id = randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    await pool.query(
      `INSERT INTO channel_files (id, chat_id, uploaded_by, object_key, filename, content_type, size_bytes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, channelId.data, request.auth!.userId, id, input.data.filename, input.data.contentType, input.data.sizeBytes, expiresAt],
    )
    response.status(201).json({ fileId: id })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Configure APPWRITE_')) {
      response.status(503).json({ error: { code: 'service_unavailable', message: 'File storage is not configured on this server.' } })
      return
    }
    next(error)
  }
})

spaceDiscoveryRoutes.put(
  '/spaces/:spaceId/channels/:channelId/files/:fileId/content',
  fileUploadLimiter,
  express.raw({ type: () => true, limit: fileMaxBytes }),
  async (request: AuthenticatedRequest, response, next) => {
    const { spaceId, channelId } = validSpaceAndChannel(request)
    const fileId = idSchema.safeParse(request.params.fileId)
    if (!spaceId.success || !channelId.success || !fileId.success || !Buffer.isBuffer(request.body)) {
      response.status(400).json({ error: { code: 'validation', message: 'Choose a valid file upload.' } })
      return
    }
    try {
      const access = await channelAccess(spaceId.data, channelId.data, request.auth!.userId)
      if (!access?.can_view) {
        response.status(404).json({ error: { code: 'not_found', message: 'Channel not found.' } })
        return
      }
      if (!access.can_send) {
        response.status(403).json({ error: { code: 'forbidden', message: 'You cannot add files to this channel.' } })
        return
      }
      const pending = await pool.query<{
        filename: string
        content_type: string
        size_bytes: string
        object_key: string
      }>(
        `SELECT filename, content_type, size_bytes::text, object_key FROM channel_files
         WHERE id = $1 AND chat_id = $2 AND uploaded_by = $3
           AND status = 'pending' AND expires_at > now()`,
        [fileId.data, channelId.data, request.auth!.userId],
      )
      const file = pending.rows[0]
      if (!file) {
        response.status(404).json({ error: { code: 'not_found', message: 'File upload not found or expired.' } })
        return
      }
      if (!request.is(file.content_type)) {
        response.status(400).json({ error: { code: 'validation', message: 'Uploaded file type did not match its upload request.' } })
        return
      }
      if (request.body.byteLength !== Number(file.size_bytes)) {
        response.status(400).json({ error: { code: 'validation', message: 'Uploaded file size did not match its upload request.' } })
        return
      }
      const storage = createAppwriteStorage()
      await storage.storage.createFile({
        bucketId: storage.bucketId,
        fileId: file.object_key,
        file: InputFile.fromBuffer(request.body, `${file.object_key}.bin`),
        permissions: [],
      })
      await pool.query(
        `UPDATE channel_files SET uploaded_at = now()
         WHERE id = $1 AND status = 'pending' AND uploaded_by = $2`,
        [fileId.data, request.auth!.userId],
      )
      response.status(204).end()
    } catch (error) {
      next(error)
    }
  },
)

spaceDiscoveryRoutes.post('/spaces/:spaceId/channels/:channelId/files/:fileId/complete', fileUploadLimiter, async (request: AuthenticatedRequest, response, next) => {
  const { spaceId, channelId } = validSpaceAndChannel(request)
  const fileId = idSchema.safeParse(request.params.fileId)
  if (!spaceId.success || !channelId.success || !fileId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a valid file upload.' } })
    return
  }
  try {
    const access = await channelAccess(spaceId.data, channelId.data, request.auth!.userId)
    if (!access?.can_view) {
      response.status(404).json({ error: { code: 'not_found', message: 'Channel not found.' } })
      return
    }
    if (!access.can_send) {
      response.status(403).json({ error: { code: 'forbidden', message: 'You cannot add files to this channel.' } })
      return
    }
    const result = await pool.query(
      `UPDATE channel_files SET status = 'ready'
       WHERE id = $1 AND chat_id = $2 AND uploaded_by = $3 AND status = 'pending'
         AND uploaded_at IS NOT NULL AND expires_at > now()
       RETURNING id`,
      [fileId.data, channelId.data, request.auth!.userId],
    )
    if (!result.rowCount) {
      response.status(404).json({ error: { code: 'not_found', message: 'File upload not found or expired.' } })
      return
    }
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

spaceDiscoveryRoutes.get('/spaces/:spaceId/channels/:channelId/files/:fileId/content', async (request: AuthenticatedRequest, response, next) => {
  const { spaceId, channelId } = validSpaceAndChannel(request)
  const fileId = idSchema.safeParse(request.params.fileId)
  if (!spaceId.success || !channelId.success || !fileId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a valid file.' } })
    return
  }
  try {
    const access = await channelAccess(spaceId.data, channelId.data, request.auth!.userId)
    if (!access?.can_view) {
      response.status(404).json({ error: { code: 'not_found', message: 'File not found.' } })
      return
    }
    const result = await pool.query<{
      object_key: string
      filename: string
      content_type: string
      size_bytes: string
    }>(
      `SELECT object_key, filename, content_type, size_bytes::text FROM channel_files
       WHERE id = $1 AND chat_id = $2 AND status = 'ready'`,
      [fileId.data, channelId.data],
    )
    const file = result.rows[0]
    if (!file) {
      response.status(404).json({ error: { code: 'not_found', message: 'File not found.' } })
      return
    }
    const storage = createAppwriteStorage()
    const bytes = await storage.storage.getFileDownload({ bucketId: storage.bucketId, fileId: file.object_key })
    response.set({
      'Content-Type': file.content_type,
      'Content-Length': file.size_bytes,
      'Content-Disposition': `${file.content_type.startsWith('image/') ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    response.send(Buffer.from(bytes))
  } catch (error) {
    next(error)
  }
})
