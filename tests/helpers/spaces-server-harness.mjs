import { z } from 'zod'
import { load, source, plain } from './foundation-harness.mjs'

export const ids = { space: '11111111-1111-4111-8111-111111111111', channel: '22222222-2222-4222-8222-222222222222', user: '33333333-3333-4333-8333-333333333333', object: '44444444-4444-4444-8444-444444444444', option: '55555555-5555-4555-8555-555555555555' }
export const now = Date.parse('2026-01-01T12:00:00Z')
export const roles = ['moderator', 'member', 'guest'].map(role => ({ role, can_view: true, can_send: true, can_speak: true }))
export const sqlText = sql => sql.replace(/\s+/gu, ' ').trim()

// Real handlers and real Zod with explicit SQL/storage/realtime/LiveKit boundaries.
// Resolved authorization rows are supplied; no PostgreSQL predicate evaluator.
// Router capture does not model Express middleware execution or body parsing.
export function spacesServer(module, { query = async () => ({ rows: [], rowCount: 0 }), publish, storageError, environment = {}, livekit = {} } = {}) {
  const trace = [], registrations = [], limits = []
  let generated = 0
  const router = { use(...args) { registrations.push({ method: 'use', args }) } }
  for (const method of ['get', 'post', 'patch', 'put']) router[method] = (path, ...handlers) => registrations.push({ method, path, handlers })
  const execute = async (owner, sql, params) => {
    const text = sqlText(sql); trace.push([owner, text, params])
    return query(text, params, owner)
  }
  const client = { query: (sql, params) => execute('client', sql, params), release() { trace.push(['release']) } }
  const pool = { query: (sql, params) => execute('pool', sql, params), async connect() { trace.push(['connect']); return client } }
  const storage = { bucketId: 'bucket', storage: {
    async createFile(input) { trace.push(['createFile', input]) },
    async getFileDownload(input) { trace.push(['download', input]); return new Uint8Array([1, 2]) },
  } }
  class RoomServiceClient {
    constructor(...args) { trace.push(['roomService', ...args]) }
    async listRooms(names) { trace.push(['listRooms', names]); return livekit.rooms ?? [] }
    async createRoom(input) { trace.push(['createRoom', input]) }
    async listParticipants(name) { trace.push(['participants', name]); return livekit.participants ?? [] }
    async updateParticipant(...args) { trace.push(['updateParticipant', ...args]) }
    async removeParticipant(...args) { trace.push(['removeParticipant', ...args]) }
  }
  class AccessToken {
    constructor(...args) { trace.push(['token', ...args]) }
    addGrant(input) { trace.push(['grant', input]) }
    async toJwt() { trace.push(['jwt']); return 'test-token' }
  }
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])) } static now() { return now } }
  const mocks = {
    express: { Router: () => router, raw: input => { trace.push(['raw', input]); return () => {} } },
    zod: { z }, uuid: { v7: () => { const id = `66666666-6666-4666-8666-${String(++generated).padStart(12, '0')}`; trace.push(['uuid', id]); return id } },
    'node:crypto': { randomUUID: () => ids.object }, 'node-appwrite/file': { InputFile: { fromBuffer: (bytes, name) => ({ bytes, name }) } },
    'express-rate-limit': { rateLimit: options => { limits.push(options); return () => {} } },
    'livekit-server-sdk': { RoomServiceClient, AccessToken, TrackSource: { MICROPHONE: 'microphone' } },
    '../../db.js': { pool }, '../messaging/limits.js': { messageLimiter: () => {}, searchLimiter: () => {} },
    '../realtime/routes.js': { async publishChatEvent(...args) { trace.push(['publish', ...args]); if (publish) await publish(...args) } },
    '../../shared/appwrite.js': { createAppwriteStorage() { trace.push(['storage']); if (storageError) throw storageError; return storage } },
    './objects.js': { spaceObjectRoutes: {} }, './discovery.js': { spaceDiscoveryRoutes: {} },
  }
  for (const name of ['object-validation', 'file-validation']) {
    try { mocks[`./${name}.js`] = load(`server/features/spaces/${name}.ts`, { zod: { z } }) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  const path = `server/features/spaces/${module}.ts`
  const extra = module === 'objects' ? '\nexports.validation = { createSchema }' : module === 'discovery' ? '\nexports.validation = { fileNameSchema, fileMaxBytes, imageMaxBytes, allowedTypes }' : ''
  const exports = load(path, mocks, { Buffer, Date: Clock, process: { env: environment } }, source(path) + extra)
  return { trace, registrations, limits, validation: exports.validation,
    async invoke(method, path, input = {}) {
      const registration = registrations.find(route => route.method === method && route.path === path)
      if (!registration) throw new Error(`Missing ${method} ${path}`)
      let status = 200, body, error, headers, ended = false
      const response = {
        status(value) { status = value; return this },
        json(value) { body = plain(value); trace.push(['response', status, body]); return this },
        end() { ended = true; trace.push(['response', status]); return this },
        set(value) { headers = value; trace.push(['headers', value]); return this },
        send(value) { body = value; trace.push(['response', status, value]); return this },
      }
      const request = { auth: { userId: ids.user }, params: { id: ids.space, spaceId: ids.space, channelId: ids.channel, objectId: ids.object, messageId: ids.option, fileId: ids.object }, query: {}, body: {}, is: () => true, ...input }
      await registration.handlers.at(-1)(request, response, value => { error = value; trace.push(['next', value]) })
      return { status, body, error, headers, ended }
    },
  }
}
