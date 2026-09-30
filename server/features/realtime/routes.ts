import { Client } from 'pg'
import type { Response } from 'express'
import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { requireAuth, type AuthenticatedRequest } from '../auth/middleware.js'
import { pool } from '../../db.js'

type ChatHint = { chatId: string; serverSeq: number }
type Subscriber = { userId: string; response: Response }
type RealtimeEvent = { type: string; data: Record<string, unknown> }

const subscribersByChat = new Map<string, Set<Subscriber>>()
let stopping = false

function publish(response: Response, event: RealtimeEvent) {
  response.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`)
}

export async function publishChatEvent(chatId: string, event: RealtimeEvent, excludeUserId?: string) {
  const subscribers = subscribersByChat.get(chatId)
  if (!subscribers?.size) return
  try {
    const members = await pool.query<{ user_id: string }>(
      `SELECT cm.user_id FROM chat_members cm
       WHERE cm.chat_id = $1 AND cm.left_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM message_requests mr
           WHERE mr.chat_id = cm.chat_id AND mr.to_user = cm.user_id
             AND mr.state IN ('pending', 'ignored')
         )`,
      [chatId],
    )
    const allowed = new Set(members.rows.map((member) => member.user_id))
    for (const subscriber of subscribers) {
      if (allowed.has(subscriber.userId) && subscriber.userId !== excludeUserId) {
        publish(subscriber.response, event)
      } else if (!allowed.has(subscriber.userId)) {
        subscribers.delete(subscriber)
        subscriber.response.end()
      }
    }
    if (subscribers.size === 0) subscribersByChat.delete(chatId)
  } catch (error) {
    console.error('Unable to authorize realtime chat activity', error)
  }
}

async function dispatch(hint: ChatHint) {
  await publishChatEvent(hint.chatId, { type: 'message.created', data: hint })
}

export async function startRealtimeListener() {
  let retryMs = 500
  while (!stopping) {
    const listener = new Client({ connectionString: process.env.DATABASE_URL })
    try {
      await listener.connect()
      await listener.query('LISTEN syncup_chat_messages')
      retryMs = 500
      listener.on('notification', (notification) => {
        if (notification.channel !== 'syncup_chat_messages' || !notification.payload) return
        try {
          const parsed = JSON.parse(notification.payload) as { chatId?: unknown; serverSeq?: unknown }
          if (typeof parsed.chatId !== 'string' || typeof parsed.serverSeq !== 'number') return
          void dispatch({ chatId: parsed.chatId, serverSeq: parsed.serverSeq })
        } catch (error) {
          console.error('Invalid realtime message hint', error)
        }
      })
      await new Promise<void>((resolve) => {
        listener.once('error', (error) => {
          console.error('PostgreSQL realtime listener disconnected', error)
          resolve()
        })
        listener.once('end', resolve)
      })
    } catch (error) {
      if (!stopping) console.error('Unable to start PostgreSQL realtime listener', error)
    } finally {
      await listener.end().catch(() => undefined)
    }
    if (!stopping) {
      await new Promise((resolve) => setTimeout(resolve, retryMs))
      retryMs = Math.min(15_000, retryMs * 2)
    }
  }
}

export function stopRealtimeListener() {
  stopping = true
}

export const realtimeRouter = Router()
realtimeRouter.use(requireAuth)
const typingLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => (request as AuthenticatedRequest).auth!.userId,
  message: { error: { code: 'rate_limited', message: 'Typing updates are arriving too quickly.' } },
})

realtimeRouter.post('/chats/:id/typing', typingLimiter, async (request: AuthenticatedRequest, response, next) => {
  const chatId = z.uuid().safeParse(request.params.id)
  const input = z.object({ active: z.boolean() }).safeParse(request.body)
  if (!chatId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid typing update.' } })
    return
  }
  try {
    const access = await pool.query<{ display_name: string }>(
      `SELECT u.display_name
       FROM chat_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.chat_id = $1 AND cm.user_id = $2 AND cm.left_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM message_requests mr WHERE mr.chat_id = cm.chat_id
             AND mr.to_user = $2 AND mr.state IN ('pending', 'ignored')
         )`,
      [chatId.data, request.auth!.userId],
    )
    if (!access.rows[0]) {
      response.status(404).json({ error: { code: 'not_found', message: 'Chat not found.' } })
      return
    }
    await publishChatEvent(chatId.data, {
      type: 'typing',
      data: { userId: request.auth!.userId, displayName: access.rows[0].display_name, active: input.data.active },
    }, request.auth!.userId)
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

realtimeRouter.get('/events', async (request: AuthenticatedRequest, response, next) => {
  const chatId = z.uuid().safeParse(request.query.chat_id)
  if (!chatId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'A chat_id is required for realtime updates.' } })
    return
  }
  try {
    const access = await pool.query(
      `SELECT 1 FROM chat_members cm
       WHERE cm.chat_id = $1 AND cm.user_id = $2 AND cm.left_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM message_requests mr
           WHERE mr.chat_id = cm.chat_id AND mr.to_user = $2
             AND mr.state IN ('pending', 'ignored')
         )`,
      [chatId.data, request.auth!.userId],
    )
    if (access.rowCount === 0) {
      response.status(404).json({ error: { code: 'not_found', message: 'Chat not found.' } })
      return
    }

    response.status(200)
    response.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    response.flushHeaders()
    response.write('event: ready\ndata: {}\n\n')
    const subscriber: Subscriber = { userId: request.auth!.userId, response }
    const subscribers = subscribersByChat.get(chatId.data) ?? new Set<Subscriber>()
    for (const userId of new Set([...subscribers].map((item) => item.userId))) {
      if (userId !== request.auth!.userId) publish(response, { type: 'presence', data: { userId, online: true } })
    }
    subscribers.add(subscriber)
    subscribersByChat.set(chatId.data, subscribers)
    void publishChatEvent(chatId.data, { type: 'presence', data: { userId: request.auth!.userId, online: true } }, request.auth!.userId)
    const heartbeat = setInterval(() => response.write(': keep-alive\n\n'), 20_000)
    response.on('close', () => {
      clearInterval(heartbeat)
      subscribers.delete(subscriber)
      if (![...subscribers].some((item) => item.userId === subscriber.userId)) {
        void publishChatEvent(chatId.data, { type: 'presence', data: { userId: subscriber.userId, online: false } })
      }
      if (subscribers.size === 0) subscribersByChat.delete(chatId.data)
    })
  } catch (error) {
    next(error)
  }
})
