import { Router } from 'express'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { pool } from '../../../db.js'
import type { AuthenticatedRequest } from '../../auth/types.js'
import { groupLimiter } from '../limits.js'
import type { MemberKey } from '../validation.js'
import { publishChatEvent } from '../../realtime/routes.js'
import { endGroupCallsForMembershipChange } from '../../calls/groupCallService.js'

export const chatRoutes = Router()

chatRoutes.post('/chats/direct', async (request: AuthenticatedRequest, response, next) => {
  const input = z.object({
    username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  }).safeParse(request.body)
  if (!input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a valid username.' } })
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const peerResult = await client.query<{ id: string }>(
      `SELECT id FROM users
       WHERE username = lower($1) AND id <> $2 AND deleted_at IS NULL
         AND encryption_public_key IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM contacts blocked WHERE blocked.state = 'blocked'
             AND ((blocked.user_id = users.id AND blocked.contact_id = $2)
               OR (blocked.user_id = $2 AND blocked.contact_id = users.id))
         )`,
      [input.data.username, request.auth!.userId],
    )
    const peerId = peerResult.rows[0]?.id
    if (!peerId) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'User not found.' } })
      return
    }
    const contacts = await client.query(
      `SELECT 1 FROM contacts a
       JOIN contacts b ON b.user_id = a.contact_id AND b.contact_id = a.user_id
       WHERE a.user_id = $1 AND a.contact_id = $2 AND a.state = 'accepted' AND b.state = 'accepted'`,
      [request.auth!.userId, peerId],
    )
    if (contacts.rowCount === 0) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: { code: 'conflict', message: 'Send a message request before opening a chat.' } })
      return
    }
    const chatId = uuidv7()
    const result = await client.query<{ id: string }>(
      `INSERT INTO chats (id, kind, created_by, direct_user_low, direct_user_high)
       VALUES ($1, 'direct', $2, LEAST($2::uuid, $3::uuid), GREATEST($2::uuid, $3::uuid))
       ON CONFLICT (direct_user_low, direct_user_high) WHERE kind = 'direct'
       DO UPDATE SET direct_user_low = EXCLUDED.direct_user_low
       RETURNING id`,
      [chatId, request.auth!.userId, peerId],
    )
    const id = result.rows[0].id
    await client.query(
      `INSERT INTO chat_members (chat_id, user_id, role)
       VALUES ($1, $2, 'member'), ($1, $3, 'member')
       ON CONFLICT (chat_id, user_id) WHERE left_at IS NULL DO NOTHING`,
      [id, request.auth!.userId, peerId],
    )
    await client.query('COMMIT')
    response.status(201).json({ chatId: id })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

chatRoutes.post('/chats/groups', groupLimiter, async (request: AuthenticatedRequest, response, next) => {
  const input = z.object({
    title: z.string().trim().min(1).max(80),
    usernames: z.array(z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/)).min(1).max(31),
  }).safeParse(request.body)
  if (!input.success || new Set(input.data?.usernames.map((name) => name.toLowerCase())).size !== input.data?.usernames.length) {
    response.status(400).json({ error: { code: 'validation', message: 'Groups need a name and 1–31 unique members.' } })
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const peers = await client.query<MemberKey & { username: string }>(
      `SELECT id AS user_id, username, encryption_public_key
       FROM users WHERE username = ANY($1::text[]) AND id <> $2
         AND deleted_at IS NULL AND encryption_public_key IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM contacts blocked WHERE blocked.state = 'blocked'
             AND ((blocked.user_id = users.id AND blocked.contact_id = $2)
               OR (blocked.user_id = $2 AND blocked.contact_id = users.id))
         )`,
      [input.data.usernames.map((name) => name.toLowerCase()), request.auth!.userId],
    )
    if (peers.rows.length !== input.data.usernames.length) {
      await client.query('ROLLBACK')
      response.status(400).json({ error: { code: 'validation', message: 'Every group member must have a discoverable SyncUp account.' } })
      return
    }
    const accepted = await client.query<{ contact_id: string }>(
      `SELECT c.contact_id
       FROM contacts c JOIN contacts r ON r.user_id = c.contact_id AND r.contact_id = c.user_id
       WHERE c.user_id = $1 AND c.state = 'accepted' AND r.state = 'accepted'
         AND c.contact_id = ANY($2::uuid[])`,
      [request.auth!.userId, peers.rows.map((peer) => peer.user_id)],
    )
    if (accepted.rows.length !== peers.rows.length) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: { code: 'conflict', message: 'Add group members as contacts first.' } })
      return
    }
    const chatId = uuidv7()
    await client.query(
      `INSERT INTO chats (id, kind, title, created_by) VALUES ($1, 'group', $2, $3)`,
      [chatId, input.data.title, request.auth!.userId],
    )
    await client.query(
      `INSERT INTO chat_members (chat_id, user_id, role)
       SELECT $1, member_id, CASE WHEN member_id = $2 THEN 'owner' ELSE 'member' END
       FROM unnest($3::uuid[]) AS member_id`,
      [chatId, request.auth!.userId, [request.auth!.userId, ...peers.rows.map((peer) => peer.user_id)]],
    )
    await client.query('COMMIT')
    response.status(201).json({ chatId })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

chatRoutes.post('/chats/:id/members', groupLimiter, async (request: AuthenticatedRequest, response, next) => {
  const chatId = z.uuid().safeParse(request.params.id)
  const input = z.object({
    username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  }).safeParse(request.body)
  if (!chatId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a valid group and username.' } })
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const group = await client.query<{ kind: string }>(
      `SELECT c.kind
       FROM chats c
       JOIN chat_members me ON me.chat_id = c.id AND me.user_id = $2 AND me.left_at IS NULL
       WHERE c.id = $1
       FOR UPDATE OF c, me`,
      [chatId.data, request.auth!.userId],
    )
    if (!group.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Group not found.' } })
      return
    }
    if (group.rows[0].kind !== 'group') {
      await client.query('ROLLBACK')
      response.status(400).json({ error: { code: 'validation', message: 'Members can only be invited to groups.' } })
      return
    }
    const count = await client.query<{ member_count: number }>(
      'SELECT count(*)::int AS member_count FROM chat_members WHERE chat_id = $1 AND left_at IS NULL',
      [chatId.data],
    )
    if (count.rows[0].member_count >= 32) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: { code: 'conflict', message: 'This encrypted group already has 32 members.' } })
      return
    }
    const target = await client.query<{ id: string; username: string }>(
      `SELECT u.id, u.username FROM users u
       WHERE u.username = lower($1) AND u.id <> $2 AND u.deleted_at IS NULL
         AND u.encryption_public_key IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM contacts blocked WHERE blocked.state = 'blocked'
             AND ((blocked.user_id = u.id AND blocked.contact_id = $2)
               OR (blocked.user_id = $2 AND blocked.contact_id = u.id))
         )
         AND EXISTS (
           SELECT 1 FROM contacts a JOIN contacts b
             ON b.user_id = a.contact_id AND b.contact_id = a.user_id
           WHERE a.user_id = $2 AND a.contact_id = u.id
             AND a.state = 'accepted' AND b.state = 'accepted'
         )`,
      [input.data.username, request.auth!.userId],
    )
    if (!target.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Invite a discoverable mutual contact.' } })
      return
    }
    const added = await client.query(
      `INSERT INTO chat_members (chat_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT (chat_id, user_id) WHERE left_at IS NULL DO NOTHING
       RETURNING user_id`,
      [chatId.data, target.rows[0].id],
    )
    if (added.rowCount === 0) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: { code: 'conflict', message: 'That person is already in this group.' } })
      return
    }
    await endGroupCallsForMembershipChange(client, chatId.data)
    await client.query('COMMIT')
    await publishChatEvent(chatId.data, {
      type: 'membership.changed',
      data: { userId: target.rows[0].id, username: target.rows[0].username, action: 'joined' },
    })
    response.status(201).json({ userId: target.rows[0].id, username: target.rows[0].username })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

chatRoutes.post('/chats/:id/leave', async (request: AuthenticatedRequest, response, next) => {
  const chatId = z.uuid().safeParse(request.params.id)
  if (!chatId.success) {
    response.status(404).json({ error: { code: 'not_found', message: 'Group not found.' } })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const group = await client.query<{ kind: string; role: string }>(
      `SELECT c.kind, me.role FROM chats c
       JOIN chat_members me ON me.chat_id = c.id AND me.user_id = $2 AND me.left_at IS NULL
       WHERE c.id = $1 FOR UPDATE OF c`,
      [chatId.data, request.auth!.userId],
    )
    if (!group.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Group not found.' } })
      return
    }
    if (group.rows[0].kind !== 'group') {
      await client.query('ROLLBACK')
      response.status(400).json({ error: { code: 'validation', message: 'You cannot leave a direct chat.' } })
      return
    }
    const replacement = group.rows[0].role === 'owner'
      ? await client.query<{ user_id: string }>(
        `SELECT user_id FROM chat_members
         WHERE chat_id = $1 AND user_id <> $2 AND left_at IS NULL
         ORDER BY joined_at, user_id LIMIT 1`,
        [chatId.data, request.auth!.userId],
      )
      : null
    await endGroupCallsForMembershipChange(client, chatId.data)
    await client.query(
      `UPDATE chat_members SET left_at = now()
       WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [chatId.data, request.auth!.userId],
    )
    if (replacement?.rows[0]) {
      await client.query(
        `UPDATE chat_members SET role = 'owner'
         WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL`,
        [chatId.data, replacement.rows[0].user_id],
      )
    }
    await client.query('COMMIT')
    await publishChatEvent(chatId.data, {
      type: 'membership.changed',
      data: { userId: request.auth!.userId, action: 'left' },
    })
    response.status(204).end()
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

chatRoutes.get('/inbox', async (request: AuthenticatedRequest, response, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.kind, c.title, c.last_seq, c.last_message_at,
              cm.last_read_seq,
              CASE WHEN c.kind = 'direct' THEN peer.display_name ELSE c.title END AS display_title,
              CASE WHEN c.kind = 'direct' THEN peer.username ELSE NULL END AS peer_username,
              CASE WHEN c.kind = 'direct' THEN peer.avatar_url ELSE NULL END AS peer_avatar_url,
              last_message.id AS last_message_id,
              last_message.sender_id AS last_sender_id,
              last_message.body_ciphertext AS last_body_ciphertext,
              last_message.body_nonce AS last_body_nonce,
              last_message.key_envelopes -> $1::text AS last_key_envelope,
              last_message.created_at AS last_message_created_at,
              (SELECT count(*)::int FROM messages unread
               WHERE unread.chat_id = c.id AND unread.server_seq > cm.last_read_seq
                 AND unread.sender_id <> $1 AND unread.deleted_at IS NULL
                 AND NOT EXISTS (
                   SELECT 1 FROM message_user_states hidden
                   WHERE hidden.message_id = unread.id AND hidden.user_id = $1
                     AND hidden.hidden_at IS NOT NULL
                 )) AS unread_count
       FROM chat_members cm
       JOIN chats c ON c.id = cm.chat_id
       LEFT JOIN users peer ON c.kind = 'direct'
         AND peer.id = CASE WHEN c.direct_user_low = $1 THEN c.direct_user_high ELSE c.direct_user_low END
       LEFT JOIN LATERAL (
         SELECT m.id, m.sender_id, m.body_ciphertext, m.body_nonce, m.key_envelopes, m.created_at
         FROM messages m WHERE m.chat_id = c.id AND m.deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM message_user_states hidden
             WHERE hidden.message_id = m.id AND hidden.user_id = $1 AND hidden.hidden_at IS NOT NULL
           )
         ORDER BY m.server_seq DESC LIMIT 1
       ) last_message ON true
       WHERE cm.user_id = $1 AND cm.left_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM message_requests mr
           WHERE mr.chat_id = c.id AND mr.to_user = $1 AND mr.state IN ('pending', 'ignored')
         )
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC`,
      [request.auth!.userId],
    )
    response.json({ chats: result.rows })
  } catch (error) {
    next(error)
  }
})

chatRoutes.get('/chats/:id', async (request: AuthenticatedRequest, response, next) => {
  const chatId = z.uuid().safeParse(request.params.id)
  if (!chatId.success) {
    response.status(404).json({ error: { code: 'not_found', message: 'Chat not found.' } })
    return
  }
  try {
    const access = await pool.query(
      `SELECT 1 FROM chat_members cm
       WHERE cm.chat_id = $1 AND cm.user_id = $2 AND cm.left_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM message_requests mr WHERE mr.chat_id = cm.chat_id
             AND mr.to_user = $2 AND mr.state IN ('pending', 'ignored')
         )`,
      [chatId.data, request.auth!.userId],
    )
    if (access.rowCount === 0) {
      response.status(404).json({ error: { code: 'not_found', message: 'Chat not found.' } })
      return
    }
    const result = await pool.query(
      `SELECT c.id, c.kind, c.title, c.last_seq, me.last_read_seq,
              COALESCE(
                jsonb_agg(jsonb_build_object(
                  'id', u.id, 'username', u.username, 'displayName', u.display_name,
                  'publicKey', u.encryption_public_key, 'role', cm.role, 'avatar_url', u.avatar_url
                ) ORDER BY u.display_name) FILTER (WHERE u.id IS NOT NULL),
                '[]'::jsonb
              ) AS members
       FROM chats c
       JOIN chat_members me ON me.chat_id = c.id AND me.user_id = $2 AND me.left_at IS NULL
       JOIN chat_members cm ON cm.chat_id = c.id AND cm.left_at IS NULL
       JOIN users u ON u.id = cm.user_id
       WHERE c.id = $1
       GROUP BY c.id, me.last_read_seq`,
      [chatId.data, request.auth!.userId],
    )
    response.json({ chat: result.rows[0] })
  } catch (error) {
    next(error)
  }
})
