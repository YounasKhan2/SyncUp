import { Router } from 'express'
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk'
import { rateLimit } from 'express-rate-limit'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { pool } from '../../db.js'
import type { AuthenticatedRequest } from '../auth/types.js'
import { publishChatEvent } from '../realtime/routes.js'
import { messageLimiter } from '../messaging/limits.js'
import { spaceObjectRoutes } from './objects.js'
import { spaceDiscoveryRoutes } from './discovery.js'

export const spaceRoutes = Router()
spaceRoutes.use(spaceObjectRoutes)
spaceRoutes.use(spaceDiscoveryRoutes)

const idSchema = z.uuid()
const channelNameSchema = z.string().trim().toLowerCase().min(1).max(40).regex(/^[a-z0-9][a-z0-9-]*$/)
const mentionPattern = /(?:^|[^\w@])@([a-zA-Z0-9_]{3,24})(?![a-zA-Z0-9_])/gu
const voiceLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => (request as AuthenticatedRequest).auth!.userId,
  message: { error: { code: 'rate_limited', message: 'Too many voice room requests. Try again shortly.' } },
})

function liveKitSettings() {
  const url = process.env.LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!url || !apiKey || !apiSecret) return null
  return { url, apiKey, apiSecret }
}

function voiceRoomName(channelId: string) {
  return `syncup-space-voice-${channelId}`
}

spaceRoutes.post('/chats/:id/upgrade-to-space', messageLimiter, async (request: AuthenticatedRequest, response, next) => {
  const chatId = idSchema.safeParse(request.params.id)
  const input = z.object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(280).default(''),
    icon: z.enum(['layers', 'briefcase', 'rocket', 'heart', 'sparkles']).default('layers'),
    generalChannelName: channelNameSchema.default('general'),
  }).safeParse(request.body)
  if (!chatId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a Space name, icon, and valid #general channel name.' } })
    return
  }

  const client = await pool.connect()
  const spaceId = uuidv7()
  const categoryId = uuidv7()
  try {
    await client.query('BEGIN')
    const group = await client.query<{ title: string; role: string }>(
      `SELECT c.title, cm.role
       FROM chats c
       JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = $2 AND cm.left_at IS NULL
       WHERE c.id = $1 AND c.kind = 'group'
       FOR UPDATE OF c, cm`,
      [chatId.data, request.auth!.userId],
    )
    if (!group.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Group not found or already converted.' } })
      return
    }
    if (group.rows[0].role !== 'owner') {
      await client.query('ROLLBACK')
      response.status(403).json({ error: { code: 'forbidden', message: 'Only the group owner can convert this group into a Space.' } })
      return
    }
    const members = await client.query<{ user_id: string; role: string }>(
      `SELECT user_id, role FROM chat_members
       WHERE chat_id = $1 AND left_at IS NULL
       ORDER BY joined_at, user_id FOR UPDATE`,
      [chatId.data],
    )
    if (members.rows.length < 2 || members.rows.length > 32) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: { code: 'conflict', message: 'Only groups with 2–32 active members can be converted.' } })
      return
    }

    await client.query(
      `INSERT INTO spaces (id, name, description, icon, template, created_by, converted_from_group)
       VALUES ($1, $2, $3, $4, 'client-room', $5, true)`,
      [spaceId, input.data.name, input.data.description, input.data.icon, request.auth!.userId],
    )
    await client.query(
      `INSERT INTO space_channel_categories (id, space_id, name, created_by)
       VALUES ($1, $2, 'Text Channels', $3)`,
      [categoryId, spaceId, request.auth!.userId],
    )
    await client.query(
      `INSERT INTO space_members (space_id, user_id, role)
       SELECT $1, user_id, CASE WHEN role = 'owner' THEN 'owner' ELSE 'member' END
       FROM chat_members WHERE chat_id = $2 AND left_at IS NULL`,
      [spaceId, chatId.data],
    )
    await client.query(
      `INSERT INTO space_channels (space_id, chat_id, name, channel_type, category_id, topic)
       VALUES ($1, $2, $3, 'discussion', $4, 'The group conversation continues here. Earlier messages stay end-to-end encrypted.')`,
      [spaceId, chatId.data, input.data.generalChannelName, categoryId],
    )
    await client.query(
      `INSERT INTO space_channel_role_permissions (space_id, chat_id, role, can_view, can_send, can_speak, updated_by)
       SELECT $1, $2, target_role.role, true, true, true, $3
       FROM (VALUES ('moderator'), ('member'), ('guest')) AS target_role(role)`,
      [spaceId, chatId.data, request.auth!.userId],
    )
    await client.query(
      `INSERT INTO space_conversion_members (space_id, chat_id, user_id)
       SELECT $1, $2, user_id FROM chat_members
       WHERE chat_id = $2 AND left_at IS NULL`,
      [spaceId, chatId.data],
    )
    await client.query(
      `UPDATE chats SET kind = 'channel', title = $2 WHERE id = $1 AND kind = 'group'`,
      [chatId.data, `#${input.data.generalChannelName}`],
    )
    await client.query('COMMIT')
    response.status(201).json({ spaceId, channelId: chatId.data })
  } catch (error) {
    await client.query('ROLLBACK')
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      response.status(409).json({ error: { code: 'conflict', message: 'A Space with that channel name already exists.' } })
      return
    }
    next(error)
  } finally {
    client.release()
  }
})

spaceRoutes.get('/spaces', async (request: AuthenticatedRequest, response, next) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.name, s.description, s.icon, sm.role,
              count(DISTINCT sc.chat_id)::int AS channel_count
       FROM spaces s
       JOIN space_members sm ON sm.space_id = s.id AND sm.user_id = $1
       LEFT JOIN space_channels sc ON sc.space_id = s.id
       LEFT JOIN chat_members grant_member
         ON grant_member.chat_id = sc.chat_id AND grant_member.user_id = $1 AND grant_member.left_at IS NULL
       WHERE grant_member.user_id IS NOT NULL
         AND (sm.role IN ('owner', 'admin') OR COALESCE((
           SELECT permission.can_view FROM space_channel_role_permissions permission
           WHERE permission.space_id = sc.space_id AND permission.chat_id = sc.chat_id
             AND permission.role = sm.role
         ), true))
       GROUP BY s.id, sm.role
       ORDER BY s.created_at DESC, s.id`,
      [request.auth!.userId],
    )
    response.json({ spaces: result.rows })
  } catch (error) {
    next(error)
  }
})

spaceRoutes.post('/spaces', async (request: AuthenticatedRequest, response, next) => {
  const input = z.object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(280).default(''),
    icon: z.enum(['layers', 'briefcase', 'rocket', 'heart', 'sparkles']).default('layers'),
    template: z.literal('client-room').default('client-room'),
  }).safeParse(request.body)
  if (!input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Enter a Space name up to 80 characters.' } })
    return
  }

  const client = await pool.connect()
  const spaceId = uuidv7()
  const channelId = uuidv7()
  try {
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO spaces (id, name, description, icon, template, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [spaceId, input.data.name, input.data.description, input.data.icon, input.data.template, request.auth!.userId],
    )
    const category = await client.query<{ id: string }>(
      `INSERT INTO space_channel_categories (space_id, name, created_by)
       VALUES ($1, 'Text Channels', $2) RETURNING id`,
      [spaceId, request.auth!.userId],
    )
    await client.query(
      `INSERT INTO space_members (space_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [spaceId, request.auth!.userId],
    )
    await client.query(
      `INSERT INTO chats (id, kind, title, created_by) VALUES ($1, 'channel', '#general', $2)`,
      [channelId, request.auth!.userId],
    )
    await client.query(
      `INSERT INTO space_channels (space_id, chat_id, name, channel_type, category_id)
       VALUES ($1, $2, 'general', 'discussion', $3)`,
      [spaceId, channelId, category.rows[0].id],
    )
    await client.query(
      `INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [channelId, request.auth!.userId],
    )
    await client.query('COMMIT')
    response.status(201).json({ spaceId, channelId })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

spaceRoutes.get('/spaces/:id', async (request: AuthenticatedRequest, response, next) => {
  const spaceId = idSchema.safeParse(request.params.id)
  if (!spaceId.success) {
    response.status(404).json({ error: { code: 'not_found', message: 'Space not found.' } })
    return
  }
  try {
    const result = await pool.query(
      `SELECT s.id, s.name, s.description, s.icon, sm.role,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', sc.chat_id, 'name', sc.name, 'type', sc.channel_type,
                  'category_id', category.id, 'category_name', category.name, 'topic', sc.topic,
                  'has_encrypted_history', s.converted_from_group AND EXISTS (
                    SELECT 1 FROM space_conversion_members history_member
                    WHERE history_member.space_id = sc.space_id
                      AND history_member.chat_id = sc.chat_id AND history_member.user_id = $2
                  ),
                  'can_send', sm.role IN ('owner', 'admin') OR COALESCE((
                    SELECT permission.can_send FROM space_channel_role_permissions permission
                    WHERE permission.space_id = sc.space_id AND permission.chat_id = sc.chat_id
                      AND permission.role = sm.role
                  ), sc.channel_type <> 'announcement' OR sm.role = 'moderator'),
                  'can_speak', sm.role IN ('owner', 'admin') OR COALESCE((
                    SELECT permission.can_speak FROM space_channel_role_permissions permission
                    WHERE permission.space_id = sc.space_id AND permission.chat_id = sc.chat_id
                      AND permission.role = sm.role
                  ), true),
                  'members', COALESCE((
                    SELECT jsonb_agg(jsonb_build_object(
                      'id', member.user_id, 'username', member_user.username,
                      'display_name', member_user.display_name
                    ) ORDER BY lower(member_user.display_name), member.user_id)
                    FROM chat_members member
                    JOIN users member_user ON member_user.id = member.user_id
                    LEFT JOIN space_members channel_role
                      ON channel_role.space_id = sc.space_id AND channel_role.user_id = member.user_id
                    WHERE member.chat_id = sc.chat_id AND member.left_at IS NULL
                      AND channel_role.user_id IS NOT NULL
                      AND (channel_role.role IN ('owner', 'admin') OR COALESCE((
                        SELECT member_permission.can_view FROM space_channel_role_permissions member_permission
                        WHERE member_permission.space_id = sc.space_id
                          AND member_permission.chat_id = sc.chat_id
                          AND member_permission.role = channel_role.role
                      ), true))
                  ), '[]'::jsonb),
                  'permissions', CASE WHEN sm.role IN ('owner', 'admin') THEN (
                    SELECT jsonb_agg(jsonb_build_object(
                      'role', target_role.role,
                      'can_view', COALESCE(permission.can_view, true),
                      'can_send', COALESCE(
                        permission.can_send,
                        sc.channel_type <> 'announcement' OR target_role.role = 'moderator'
                      ),
                      'can_speak', COALESCE(permission.can_speak, true)
                    ) ORDER BY target_role.position)
                    FROM (VALUES ('moderator', 1), ('member', 2), ('guest', 3))
                      AS target_role(role, position)
                    LEFT JOIN space_channel_role_permissions permission
                      ON permission.space_id = sc.space_id AND permission.chat_id = sc.chat_id
                        AND permission.role = target_role.role
                  ) ELSE NULL END
                ) ORDER BY sc.created_at, sc.chat_id)
                FROM space_channels sc
                JOIN space_channel_categories category
                  ON category.space_id = sc.space_id AND category.id = sc.category_id
                JOIN chat_members grant_member ON grant_member.chat_id = sc.chat_id
                  AND grant_member.user_id = $2 AND grant_member.left_at IS NULL
                WHERE sc.space_id = s.id
                  AND (sm.role IN ('owner', 'admin') OR COALESCE((
                    SELECT permission.can_view FROM space_channel_role_permissions permission
                    WHERE permission.space_id = sc.space_id AND permission.chat_id = sc.chat_id
                      AND permission.role = sm.role
                  ), true))
              ), '[]'::jsonb) AS channels,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', category.id, 'name', category.name)
                  ORDER BY category.created_at, category.id)
                FROM space_channel_categories category
                WHERE category.space_id = s.id AND (sm.role IN ('owner', 'admin') OR EXISTS (
                  SELECT 1 FROM space_channels visible_channel
                  JOIN chat_members grant_member ON grant_member.chat_id = visible_channel.chat_id
                    AND grant_member.user_id = $2 AND grant_member.left_at IS NULL
                  WHERE visible_channel.space_id = s.id AND visible_channel.category_id = category.id
                    AND (sm.role IN ('owner', 'admin') OR COALESCE((
                      SELECT permission.can_view FROM space_channel_role_permissions permission
                      WHERE permission.space_id = visible_channel.space_id
                        AND permission.chat_id = visible_channel.chat_id
                        AND permission.role = sm.role
                    ), true))
                ))
              ), '[]'::jsonb) AS categories,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', u.id, 'username', u.username, 'display_name', u.display_name,
                  'role', visible_member.role
                ) ORDER BY lower(u.display_name), u.id)
                FROM space_members visible_member
                JOIN users u ON u.id = visible_member.user_id
                WHERE visible_member.space_id = s.id
                  AND (sm.role <> 'guest' OR EXISTS (
                    SELECT 1 FROM chat_members mine
                    JOIN chat_members theirs ON theirs.chat_id = mine.chat_id
                    JOIN space_channels shared_channel ON shared_channel.chat_id = mine.chat_id
                    WHERE mine.user_id = $2 AND mine.left_at IS NULL
                      AND shared_channel.space_id = s.id
                      AND theirs.user_id = visible_member.user_id AND theirs.left_at IS NULL
                      AND (sm.role IN ('owner', 'admin') OR COALESCE((
                        SELECT own_permission.can_view FROM space_channel_role_permissions own_permission
                        WHERE own_permission.space_id = shared_channel.space_id
                          AND own_permission.chat_id = shared_channel.chat_id
                          AND own_permission.role = sm.role
                      ), true))
                      AND (visible_member.role IN ('owner', 'admin') OR COALESCE((
                        SELECT other_permission.can_view FROM space_channel_role_permissions other_permission
                        WHERE other_permission.space_id = shared_channel.space_id
                          AND other_permission.chat_id = shared_channel.chat_id
                          AND other_permission.role = visible_member.role
                      ), true))
                  ))
              ), '[]'::jsonb) AS members
       FROM spaces s
       JOIN space_members sm ON sm.space_id = s.id AND sm.user_id = $2
       WHERE s.id = $1
         AND EXISTS (
           SELECT 1 FROM space_channels visible_channel
           JOIN chat_members grant_member ON grant_member.chat_id = visible_channel.chat_id
             AND grant_member.user_id = $2 AND grant_member.left_at IS NULL
           WHERE visible_channel.space_id = s.id
             AND (sm.role IN ('owner', 'admin') OR COALESCE((
               SELECT permission.can_view FROM space_channel_role_permissions permission
               WHERE permission.space_id = visible_channel.space_id
                 AND permission.chat_id = visible_channel.chat_id AND permission.role = sm.role
             ), true))
         )`,
      [spaceId.data, request.auth!.userId],
    )
    if (!result.rows[0]) {
      response.status(404).json({ error: { code: 'not_found', message: 'Space not found.' } })
      return
    }
    response.json({ space: result.rows[0] })
  } catch (error) {
    next(error)
  }
})

spaceRoutes.patch('/spaces/:id', async (request: AuthenticatedRequest, response, next) => {
  const spaceId = idSchema.safeParse(request.params.id)
  const input = z.object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(280),
    icon: z.enum(['layers', 'briefcase', 'rocket', 'heart', 'sparkles']),
  }).safeParse(request.body)
  if (!spaceId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Enter a valid Space name, description, and icon.' } })
    return
  }
  try {
    const result = await pool.query(
      `UPDATE spaces s SET name = $3, description = $4, icon = $5
       WHERE s.id = $1 AND EXISTS (
         SELECT 1 FROM space_members sm
         WHERE sm.space_id = s.id AND sm.user_id = $2 AND sm.role IN ('owner', 'admin')
       )
       RETURNING s.id, s.name, s.description, s.icon`,
      [spaceId.data, request.auth!.userId, input.data.name, input.data.description, input.data.icon],
    )
    if (!result.rows[0]) {
      const membership = await pool.query(
        `SELECT 1 FROM space_members WHERE space_id = $1 AND user_id = $2`,
        [spaceId.data, request.auth!.userId],
      )
      response.status(membership.rowCount ? 403 : 404).json({
        error: { code: membership.rowCount ? 'forbidden' : 'not_found', message: membership.rowCount ? 'Only Space owners and admins can edit Space details.' : 'Space not found.' },
      })
      return
    }
    response.json({ space: result.rows[0] })
  } catch (error) {
    next(error)
  }
})

spaceRoutes.post('/spaces/:id/channels', async (request: AuthenticatedRequest, response, next) => {
  const spaceId = idSchema.safeParse(request.params.id)
  const input = z.object({
    name: channelNameSchema,
    topic: z.string().trim().max(160).default(''),
    categoryId: idSchema.optional(),
    type: z.enum(['discussion', 'announcement', 'private', 'voice']).default('discussion'),
  }).safeParse(request.body)
  if (!spaceId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a valid channel name and type.' } })
    return
  }

  const client = await pool.connect()
  const channelId = uuidv7()
  try {
    await client.query('BEGIN')
    const space = await client.query<{ name: string; role: string }>(
      `SELECT s.name, sm.role FROM spaces s
       JOIN space_members sm ON sm.space_id = s.id AND sm.user_id = $2
       WHERE s.id = $1 FOR UPDATE OF s`,
      [spaceId.data, request.auth!.userId],
    )
    if (!space.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Space not found.' } })
      return
    }
    if (!['owner', 'admin'].includes(space.rows[0].role)) {
      await client.query('ROLLBACK')
      response.status(403).json({ error: { code: 'forbidden', message: 'Only Space owners and admins can create channels.' } })
      return
    }
    const category = input.data.categoryId
      ? await client.query<{ id: string }>(
        `SELECT id FROM space_channel_categories WHERE space_id = $1 AND id = $2`,
        [spaceId.data, input.data.categoryId],
      )
      : await client.query<{ id: string }>(
        `SELECT id FROM space_channel_categories WHERE space_id = $1 ORDER BY created_at, id LIMIT 1`,
        [spaceId.data],
      )
    if (!category.rows[0]) {
      await client.query('ROLLBACK')
      response.status(400).json({ error: { code: 'validation', message: 'Choose a channel category in this Space.' } })
      return
    }
    await client.query(
      `INSERT INTO chats (id, kind, title, created_by) VALUES ($1, 'channel', $2, $3)`,
      [channelId, `#${input.data.name}`, request.auth!.userId],
    )
    await client.query(
      `INSERT INTO space_channels (space_id, chat_id, name, channel_type, category_id, topic)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [spaceId.data, channelId, input.data.name, input.data.type, category.rows[0].id, input.data.topic],
    )
    await client.query(
      `INSERT INTO space_channel_role_permissions (space_id, chat_id, role, can_view, can_send, updated_by)
       SELECT $1, $2, target_role.role, true,
              $3 <> 'announcement' OR target_role.role = 'moderator', $4
       FROM (VALUES ('moderator'), ('member'), ('guest')) AS target_role(role)`,
      [spaceId.data, channelId, input.data.type, request.auth!.userId],
    )
    if (input.data.type === 'private') {
      await client.query(
        `INSERT INTO chat_members (chat_id, user_id, role)
         SELECT $1, user_id, CASE WHEN role = 'owner' THEN 'owner' ELSE 'admin' END
         FROM space_members WHERE space_id = $2 AND role IN ('owner', 'admin')`,
        [channelId, spaceId.data],
      )
    } else {
      await client.query(
        `INSERT INTO chat_members (chat_id, user_id, role)
         SELECT $1, user_id, CASE WHEN role = 'owner' THEN 'owner' ELSE 'member' END
         FROM space_members WHERE space_id = $2 AND role <> 'guest'`,
        [channelId, spaceId.data],
      )
    }
    await client.query('COMMIT')
    response.status(201).json({ channelId, name: input.data.name, type: input.data.type, categoryId: category.rows[0].id })
  } catch (error) {
    await client.query('ROLLBACK')
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      response.status(409).json({ error: { code: 'conflict', message: 'A channel with that name already exists.' } })
      return
    }
    next(error)
  } finally {
    client.release()
  }
})

spaceRoutes.post('/spaces/:id/categories', async (request: AuthenticatedRequest, response, next) => {
  const spaceId = idSchema.safeParse(request.params.id)
  const input = z.object({ name: z.string().trim().min(1).max(40) }).safeParse(request.body)
  if (!spaceId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Category names must be 1–40 characters.' } })
    return
  }
  try {
    const result = await pool.query(
      `INSERT INTO space_channel_categories (space_id, name, created_by)
       SELECT s.id, $3, $2
       FROM spaces s JOIN space_members sm ON sm.space_id = s.id AND sm.user_id = $2
       WHERE s.id = $1 AND sm.role IN ('owner', 'admin')
       RETURNING id, name`,
      [spaceId.data, request.auth!.userId, input.data.name],
    )
    if (!result.rows[0]) {
      const membership = await pool.query(
        `SELECT 1 FROM space_members WHERE space_id = $1 AND user_id = $2`,
        [spaceId.data, request.auth!.userId],
      )
      response.status(membership.rowCount ? 403 : 404).json({
        error: { code: membership.rowCount ? 'forbidden' : 'not_found', message: membership.rowCount ? 'Only Space owners and admins can create categories.' : 'Space not found.' },
      })
      return
    }
    response.status(201).json({ category: result.rows[0] })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      response.status(409).json({ error: { code: 'conflict', message: 'A category with that name already exists.' } })
      return
    }
    next(error)
  }
})

spaceRoutes.patch('/spaces/:spaceId/channels/:channelId', async (request: AuthenticatedRequest, response, next) => {
  const spaceId = idSchema.safeParse(request.params.spaceId)
  const channelId = idSchema.safeParse(request.params.channelId)
  const input = z.object({ topic: z.string().trim().max(160) }).safeParse(request.body)
  if (!spaceId.success || !channelId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Channel topics must be 160 characters or fewer.' } })
    return
  }
  try {
    const result = await pool.query(
      `UPDATE space_channels sc SET topic = $4
       FROM space_members sm
       WHERE sc.space_id = $1 AND sc.chat_id = $2
         AND sm.space_id = sc.space_id AND sm.user_id = $3
         AND sm.role IN ('owner', 'admin')
       RETURNING sc.chat_id AS id, sc.topic`,
      [spaceId.data, channelId.data, request.auth!.userId, input.data.topic],
    )
    if (!result.rows[0]) {
      const access = await pool.query(
        `SELECT sm.role FROM space_channels sc
         JOIN space_members sm ON sm.space_id = sc.space_id AND sm.user_id = $3
         WHERE sc.space_id = $1 AND sc.chat_id = $2`,
        [spaceId.data, channelId.data, request.auth!.userId],
      )
      response.status(access.rows[0] ? 403 : 404).json({
        error: { code: access.rows[0] ? 'forbidden' : 'not_found', message: access.rows[0] ? 'Only Space owners and admins can edit channel topics.' : 'Channel not found.' },
      })
      return
    }
    response.json({ channel: result.rows[0] })
  } catch (error) {
    next(error)
  }
})

spaceRoutes.patch('/spaces/:spaceId/channels/:channelId/permissions', async (request: AuthenticatedRequest, response, next) => {
  const spaceId = idSchema.safeParse(request.params.spaceId)
  const channelId = idSchema.safeParse(request.params.channelId)
  const input = z.object({
    permissions: z.array(z.object({
      role: z.enum(['moderator', 'member', 'guest']),
      can_view: z.boolean(),
      can_send: z.boolean(),
      can_speak: z.boolean(),
    })).length(3).refine((permissions) => {
      const roles = permissions.map((permission) => permission.role)
      return new Set(roles).size === 3
        && ['moderator', 'member', 'guest'].every((role) => roles.includes(role as typeof roles[number]))
        && permissions.every((permission) => permission.can_view || (!permission.can_send && !permission.can_speak))
    }),
  }).safeParse(request.body)
  if (!spaceId.success || !channelId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Set view and send permissions for moderator, member, and guest roles.' } })
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const access = await client.query<{ role: string }>(
      `SELECT sm.role
       FROM space_channels sc
       JOIN space_members sm ON sm.space_id = sc.space_id AND sm.user_id = $3
       WHERE sc.space_id = $1 AND sc.chat_id = $2
       FOR UPDATE OF sc`,
      [spaceId.data, channelId.data, request.auth!.userId],
    )
    if (!access.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Channel not found.' } })
      return
    }
    if (!['owner', 'admin'].includes(access.rows[0].role)) {
      await client.query('ROLLBACK')
      response.status(403).json({ error: { code: 'forbidden', message: 'Only Space owners and admins can manage channel permissions.' } })
      return
    }
    await client.query(
      `INSERT INTO space_channel_role_permissions
         (space_id, chat_id, role, can_view, can_send, can_speak, updated_by, updated_at)
       SELECT $1, $2, permission.role, permission.can_view, permission.can_send,
              permission.can_speak, $4, now()
       FROM jsonb_to_recordset($3::jsonb) AS permission(role text, can_view boolean, can_send boolean, can_speak boolean)
       ON CONFLICT (space_id, chat_id, role) DO UPDATE
       SET can_view = EXCLUDED.can_view, can_send = EXCLUDED.can_send,
           can_speak = EXCLUDED.can_speak,
           updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [spaceId.data, channelId.data, JSON.stringify(input.data.permissions), request.auth!.userId],
    )
    await client.query('COMMIT')
    response.json({ permissions: input.data.permissions })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

spaceRoutes.post('/spaces/:spaceId/channels/:channelId/voice/token', voiceLimiter, async (request: AuthenticatedRequest, response, next) => {
  const spaceId = idSchema.safeParse(request.params.spaceId)
  const channelId = idSchema.safeParse(request.params.channelId)
  if (!spaceId.success || !channelId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid voice channel.' } })
    return
  }
  try {
    const access = await pool.query<{ role: string; display_name: string; can_view: boolean; can_speak: boolean }>(
      `SELECT sm.role, u.display_name,
              sm.role IN ('owner', 'admin') OR COALESCE(permission.can_view, true) AS can_view,
              sm.role IN ('owner', 'admin') OR COALESCE(permission.can_speak, true) AS can_speak
       FROM space_channels sc
       JOIN space_members sm ON sm.space_id = sc.space_id AND sm.user_id = $3
       JOIN chat_members grant_member ON grant_member.chat_id = sc.chat_id
         AND grant_member.user_id = $3 AND grant_member.left_at IS NULL
       JOIN users u ON u.id = sm.user_id
       LEFT JOIN space_channel_role_permissions permission
         ON permission.space_id = sc.space_id AND permission.chat_id = sc.chat_id
           AND permission.role = sm.role
       WHERE sc.space_id = $1 AND sc.chat_id = $2 AND sc.channel_type = 'voice'`,
      [spaceId.data, channelId.data, request.auth!.userId],
    )
    if (!access.rows[0] || !access.rows[0].can_view) {
      response.status(404).json({ error: { code: 'not_found', message: 'Voice room not found.' } })
      return
    }
    const settings = liveKitSettings()
    if (!settings) {
      response.status(503).json({ error: { code: 'service_unavailable', message: 'Voice rooms are not configured on this server.' } })
      return
    }

    const roomName = voiceRoomName(channelId.data)
    const service = new RoomServiceClient(settings.url, settings.apiKey, settings.apiSecret)
    const rooms = await service.listRooms([roomName])
    if (!rooms.some((room) => room.name === roomName)) {
      try {
        await service.createRoom({ name: roomName, emptyTimeout: 60, maxParticipants: 16 })
      } catch (error) {
        const roomsAfterCreate = await service.listRooms([roomName])
        if (!roomsAfterCreate.some((room) => room.name === roomName)) throw error
      }
    }

    const token = new AccessToken(settings.apiKey, settings.apiSecret, {
      identity: request.auth!.userId,
      name: access.rows[0].display_name,
      ttl: '10m',
    })
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: access.rows[0].can_speak,
      canPublishSources: [TrackSource.MICROPHONE],
      canSubscribe: true,
      canPublishData: false,
    })
    response.json({
      url: settings.url,
      token: await token.toJwt(),
      canSpeak: access.rows[0].can_speak,
    })
  } catch (error) {
    next(error)
  }
})

spaceRoutes.get('/spaces/:spaceId/channels/:channelId/voice', voiceLimiter, async (request: AuthenticatedRequest, response, next) => {
  const spaceId = idSchema.safeParse(request.params.spaceId)
  const channelId = idSchema.safeParse(request.params.channelId)
  if (!spaceId.success || !channelId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid voice channel.' } })
    return
  }
  try {
    const access = await pool.query<{ can_view: boolean }>(
      `SELECT sm.role IN ('owner', 'admin') OR COALESCE(permission.can_view, true) AS can_view
       FROM space_channels sc
       JOIN space_members sm ON sm.space_id = sc.space_id AND sm.user_id = $3
       JOIN chat_members grant_member ON grant_member.chat_id = sc.chat_id
         AND grant_member.user_id = $3 AND grant_member.left_at IS NULL
       LEFT JOIN space_channel_role_permissions permission
         ON permission.space_id = sc.space_id AND permission.chat_id = sc.chat_id
           AND permission.role = sm.role
       WHERE sc.space_id = $1 AND sc.chat_id = $2 AND sc.channel_type = 'voice'`,
      [spaceId.data, channelId.data, request.auth!.userId],
    )
    const settings = liveKitSettings()
    const roomName = voiceRoomName(channelId.data)
    if (!access.rows[0]?.can_view) {
      if (settings) {
        const service = new RoomServiceClient(settings.url, settings.apiKey, settings.apiSecret)
        const rooms = await service.listRooms([roomName])
        if (!rooms.some((room) => room.name === roomName)) {
          response.status(404).json({ error: { code: 'not_found', message: 'Voice room not found.' } })
          return
        }
        try {
          await service.removeParticipant(roomName, request.auth!.userId, {
            revokeTokenTs: BigInt(Math.floor(Date.now() / 1000)),
          })
        } catch (error) {
          const currentRooms = await service.listRooms([roomName])
          if (currentRooms.some((room) => room.name === roomName)) throw error
        }
      }
      response.status(404).json({ error: { code: 'not_found', message: 'Voice room not found.' } })
      return
    }
    if (!settings) {
      response.status(503).json({ error: { code: 'service_unavailable', message: 'Voice rooms are not configured on this server.' } })
      return
    }
    const service = new RoomServiceClient(settings.url, settings.apiKey, settings.apiSecret)
    const rooms = await service.listRooms([roomName])
    if (!rooms.some((room) => room.name === roomName)) {
      response.json({ participants: [] })
      return
    }

    const participants = await service.listParticipants(roomName)
    const roster = await pool.query<{
      user_id: string
      display_name: string
      avatar_url: string | null
      can_speak: boolean
    }>(
      `SELECT cm.user_id, u.display_name, u.avatar_url,
              sm.role IN ('owner', 'admin') OR COALESCE(permission.can_speak, true) AS can_speak
       FROM chat_members cm
       JOIN space_channels sc ON sc.chat_id = cm.chat_id AND sc.space_id = $1
       JOIN space_members sm ON sm.space_id = sc.space_id AND sm.user_id = cm.user_id
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN space_channel_role_permissions permission
         ON permission.space_id = sc.space_id AND permission.chat_id = sc.chat_id
           AND permission.role = sm.role
       WHERE sc.chat_id = $2 AND cm.left_at IS NULL
         AND (sm.role IN ('owner', 'admin') OR COALESCE(permission.can_view, true))`,
      [spaceId.data, channelId.data],
    )
    const allowedUsers = new Map(roster.rows.map((member) => [member.user_id, member]))
    const visibleParticipants = []
    for (const participant of participants) {
      const member = allowedUsers.get(participant.identity)
      if (member) {
        if (participant.permission?.canPublish !== member.can_speak) {
          await service.updateParticipant(roomName, participant.identity, {
            permission: {
              canSubscribe: true,
              canPublish: member.can_speak,
              canPublishData: false,
              canPublishSources: member.can_speak ? [TrackSource.MICROPHONE] : [],
              hidden: false,
              recorder: false,
              canUpdateMetadata: false,
            },
          })
        }
        visibleParticipants.push({
          user_id: member.user_id,
          display_name: member.display_name,
          avatar_url: member.avatar_url,
          can_speak: member.can_speak,
        })
      } else {
        try {
          await service.removeParticipant(roomName, participant.identity, {
            revokeTokenTs: BigInt(Math.floor(Date.now() / 1000)),
          })
        } catch (error) {
          const currentRooms = await service.listRooms([roomName])
          if (currentRooms.some((room) => room.name === roomName)) throw error
        }
      }
    }
    response.json({ participants: visibleParticipants })
  } catch (error) {
    next(error)
  }
})

spaceRoutes.post('/spaces/:id/members', async (request: AuthenticatedRequest, response, next) => {
  const spaceId = idSchema.safeParse(request.params.id)
  const input = z.object({
    username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
    role: z.enum(['member', 'guest']),
    channels: z.array(idSchema).min(1).max(100).optional(),
  }).safeParse(request.body)
  if (!spaceId.success || !input.success || (input.data && new Set(input.data.channels ?? []).size !== (input.data.channels ?? []).length)) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a valid username, role, and channel list.' } })
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const space = await client.query<{ role: string }>(
      `SELECT role FROM space_members WHERE space_id = $1 AND user_id = $2 FOR UPDATE`,
      [spaceId.data, request.auth!.userId],
    )
    if (!space.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Space not found.' } })
      return
    }
    const allowed = input.data.role === 'guest'
      ? ['owner', 'admin', 'moderator'].includes(space.rows[0].role)
      : ['owner', 'admin'].includes(space.rows[0].role)
    if (!allowed) {
      await client.query('ROLLBACK')
      response.status(403).json({ error: { code: 'forbidden', message: 'You cannot invite this role to the Space.' } })
      return
    }
    const target = await client.query<{ id: string; username: string; display_name: string }>(
      `SELECT id, username, display_name FROM users
       WHERE username = lower($1) AND id <> $2 AND discoverable AND deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM contacts blocked WHERE blocked.state = 'blocked'
             AND ((blocked.user_id = users.id AND blocked.contact_id = $2)
               OR (blocked.user_id = $2 AND blocked.contact_id = users.id))
         )`,
      [input.data.username, request.auth!.userId],
    )
    if (!target.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Discoverable user not found.' } })
      return
    }
    const channelResult = await client.query<{ chat_id: string; channel_type: string }>(
      `SELECT sc.chat_id, sc.channel_type FROM space_channels sc
       JOIN chat_members grant_member ON grant_member.chat_id = sc.chat_id
         AND grant_member.user_id = $3 AND grant_member.left_at IS NULL
       WHERE sc.space_id = $1 AND ($2::uuid[] IS NULL OR sc.chat_id = ANY($2::uuid[]))
       ORDER BY sc.created_at, sc.chat_id FOR UPDATE OF grant_member`,
      [spaceId.data, input.data.channels ?? null, request.auth!.userId],
    )
    if (input.data.channels && channelResult.rowCount !== input.data.channels.length) {
      await client.query('ROLLBACK')
      response.status(400).json({ error: { code: 'validation', message: 'One or more selected channels do not belong to this Space.' } })
      return
    }
    if (space.rows[0].role === 'moderator' && channelResult.rows.some((channel) => channel.channel_type === 'private')) {
      await client.query('ROLLBACK')
      response.status(403).json({ error: { code: 'forbidden', message: 'Only Space owners and admins can grant access to private channels.' } })
      return
    }
    const added = await client.query(
      `INSERT INTO space_members (space_id, user_id, role)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING user_id`,
      [spaceId.data, target.rows[0].id, input.data.role],
    )
    if (!added.rowCount) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: { code: 'conflict', message: 'This person is already a Space member.' } })
      return
    }
    const selectedChannels = input.data.channels ?? channelResult.rows
      .filter((channel) => input.data.role === 'guest'
        ? channel.channel_type === 'discussion'
        : channel.channel_type !== 'private')
      .map((channel) => channel.chat_id)
    if (selectedChannels.length) {
      await client.query(
        `INSERT INTO chat_members (chat_id, user_id, role)
         SELECT channel_id, $2, 'member' FROM unnest($1::uuid[]) AS channel_id`,
        [selectedChannels, target.rows[0].id],
      )
    }
    await client.query('COMMIT')
    response.status(201).json({ userId: target.rows[0].id, username: target.rows[0].username, role: input.data.role })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

spaceRoutes.get('/spaces/:spaceId/channels/:channelId/messages', async (request: AuthenticatedRequest, response, next) => {
  const spaceId = idSchema.safeParse(request.params.spaceId)
  const channelId = idSchema.safeParse(request.params.channelId)
  const before = request.query.before_seq === undefined
    ? { success: true as const, data: undefined }
    : z.coerce.number().int().min(1).safeParse(request.query.before_seq)
  if (!spaceId.success || !channelId.success || !before.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid channel history cursor.' } })
    return
  }
  const limit = z.coerce.number().int().min(1).max(100).default(50).safeParse(request.query.limit)
  if (!limit.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid channel history limit.' } })
    return
  }
  try {
    const result = await pool.query(
      `SELECT m.id, m.chat_id, m.server_seq, m.sender_id, u.display_name, u.username,
              m.body, m.created_at,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', mentioned_user.id, 'username', mentioned_user.username,
                  'display_name', mentioned_user.display_name
                ) ORDER BY lower(mentioned_user.username))
                FROM channel_message_mentions mention
                JOIN users mentioned_user ON mentioned_user.id = mention.mentioned_user_id
                WHERE mention.message_id = m.id AND mention.mentioned_user_id IS NOT NULL
              ), '[]'::jsonb) AS mentions,
              EXISTS (
                SELECT 1 FROM channel_message_mentions everyone
                WHERE everyone.message_id = m.id AND everyone.is_everyone
              ) AS everyone_mentioned,
              EXISTS (
                SELECT 1 FROM channel_message_mentions own_mention
                WHERE own_mention.message_id = m.id
                  AND (own_mention.mentioned_user_id = $2
                    OR (own_mention.is_everyone AND m.sender_id <> $2))
              ) AS is_mentioned
              ,(SELECT shared_object.id FROM channel_shared_objects shared_object
                WHERE shared_object.message_id = m.id) AS shared_object_id
       FROM channel_messages m
       JOIN users u ON u.id = m.sender_id
       JOIN space_channels sc ON sc.chat_id = m.chat_id AND sc.space_id = $1
       JOIN space_members sm ON sm.space_id = sc.space_id AND sm.user_id = $2
       JOIN chat_members grant_member ON grant_member.chat_id = sc.chat_id
         AND grant_member.user_id = $2 AND grant_member.left_at IS NULL
       WHERE m.chat_id = $3 AND sc.channel_type <> 'voice'
         AND ($4::bigint IS NULL OR m.server_seq < $4)
         AND (sm.role IN ('owner', 'admin') OR COALESCE((
           SELECT permission.can_view FROM space_channel_role_permissions permission
           WHERE permission.space_id = sc.space_id AND permission.chat_id = sc.chat_id
             AND permission.role = sm.role
         ), true))
       ORDER BY m.server_seq DESC LIMIT $5`,
      [spaceId.data, request.auth!.userId, channelId.data, before.data ?? null, limit.data],
    )
    const channelExists = await pool.query(
      `SELECT 1 FROM space_channels sc
       JOIN space_members sm ON sm.space_id = sc.space_id AND sm.user_id = $2
       JOIN chat_members grant_member ON grant_member.chat_id = sc.chat_id
         AND grant_member.user_id = $2 AND grant_member.left_at IS NULL
       WHERE sc.space_id = $1 AND sc.chat_id = $3 AND sc.channel_type <> 'voice'
         AND (sm.role IN ('owner', 'admin') OR COALESCE((
           SELECT permission.can_view FROM space_channel_role_permissions permission
           WHERE permission.space_id = sc.space_id AND permission.chat_id = sc.chat_id
             AND permission.role = sm.role
         ), true))`,
      [spaceId.data, request.auth!.userId, channelId.data],
    )
    if (!channelExists.rowCount) {
      response.status(404).json({ error: { code: 'not_found', message: 'Channel not found.' } })
      return
    }
    response.json({ messages: result.rows.reverse() })
  } catch (error) {
    next(error)
  }
})

spaceRoutes.post('/spaces/:spaceId/channels/:channelId/messages', messageLimiter, async (request: AuthenticatedRequest, response, next) => {
  const spaceId = idSchema.safeParse(request.params.spaceId)
  const channelId = idSchema.safeParse(request.params.channelId)
  const input = z.object({ body: z.string().trim().min(1).max(8000) }).safeParse(request.body)
  if (!spaceId.success || !channelId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Enter a message up to 8,000 characters.' } })
    return
  }
  const client = await pool.connect()
  const messageId = uuidv7()
  try {
    await client.query('BEGIN')
    const channel = await client.query<{
      chat_id: string
      role: string
      can_view: boolean
      can_send: boolean
      channel_type: string
    }>(
      `SELECT sc.chat_id, sc.channel_type, sm.role,
              sm.role IN ('owner', 'admin') OR COALESCE(permission.can_view, true) AS can_view,
              sm.role IN ('owner', 'admin') OR COALESCE(
                permission.can_send,
                sc.channel_type <> 'announcement' OR sm.role = 'moderator'
              ) AS can_send
       FROM space_channels sc
       JOIN space_members sm ON sm.space_id = sc.space_id AND sm.user_id = $2
       JOIN chat_members grant_member ON grant_member.chat_id = sc.chat_id
         AND grant_member.user_id = $2 AND grant_member.left_at IS NULL
       LEFT JOIN space_channel_role_permissions permission
         ON permission.space_id = sc.space_id AND permission.chat_id = sc.chat_id
           AND permission.role = sm.role
       WHERE sc.space_id = $1 AND sc.chat_id = $3
       FOR UPDATE OF sc, grant_member`,
      [spaceId.data, request.auth!.userId, channelId.data],
    )
    if (!channel.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Channel not found.' } })
      return
    }
    if (channel.rows[0].channel_type === 'voice') {
      await client.query('ROLLBACK')
      response.status(400).json({ error: { code: 'validation', message: 'Voice channels do not support text messages.' } })
      return
    }
    if (!channel.rows[0].can_view) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Channel not found.' } })
      return
    }
    if (!channel.rows[0].can_send) {
      await client.query('ROLLBACK')
      response.status(403).json({ error: { code: 'forbidden', message: 'You do not have permission to send messages in this channel.' } })
      return
    }
    const usernames = [...input.data.body.matchAll(mentionPattern)].map((match) => match[1].toLowerCase())
    const mentionEveryone = /(?:^|[^\w@])@everyone(?![a-zA-Z0-9_])/iu.test(input.data.body)
    if (mentionEveryone && !['owner', 'admin', 'moderator'].includes(channel.rows[0].role)) {
      await client.query('ROLLBACK')
      response.status(403).json({ error: { code: 'forbidden', message: 'Only Space owners, admins, and moderators can mention everyone.' } })
      return
    }
    const mentionedUsers = usernames.length || mentionEveryone
      ? await client.query<{ user_id: string }>(
        `SELECT DISTINCT cm.user_id
         FROM chat_members cm
         JOIN users mentioned_user ON mentioned_user.id = cm.user_id
         JOIN space_members member_role ON member_role.space_id = $1 AND member_role.user_id = cm.user_id
         LEFT JOIN space_channel_role_permissions permission
           ON permission.space_id = $1 AND permission.chat_id = $2
             AND permission.role = member_role.role
         WHERE cm.chat_id = $2 AND cm.left_at IS NULL AND cm.user_id <> $3
           AND ($4::boolean OR lower(mentioned_user.username) = ANY($5::text[]))
           AND (member_role.role IN ('owner', 'admin') OR COALESCE(permission.can_view, true))`,
        [spaceId.data, channelId.data, request.auth!.userId, mentionEveryone, usernames],
      )
      : { rows: [] as { user_id: string }[] }
    const mentionUserIds = mentionedUsers.rows.map((user) => user.user_id)
    const sequence = await client.query<{ last_seq: string }>(
      `UPDATE chats SET last_seq = last_seq + 1, last_message_at = now()
       WHERE id = $1 RETURNING last_seq`,
      [channel.rows[0].chat_id],
    )
    await client.query(
      `INSERT INTO channel_messages (id, chat_id, server_seq, sender_id, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [messageId, channel.rows[0].chat_id, sequence.rows[0].last_seq, request.auth!.userId, input.data.body],
    )
    if (mentionUserIds.length) {
      await client.query(
        `INSERT INTO channel_message_mentions (message_id, mentioned_user_id)
         SELECT $1, mentioned_user_id FROM unnest($2::uuid[]) AS mentioned_user_id`,
        [messageId, mentionUserIds],
      )
    }
    if (mentionEveryone) {
      await client.query(
        `INSERT INTO channel_message_mentions (message_id, mentioned_user_id, is_everyone)
         VALUES ($1, NULL, true)`,
        [messageId],
      )
    }
    await client.query('COMMIT')
    await publishChatEvent(channel.rows[0].chat_id, {
      type: 'channel.message',
      data: { id: messageId, serverSeq: sequence.rows[0].last_seq },
    })
    if (mentionUserIds.length) {
      await publishChatEvent(channel.rows[0].chat_id, {
        type: 'channel.mention',
        data: { chatId: channel.rows[0].chat_id, messageId, serverSeq: sequence.rows[0].last_seq },
      }, undefined, mentionUserIds)
    }
    response.status(201).json({ messageId, serverSeq: sequence.rows[0].last_seq })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})
