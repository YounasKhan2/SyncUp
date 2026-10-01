import assert from 'node:assert/strict'
import test from 'node:test'
import { createGroupCallKey } from '../client/src/features/calls/groupCallCrypto.ts'

test('group calls fail closed when browser frame encryption is unavailable', async () => {
  await assert.rejects(
    createGroupCallKey([]),
    /This browser cannot securely encrypt group-call media/u,
  )
})
