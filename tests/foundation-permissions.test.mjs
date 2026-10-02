import test from 'node:test'
import assert from 'node:assert/strict'
import { source, functionBody, plain, warning } from './helpers/foundation-harness.mjs'

const objects = 'server/features/spaces/objects.ts'
const discovery = 'server/features/spaces/discovery.ts'
const routes = 'server/features/spaces/routes.ts'

// No disposable PostgreSQL was established. These narrow source assertions guard the
// actual SQL fallback contract; they do not claim to execute SQL or its joins.
test(`${warning}: text and objects retain announcement-aware fallback; files retain permissive fallback`, () => {
  for (const path of [objects, routes]) {
    assert.match(source(path), /COALESCE\(\s*permission\.can_send,\s*sc\.channel_type <> 'announcement' OR sm\.role = 'moderator'\s*\) AS can_send/)
  }
  assert.match(source(discovery), /COALESCE\(permission\.can_send, true\)\) AS can_send/)
  for (const path of [objects, discovery, routes]) {
    assert.match(source(path), /sm\.role IN \('owner', 'admin'\) OR COALESCE\(permission\.can_view, true\)/)
    assert.match(source(path), /grant_member\.left_at IS NULL/)
    assert.match(source(path), /LEFT JOIN space_channel_role_permissions permission/)
  }
  assert.match(source(routes), /COALESCE\(permission\.can_speak, true\) AS can_speak/)
  assert.match(source(routes), /canPublish: access\.rows\[0\]\.can_speak/)
})

test('Given resolved object permissions, then allow succeeds, denied send forbids, absent visibility row hides', async () => {
  for (const [rows, expected] of [
    [[{ can_view: true, can_send: true, role: 'member' }], { channel: { can_view: true, can_send: true, role: 'member' } }],
    [[{ can_view: true, can_send: false, role: 'member' }], { error: 'forbidden' }],
    [[], { error: 'not_found' }],
  ]) {
    const authorize = functionBody(objects, 'authorizeChannel', { pool: { query: async () => ({ rows }) } })
    assert.deepEqual(plain(await authorize('user', 'space', 'chat', true)), expected)
  }
})

test('Given resolved file permissions, then channelAccess preserves both booleans without normalizing', async () => {
  for (const row of [{ can_view: true, can_send: true }, { can_view: true, can_send: false }, { can_view: false, can_send: false }]) {
    const access = functionBody(discovery, 'channelAccess', { pool: { query: async () => ({ rows: [row] }) } })
    assert.deepEqual(plain(await access('space', 'chat', 'user')), row)
  }
  assert.equal(await functionBody(discovery, 'channelAccess', { pool: { query: async () => ({ rows: [] }) } })('space', 'chat', 'user'), null)
})

test('Given existing channels, then migration backfills all three non-admin roles with announcement defaults', () => {
  const migration = source('database/migrations/014_space_channel_role_permissions.sql')
  assert.match(migration, /CROSS JOIN \(VALUES \('moderator'\), \('member'\), \('guest'\)\)/)
  assert.match(migration, /channel\.channel_type <> 'announcement' OR role\.role = 'moderator'/)
  assert.match(source(routes), /\['moderator', 'member', 'guest'\]/)
  assert.match(source('database/migrations/015_space_voice_and_mentions.sql'), /can_speak boolean NOT NULL DEFAULT true/)
})
