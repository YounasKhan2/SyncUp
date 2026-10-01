import { Router } from 'express'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { pool } from '../../db.js'
import type { AuthenticatedRequest } from '../auth/types.js'
import { publishChatEvent } from '../realtime/routes.js'

export const spaceObjectRoutes = Router()

const uuid = z.uuid()
const pollSchema = z.object({
  type: z.literal('poll'),
  question: z.string().trim().min(1).max(240),
  options: z.array(z.string().trim().min(1).max(100)).min(2).max(8),
  multiSelect: z.boolean().default(false),
  closesAt: z.iso.datetime().nullable().default(null),
  anonymous: z.boolean().default(false),
})
const eventSchema = z.object({
  type: z.literal('event'),
  title: z.string().trim().min(1).max(160),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable().default(null),
  timezone: z.string().trim().min(1).max(80),
  locationText: z.string().trim().max(240).default(''),
  rsvpRequired: z.boolean().default(true),
})
const checklistSchema = z.object({
  type: z.literal('checklist'),
  title: z.string().trim().min(1).max(160),
  items: z.array(z.object({
    text: z.string().trim().min(1).max(240),
    assigneeId: z.uuid().nullable().default(null),
    dueAt: z.iso.datetime().nullable().default(null),
  })).min(1).max(30),
})
const createSchema = z.discriminatedUnion('type', [pollSchema, eventSchema, checklistSchema])

type SharedObject = {
  id: string
  chat_id: string
  message_id: string
  object_type: 'poll' | 'event' | 'checklist' | 'decision'
  title: string
  state: string
  payload: Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
  terminal_at: string | null
  channel_name: string
  space_id: string
  space_name: string
  message_seq: string
  my_response: Record<string, unknown> | null
  response_counts: Record<string, number> | null
}

async function authorizeChannel(userId: string, spaceId: string, channelId: string, requireSend = false) {
  const result = await pool.query<{ chat_id: string; role: string; can_view: boolean; can_send: boolean }>(
    `SELECT sc.chat_id, sm.role,
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
     WHERE sc.space_id = $1 AND sc.chat_id = $3 AND sc.channel_type <> 'voice'
       AND (sm.role IN ('owner', 'admin') OR COALESCE(permission.can_view, true))
     LIMIT 1`,
    [spaceId, userId, channelId],
  )
  const channel = result.rows[0]
  if (!channel) return { error: 'not_found' as const }
  if (requireSend && !channel.can_send) return { error: 'forbidden' as const }
  return { channel }
}

const objectFields = `o.id, o.chat_id, o.message_id, o.object_type, o.title, o.state, o.payload,
  o.created_by, o.created_at, o.updated_at, o.terminal_at, sc.name AS channel_name,
  s.id AS space_id, s.name AS space_name, m.server_seq AS message_seq,
  own.response AS my_response,
  COALESCE((
    SELECT jsonb_object_agg(response_key, response_count)
    FROM (
      SELECT response_key, count(*)::int AS response_count
      FROM channel_shared_object_responses r
      CROSS JOIN LATERAL (
        SELECT selected_option.option_id AS response_key
        FROM jsonb_array_elements_text(COALESCE(r.response->'optionIds', '[]'::jsonb))
          AS selected_option(option_id)
        WHERE o.object_type = 'poll'
        UNION ALL
        SELECT r.response->>'rsvp' AS response_key
        WHERE o.object_type = 'event' AND r.response ? 'rsvp'
      ) responses
      WHERE r.object_id = o.id
      GROUP BY response_key
    ) counts
  ), '{}'::jsonb) AS response_counts`

const visibleObjectJoin = `JOIN space_channels sc ON sc.chat_id = o.chat_id
  JOIN spaces s ON s.id = sc.space_id
  JOIN space_members sm ON sm.space_id = s.id AND sm.user_id = $1
  JOIN chat_members grant_member ON grant_member.chat_id = sc.chat_id
    AND grant_member.user_id = $1 AND grant_member.left_at IS NULL
  JOIN channel_messages m ON m.id = o.message_id
  LEFT JOIN channel_shared_object_responses own ON own.object_id = o.id AND own.user_id = $1
  LEFT JOIN space_channel_role_permissions permission ON permission.space_id = sc.space_id
    AND permission.chat_id = sc.chat_id AND permission.role = sm.role
  WHERE (sm.role IN ('owner', 'admin') OR COALESCE(permission.can_view, true))`

async function listChannelObjects(userId: string, spaceId: string, channelId: string) {
  const result = await pool.query<SharedObject>(
    `SELECT ${objectFields}
     FROM channel_shared_objects o
     ${visibleObjectJoin}
       AND sc.space_id = $2 AND sc.chat_id = $3
     ORDER BY m.server_seq`,
    [userId, spaceId, channelId],
  )
  return result.rows
}

spaceObjectRoutes.get('/spaces/:spaceId/channels/:channelId/objects', async (request: AuthenticatedRequest, response, next) => {
  const spaceId = uuid.safeParse(request.params.spaceId)
  const channelId = uuid.safeParse(request.params.channelId)
  if (!spaceId.success || !channelId.success) {
    response.status(404).json({ error: { code: 'not_found', message: 'Channel not found.' } })
    return
  }
  try {
    const access = await authorizeChannel(request.auth!.userId, spaceId.data, channelId.data)
    if ('error' in access) {
      response.status(access.error === 'forbidden' ? 403 : 404).json({ error: { code: access.error, message: 'Channel not found.' } })
      return
    }
    response.json({ objects: await listChannelObjects(request.auth!.userId, spaceId.data, channelId.data) })
  } catch (error) {
    next(error)
  }
})

spaceObjectRoutes.post('/spaces/:spaceId/channels/:channelId/objects', async (request: AuthenticatedRequest, response, next) => {
  const spaceId = uuid.safeParse(request.params.spaceId)
  const channelId = uuid.safeParse(request.params.channelId)
  const input = createSchema.safeParse(request.body)
  if (!spaceId.success || !channelId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Check the shared item details and try again.' } })
    return
  }
  const access = await authorizeChannel(request.auth!.userId, spaceId.data, channelId.data, true)
  if ('error' in access) {
    response.status(access.error === 'forbidden' ? 403 : 404).json({ error: { code: access.error, message: access.error === 'forbidden' ? 'You cannot post in this channel.' : 'Channel not found.' } })
    return
  }
  const { type } = input.data
  let title: string
  let payload: Record<string, unknown>
  if (type === 'poll') {
    if (new Set(input.data.options.map((option) => option.toLocaleLowerCase())).size !== input.data.options.length) {
      response.status(400).json({ error: { code: 'validation', message: 'Poll options must be unique.' } })
      return
    }
    if (input.data.closesAt && Date.parse(input.data.closesAt) <= Date.now()) {
      response.status(400).json({ error: { code: 'validation', message: 'Choose a future poll closing time.' } })
      return
    }
    title = input.data.question
    payload = {
      question: title,
      options: input.data.options.map((text) => ({ id: uuidv7(), text })),
      multiSelect: input.data.multiSelect,
      closesAt: input.data.closesAt,
      anonymous: input.data.anonymous,
    }
  } else if (type === 'event') {
    if (input.data.endsAt && Date.parse(input.data.endsAt) <= Date.parse(input.data.startsAt)) {
      response.status(400).json({ error: { code: 'validation', message: 'The end time must be after the start time.' } })
      return
    }
    try {
      new Intl.DateTimeFormat('en', { timeZone: input.data.timezone })
    } catch {
      response.status(400).json({ error: { code: 'validation', message: 'Choose a valid timezone.' } })
      return
    }
    title = input.data.title
    payload = {
      startsAt: input.data.startsAt,
      endsAt: input.data.endsAt,
      timezone: input.data.timezone,
      locationText: input.data.locationText,
      rsvpRequired: input.data.rsvpRequired,
    }
  } else {
    const assigneeIds = [...new Set(input.data.items.map((item) => item.assigneeId).filter((id): id is string => Boolean(id)))]
    if (assigneeIds.length) {
      const allowedAssignees = await pool.query<{ user_id: string }>(
        `SELECT cm.user_id FROM chat_members cm
         JOIN space_members member_role ON member_role.space_id = $1 AND member_role.user_id = cm.user_id
         LEFT JOIN space_channel_role_permissions permission
           ON permission.space_id = $1 AND permission.chat_id = $2 AND permission.role = member_role.role
         WHERE cm.chat_id = $2 AND cm.user_id = ANY($3::uuid[]) AND cm.left_at IS NULL
           AND (member_role.role IN ('owner', 'admin') OR COALESCE(permission.can_view, true))`,
        [spaceId.data, channelId.data, assigneeIds],
      )
      if (allowedAssignees.rowCount !== assigneeIds.length) {
        response.status(400).json({ error: { code: 'validation', message: 'Checklist assignees must be members who can view this channel.' } })
        return
      }
    }
    title = input.data.title
    payload = {
      items: input.data.items.map((item) => ({ id: uuidv7(), ...item, done: false })),
    }
  }
  const objectId = uuidv7()
  const messageId = uuidv7()
  try {
    const client = await pool.connect()
    let serverSeq: string
    try {
      await client.query('BEGIN')
      const sequence = await client.query<{ last_seq: string }>(
        `UPDATE chats SET last_seq = last_seq + 1, last_message_at = now()
         WHERE id = $1 RETURNING last_seq`,
        [channelId.data],
      )
      if (!sequence.rowCount) throw new Error('Channel message sequence could not be allocated.')
      serverSeq = sequence.rows[0].last_seq
      const body = type === 'poll' ? `Poll: ${title}` : type === 'event' ? `Event: ${title}` : `Checklist: ${title}`
      await client.query(
        `INSERT INTO channel_messages (id, chat_id, server_seq, sender_id, body)
         VALUES ($1, $2, $3, $4, $5)`,
        [messageId, channelId.data, serverSeq, request.auth!.userId, body],
      )
      await client.query(
        `INSERT INTO channel_shared_objects (id, chat_id, message_id, object_type, title, state, payload, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
        [objectId, channelId.data, messageId, type, title,
          type === 'event' ? (Date.parse(String(payload.startsAt)) <= Date.now() ? 'active' : 'scheduled') : 'open',
          JSON.stringify(payload), request.auth!.userId],
      )
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
    await publishChatEvent(channelId.data, { type: 'channel.message', data: { id: messageId, serverSeq } })
    response.status(201).json({ objectId, messageId, serverSeq })
  } catch (error) {
    next(error)
  }
})

spaceObjectRoutes.post('/spaces/:spaceId/channels/:channelId/messages/:messageId/decision', async (request: AuthenticatedRequest, response, next) => {
  const spaceId = uuid.safeParse(request.params.spaceId)
  const channelId = uuid.safeParse(request.params.channelId)
  const messageId = uuid.safeParse(request.params.messageId)
  const input = z.object({ title: z.string().trim().min(1).max(160) }).safeParse(request.body)
  if (!spaceId.success || !channelId.success || !messageId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Enter a decision title up to 160 characters.' } })
    return
  }
  try {
    const access = await authorizeChannel(request.auth!.userId, spaceId.data, channelId.data)
    if ('error' in access) {
      response.status(404).json({ error: { code: 'not_found', message: 'Channel not found.' } })
      return
    }
    if (!['owner', 'admin', 'moderator'].includes(access.channel.role)) {
      response.status(403).json({ error: { code: 'forbidden', message: 'Only Space moderators can pin a decision.' } })
      return
    }
    const source = await pool.query<{ body: string }>(
      `SELECT body FROM channel_messages WHERE id = $1 AND chat_id = $2`,
      [messageId.data, channelId.data],
    )
    if (!source.rows[0]) {
      response.status(404).json({ error: { code: 'not_found', message: 'Message not found in this channel.' } })
      return
    }
    const objectId = uuidv7()
    await pool.query(
      `INSERT INTO channel_shared_objects (id, chat_id, message_id, object_type, title, state, payload, created_by)
       VALUES ($1, $2, $3, 'decision', $4, 'active', $5::jsonb, $6)`,
      [objectId, channelId.data, messageId.data, input.data.title, JSON.stringify({ quote: source.rows[0].body }), request.auth!.userId],
    )
    await publishChatEvent(channelId.data, { type: 'channel.object', data: { id: objectId, messageId: messageId.data } })
    response.status(201).json({ objectId, messageId: messageId.data })
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      response.status(409).json({ error: { code: 'conflict', message: 'This message is already pinned as a decision.' } })
      return
    }
    next(error)
  }
})

spaceObjectRoutes.post('/spaces/:spaceId/channels/:channelId/objects/:objectId/respond', async (request: AuthenticatedRequest, response, next) => {
  const spaceId = uuid.safeParse(request.params.spaceId)
  const channelId = uuid.safeParse(request.params.channelId)
  const objectId = uuid.safeParse(request.params.objectId)
  const input = z.discriminatedUnion('type', [
    z.object({ type: z.literal('poll'), optionIds: z.array(z.uuid()).min(1).max(8) }),
    z.object({ type: z.literal('event'), rsvp: z.enum(['yes', 'no', 'maybe']) }),
    z.object({ type: z.literal('checklist'), itemId: z.uuid(), done: z.boolean() }),
  ]).safeParse(request.body)
  if (!spaceId.success || !channelId.success || !objectId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Your response could not be saved. Check the selection and try again.' } })
    return
  }
  try {
    const access = await authorizeChannel(request.auth!.userId, spaceId.data, channelId.data, true)
    if ('error' in access) {
      response.status(access.error === 'forbidden' ? 403 : 404).json({ error: { code: access.error, message: 'You cannot respond in this channel.' } })
      return
    }
    const client = await pool.connect()
    let messageId: string
    try {
      await client.query('BEGIN')
      const result = await client.query<{
        message_id: string
        object_type: string
        state: string
        payload: Record<string, unknown>
      }>(
        `SELECT message_id, object_type, state, payload
         FROM channel_shared_objects
         WHERE id = $1 AND chat_id = $2
         FOR UPDATE`,
        [objectId.data, channelId.data],
      )
      const object = result.rows[0]
      if (!object) {
        await client.query('ROLLBACK')
        response.status(404).json({ error: { code: 'not_found', message: 'Shared item not found.' } })
        return
      }
      messageId = object.message_id
      let responseValue: Record<string, unknown>
      if (input.data.type === 'poll' && object.object_type === 'poll') {
        if (object.state !== 'open' || (object.payload.closesAt && Date.parse(String(object.payload.closesAt)) <= Date.now())) {
          await client.query('ROLLBACK')
          response.status(409).json({ error: { code: 'conflict', message: 'This poll is closed.' } })
          return
        }
        const options = object.payload.options as { id: string }[]
        if (!input.data.optionIds.every((id) => options.some((option) => option.id === id))
          || (!object.payload.multiSelect && input.data.optionIds.length !== 1)) {
          await client.query('ROLLBACK')
          response.status(400).json({ error: { code: 'validation', message: 'Choose a valid poll option.' } })
          return
        }
        responseValue = { optionIds: [...new Set(input.data.optionIds)] }
      } else if (input.data.type === 'event' && object.object_type === 'event') {
        if (object.state === 'cancelled' || object.state === 'ended') {
          await client.query('ROLLBACK')
          response.status(409).json({ error: { code: 'conflict', message: 'This event is no longer accepting RSVPs.' } })
          return
        }
        responseValue = { rsvp: input.data.rsvp }
      } else if (input.data.type === 'checklist' && object.object_type === 'checklist') {
        const checklistResponse = input.data
        const items = object.payload.items as { id: string; done: boolean; assigneeId?: string | null }[]
        const item = items.find((candidate) => candidate.id === checklistResponse.itemId)
        if (!item) {
          await client.query('ROLLBACK')
          response.status(404).json({ error: { code: 'not_found', message: 'Checklist item not found.' } })
          return
        }
        if (item.assigneeId && item.assigneeId !== request.auth!.userId && !['owner', 'admin', 'moderator'].includes(access.channel.role)) {
          await client.query('ROLLBACK')
          response.status(403).json({ error: { code: 'forbidden', message: 'Only the assignee or a moderator can update this item.' } })
          return
        }
        item.done = checklistResponse.done
        const completed = items.every((candidate) => candidate.done)
        await client.query(
          `UPDATE channel_shared_objects SET payload = $2::jsonb, state = $3,
             terminal_at = CASE WHEN $3 = 'completed' THEN now() ELSE NULL END, updated_at = now()
           WHERE id = $1`,
          [objectId.data, JSON.stringify({ ...object.payload, items }), completed ? 'completed' : 'open'],
        )
        responseValue = { checklistUpdated: true }
      } else {
        await client.query('ROLLBACK')
        response.status(400).json({ error: { code: 'validation', message: 'That response does not match this shared item.' } })
        return
      }
      if (input.data.type !== 'checklist') {
        await client.query(
          `INSERT INTO channel_shared_object_responses (object_id, user_id, response)
           VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (object_id, user_id)
           DO UPDATE SET response = EXCLUDED.response, updated_at = now()`,
          [objectId.data, request.auth!.userId, JSON.stringify(responseValue)],
        )
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
    await publishChatEvent(channelId.data, { type: 'channel.object', data: { id: objectId.data, messageId } })
    response.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

spaceObjectRoutes.patch('/spaces/:spaceId/channels/:channelId/objects/:objectId/state', async (request: AuthenticatedRequest, response, next) => {
  const spaceId = uuid.safeParse(request.params.spaceId)
  const channelId = uuid.safeParse(request.params.channelId)
  const objectId = uuid.safeParse(request.params.objectId)
  const input = z.object({ state: z.enum(['closed', 'cancelled', 'unpinned']) }).safeParse(request.body)
  if (!spaceId.success || !channelId.success || !objectId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a valid shared-item action.' } })
    return
  }
  try {
    const access = await authorizeChannel(request.auth!.userId, spaceId.data, channelId.data)
    if ('error' in access) {
      response.status(404).json({ error: { code: 'not_found', message: 'Shared item not found.' } })
      return
    }
    const result = await pool.query<{ message_id: string; object_type: string; created_by: string; state: string }>(
      `SELECT message_id, object_type, created_by, state FROM channel_shared_objects
       WHERE id = $1 AND chat_id = $2`,
      [objectId.data, channelId.data],
    )
    const object = result.rows[0]
    if (!object) {
      response.status(404).json({ error: { code: 'not_found', message: 'Shared item not found.' } })
      return
    }
    const canManage = ['owner', 'admin', 'moderator'].includes(access.channel.role)
      || (object.created_by === request.auth!.userId && object.object_type !== 'decision')
    if (!canManage) {
      response.status(403).json({ error: { code: 'forbidden', message: 'You cannot change this shared item.' } })
      return
    }
    const allowed = (object.object_type === 'poll' && input.data.state === 'closed')
      || (object.object_type === 'event' && input.data.state === 'cancelled')
      || (object.object_type === 'decision' && input.data.state === 'unpinned')
    if (!allowed || object.state === input.data.state) {
      response.status(409).json({ error: { code: 'conflict', message: 'This shared item cannot make that state change.' } })
      return
    }
    await pool.query(
      `UPDATE channel_shared_objects SET state = $2, terminal_at = now(), updated_at = now()
       WHERE id = $1`,
      [objectId.data, input.data.state],
    )
    await publishChatEvent(channelId.data, { type: 'channel.object', data: { id: objectId.data, messageId: object.message_id } })
    response.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

spaceObjectRoutes.get('/spaces/updates', async (request: AuthenticatedRequest, response, next) => {
  const search = z.string().trim().max(120).optional().safeParse(request.query.q)
  if (!search.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Search text is too long.' } })
    return
  }
  try {
    const [result, activeCalls] = await Promise.all([
      pool.query<SharedObject>(
      `SELECT ${objectFields}
       FROM channel_shared_objects o
       ${visibleObjectJoin}
       ORDER BY COALESCE(o.terminal_at, o.updated_at, o.created_at) DESC
       LIMIT 200`,
      [request.auth!.userId],
      ),
      pool.query<{ id: string; chat_id: string; call_type: 'audio' | 'video'; status: string; created_at: string; title: string; space_id: string | null; channel_name: string | null }>(
        `SELECT c.id, c.chat_id, c.call_type, c.status, c.created_at,
                COALESCE(s.name || ' · #' || sc.name, chat.title, 'Call') AS title,
                s.id AS space_id, sc.name AS channel_name
         FROM calls c
         JOIN chats chat ON chat.id = c.chat_id
         JOIN chat_members member ON member.chat_id = c.chat_id
           AND member.user_id = $1 AND member.left_at IS NULL
         LEFT JOIN space_channels sc ON sc.chat_id = c.chat_id
         LEFT JOIN spaces s ON s.id = sc.space_id
         LEFT JOIN space_members space_member ON space_member.space_id = s.id AND space_member.user_id = $1
         LEFT JOIN space_channel_role_permissions permission ON permission.space_id = s.id
           AND permission.chat_id = c.chat_id AND permission.role = space_member.role
         WHERE c.status IN ('ringing', 'active')
           AND (s.id IS NULL OR space_member.user_id IS NOT NULL)
           AND (s.id IS NULL OR space_member.role IN ('owner', 'admin') OR COALESCE(permission.can_view, true))
           AND ($2::text IS NULL OR COALESCE(s.name || ' · #' || sc.name, chat.title, 'Call') ILIKE '%' || $2 || '%')
         UNION ALL
         SELECT c.id, c.chat_id, c.call_type, c.status, c.created_at,
                COALESCE(s.name || ' · #' || sc.name, chat.title, 'Group call') AS title,
                s.id AS space_id, sc.name AS channel_name
         FROM group_calls c
         JOIN chats chat ON chat.id = c.chat_id
         JOIN chat_members member ON member.chat_id = c.chat_id
           AND member.user_id = $1 AND member.left_at IS NULL
         LEFT JOIN space_channels sc ON sc.chat_id = c.chat_id
         LEFT JOIN spaces s ON s.id = sc.space_id
         LEFT JOIN space_members space_member ON space_member.space_id = s.id AND space_member.user_id = $1
         LEFT JOIN space_channel_role_permissions permission ON permission.space_id = s.id
           AND permission.chat_id = c.chat_id AND permission.role = space_member.role
         WHERE c.status = 'active'
           AND (s.id IS NULL OR space_member.user_id IS NOT NULL)
           AND (s.id IS NULL OR space_member.role IN ('owner', 'admin') OR COALESCE(permission.can_view, true))
           AND ($2::text IS NULL OR COALESCE(s.name || ' · #' || sc.name, chat.title, 'Group call') ILIKE '%' || $2 || '%')
         ORDER BY created_at DESC`,
        [request.auth!.userId, search.data || null],
      ),
    ])
    const now = Date.now()
    const objects = result.rows.filter((item) => item.state !== 'unpinned')
      .filter((item) => !search.data || `${item.title} ${item.channel_name} ${item.space_name}`.toLocaleLowerCase().includes(search.data.toLocaleLowerCase()))
      .map((item) => {
        let state = item.state
        if (item.object_type === 'poll' && item.payload.closesAt && Date.parse(String(item.payload.closesAt)) <= now && state === 'open') state = 'closed'
        if (item.object_type === 'event') {
          const startsAt = Date.parse(String(item.payload.startsAt))
          const endsAt = item.payload.endsAt ? Date.parse(String(item.payload.endsAt)) : startsAt + 60 * 60 * 1000
          if (state !== 'cancelled') {
            if (startsAt <= now && endsAt > now) state = 'active'
            else if (endsAt <= now) state = 'ended'
            else state = 'scheduled'
          }
        }
        return { ...item, state }
      })
    const needsYou = objects.filter((item) => {
      if (item.object_type === 'poll') return item.state === 'open' && !item.my_response
      if (item.object_type === 'event') return item.state === 'scheduled'
        && Date.parse(String(item.payload.startsAt)) > now
        && Date.parse(String(item.payload.startsAt)) <= now + 48 * 60 * 60 * 1000
        && Boolean(item.payload.rsvpRequired) && !item.my_response
      if (item.object_type === 'checklist' && item.state !== 'completed') {
        return ((item.payload.items as { assigneeId?: string | null; done: boolean }[] | undefined) ?? [])
          .some((task) => task.assigneeId === request.auth!.userId && !task.done)
      }
      return false
    })
    const happening = objects.filter((item) => item.object_type === 'event' && item.state === 'active')
    const decided = objects.filter((item) => item.state === 'closed' || item.state === 'completed' || (item.object_type === 'decision' && item.state === 'active'))
    response.json({ stacks: { needsYou, happening, decided }, activeCalls: activeCalls.rows })
  } catch (error) {
    next(error)
  }
})
