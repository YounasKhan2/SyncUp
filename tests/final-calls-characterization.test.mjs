import test from 'node:test'
import assert from 'node:assert/strict'
import * as jsx from 'react/jsx-runtime'
import { load, source } from './helpers/foundation-harness.mjs'

// Real CallWindow effects/callApi, with explicit SDK/device/worker/HTTP doubles.
// This does not prove WebRTC delivery, E2EE frames, camera or microphone hardware.
function call({ props = {}, supported = true, connectError, status = 'ringing' } = {}) {
  const effects = [], states = [], refs = [], requests = [], trace = [], timers = new Map()
  let slot = 0, id = 0
  class Room {
    constructor(options) {
      trace.push(['room', options]); this.remoteParticipants = new Map()
      this.localParticipant = { identity: 'synthetic', videoTrackPublications: new Map(),
        setMicrophoneEnabled: async value => trace.push(['microphone', value]),
        setCameraEnabled: async value => trace.push(['camera', value]),
      }
    }
    on() { return this }
    async connect(url, token) { trace.push(['connect', url, token]); if (connectError) throw new Error(connectError) }
    async disconnect() { trace.push(['disconnect']) }
    async setE2EEEnabled(value) { trace.push(['e2ee', value]) }
  }
  const mocks = {
    react: { useState(initial) { const i = slot++; states[i] = initial; return [initial, value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
      useRef(current) { const ref = { current }; refs.push(ref); return ref }, useEffect(callback) { effects.push(callback) } },
    'react/jsx-runtime': jsx, 'lucide-react': new Proxy({}, { get: () => () => null }),
    '../../shared/components/Avatar': { Avatar: () => null },
    'livekit-client': { Room, isE2EESupported: () => supported,
      RoomEvent: {}, ParticipantEvent: {}, ExternalE2EEKeyProvider: class { async setKey() { trace.push(['key-provider']) } } },
  }
  const globals = { URL, Worker: class { terminate() { trace.push(['terminate']) } },
    window: { setInterval(callback, delay) { timers.set(++id, { callback, delay }); return id }, clearInterval(key) { timers.delete(key) } },
    fetch: async (path, options) => {
      requests.push({ path, method: options?.method ?? 'GET', credentials: options?.credentials })
      return { ok: true, status: 200, json: async () => path.endsWith('/status') ? { status, participants: [] } : path.endsWith('/voice') ? { participants: [] } : { url: 'ws://synthetic.invalid', token: 'synthetic-token' } }
    },
  }
  // Only import.meta's URL is replaced for the CommonJS VM; all effects and callbacks execute unchanged.
  const text = source('client/src/features/calls/CallWindow.tsx').replaceAll('import.meta.url', "'file:///validation-only.js'")
  load('client/src/features/calls/CallWindow.tsx', mocks, globals, text).CallWindow({ callId: 'call', title: 'Synthetic', video: false, onEnd() {}, onClose() {}, ...props })
  return { effects, states, refs, requests, trace, timers }
}
const settle = () => new Promise(resolve => setImmediate(resolve))

test('Final direct video call connects after token POST, enables mic/camera and disconnects on cleanup', async () => {
  const h = call({ props: { video: true } }); const stop = h.effects[0](); await settle()
  assert.deepEqual(h.requests, [{ path: '/api/calls/call/token', method: 'POST', credentials: 'same-origin' }])
  assert.deepEqual(h.trace.filter(([name]) => ['connect', 'microphone', 'camera'].includes(name)), [['connect', 'ws://synthetic.invalid', 'synthetic-token'], ['microphone', true], ['camera', true]])
  assert.equal(h.states[2], true); stop(); assert.ok(h.trace.some(([name]) => name === 'disconnect')); assert.equal(h.refs[1].current, null)
})

test('Final Space voice listener uses exact voice token/roster paths, disables publishing and cleans 5000 ms roster', async () => {
  const h = call({ props: { isVoiceRoom: true, voiceSpaceId: 'space', voiceChannelId: 'channel', canPublish: false } })
  const stop = h.effects[0](), stopRoster = h.effects[2](); await settle()
  assert.deepEqual(h.requests.map(({ path, method }) => [path, method]), [['/api/spaces/space/channels/channel/voice', 'GET'], ['/api/spaces/space/channels/channel/voice/token', 'POST']])
  assert.ok(h.trace.some(([name, enabled]) => name === 'microphone' && enabled === false))
  assert.equal([...h.timers.values()][0].delay, 5000); stopRoster(); stop(); assert.equal(h.timers.size, 0)
})

test('Final unsupported group frame encryption fails closed, zeroes key and ends host participation', async () => {
  const key = new Uint8Array(32).fill(9), h = call({ supported: false, props: { isGroup: true, isHost: true, e2eeKey: key } })
  const stop = h.effects[0](); await settle()
  assert.equal(h.states[7], true); assert.equal(h.states[8], 'This browser cannot securely encrypt group-call media.')
  assert.equal(key.every(byte => byte === 0), true)
  assert.deepEqual(h.requests.map(({ path, method }) => [path, method]), [['/api/group-calls/call/end', 'POST']])
  assert.equal(h.trace.some(([name]) => name === 'room'), false); stop()
})

test('Final group connection failure terminates worker, zeroes key and leaves non-host participation', async () => {
  const key = new Uint8Array(32).fill(9), h = call({ connectError: 'synthetic failure', props: { isGroup: true, e2eeKey: key } })
  const stop = h.effects[0](); await settle()
  assert.equal(h.states[8], 'synthetic failure'); assert.equal(h.states[7], true)
  assert.equal(key.every(byte => byte === 0), true); assert.ok(h.trace.some(([name]) => name === 'terminate'))
  assert.ok(h.requests.some(({ path, method }) => path === '/api/group-calls/call/leave' && method === 'POST')); stop()
})

test('Final call status polling retains immediate GET, 4000 ms, terminal cleanup and cancellation', async () => {
  const h = call({ status: 'declined' }); const stopMedia = h.effects[0](); await settle()
  const stopPoll = h.effects[1](); await settle()
  assert.equal([...h.timers.values()][0].delay, 4000)
  assert.ok(h.requests.some(({ path, method }) => path === '/api/calls/call/status' && method === 'GET'))
  assert.equal(h.states[7], true); assert.equal(h.states[2], false); assert.equal(h.states[8], 'The other person declined the call.')
  assert.ok(h.trace.some(([name]) => name === 'disconnect')); stopPoll(); stopMedia(); assert.equal(h.timers.size, 0)
})
