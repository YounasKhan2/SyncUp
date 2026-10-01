import { Router } from 'express'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { pool } from '../../db.js'
import type { AuthenticatedRequest } from '../auth/types.js'
import { publishChatEvent } from '../realtime/routes.js'
import { messageLimiter } from '../messaging/limits.js'

export const spaceRoutes = Router()

const idSchema = z.uuid()
const channelNameSchema = z.string().trim().toLowerCase().min(1).max(40).regex(/^[a-z0-9][a-z0-9-]*$/)

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
                  'category_id', category.id, 'category_name', category.name, 'topic', sc.topic
                ) ORDER BY sc.created_at, sc.chat_id)
                FROM space_channels sc
                JOIN space_channel_categories category
                  ON category.space_id = sc.space_id AND category.id = sc.category_id
                JOIN chat_members grant_member ON grant_member.chat_id = sc.chat_id
                  AND grant_member.user_id = $2 AND grant_member.left_at IS NULL
                WHERE sc.space_id = s.id
              ), '[]'::jsonb) AS channels,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', category.id, 'name', category.name)
                  ORDER BY category.created_at, category.id)
                FROM space_channel_categories category
                WHERE category.space_id = s.id AND (
                  sm.role <> 'guest' OR EXISTS (
                    SELECT 1 FROM space_channels visible_channel
                    JOIN chat_members grant_member ON grant_member.chat_id = visible_channel.chat_id
                      AND grant_member.user_id = $2 AND grant_member.left_at IS NULL
                    WHERE visible_channel.space_id = s.id AND visible_channel.category_id = category.id
                  )
                )
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
    type: z.enum(['discussion', 'announcement', 'private']).default('discussion'),
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
              m.body, m.created_at
       FROM channel_messages m
       JOIN users u ON u.id = m.sender_id
       JOIN space_channels sc ON sc.chat_id = m.chat_id AND sc.space_id = $1
       JOIN chat_members grant_member ON grant_member.chat_id = sc.chat_id
         AND grant_member.user_id = $2 AND grant_member.left_at IS NULL
       WHERE m.chat_id = $3 AND ($4::bigint IS NULL OR m.server_seq < $4)
       ORDER BY m.server_seq DESC LIMIT $5`,
      [spaceId.data, request.auth!.userId, channelId.data, before.data ?? null, limit.data],
    )
    const channelExists = await pool.query(
      `SELECT 1 FROM space_channels sc
       JOIN space_members sm ON sm.space_id = sc.space_id AND sm.user_id = $2
       JOIN chat_members grant_member ON grant_member.chat_id = sc.chat_id
         AND grant_member.user_id = $2 AND grant_member.left_at IS NULL
       WHERE sc.space_id = $1 AND sc.chat_id = $3`,
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
    const channel = await client.query<{ chat_id: string; role: string; channel_type: string }>(
      `SELECT sc.chat_id, sm.role, sc.channel_type
       FROM space_channels sc
       JOIN space_members sm ON sm.space_id = sc.space_id AND sm.user_id = $2
       JOIN chat_members grant_member ON grant_member.chat_id = sc.chat_id
         AND grant_member.user_id = $2 AND grant_member.left_at IS NULL
       WHERE sc.space_id = $1 AND sc.chat_id = $3
       FOR UPDATE OF grant_member`,
      [spaceId.data, request.auth!.userId, channelId.data],
    )
    if (!channel.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Channel not found.' } })
      return
    }
    if (channel.rows[0].channel_type === 'announcement'
      && !['owner', 'admin', 'moderator'].includes(channel.rows[0].role)) {
      await client.query('ROLLBACK')
      response.status(403).json({ error: { code: 'forbidden', message: 'Only Space moderators can post in announcement channels.' } })
      return
    }
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
    await client.query('COMMIT')
    await publishChatEvent(channel.rows[0].chat_id, {
      type: 'channel.message',
      data: { id: messageId, serverSeq: sequence.rows[0].last_seq },
    })
    response.status(201).json({ messageId, serverSeq: sequence.rows[0].last_seq })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})
