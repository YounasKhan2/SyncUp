import assert from 'node:assert/strict'
import { randomUUID, webcrypto } from 'node:crypto'
import test from 'node:test'

const apiBase = process.env.TEST_API_URL ?? 'http://localhost:4000'
const encoder = new TextEncoder()

function encode(bytes) {
  return Buffer.from(bytes).toString('base64url')
}

function decode(value) {
  return new Uint8Array(Buffer.from(value, 'base64url'))
}

async function createIdentity(password) {
  const pair = await webcrypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  )
  const publicKey = await webcrypto.subtle.exportKey('jwk', pair.publicKey)
  const privateKey = new Uint8Array(await webcrypto.subtle.exportKey('pkcs8', pair.privateKey))
  const salt = webcrypto.getRandomValues(new Uint8Array(16))
  const iv = webcrypto.getRandomValues(new Uint8Array(12))
  const material = await webcrypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  const wrappingKey = await webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )
  const encryptedPrivateKey = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, privateKey))
  privateKey.fill(0)
  return {
    publicKey,
    encryptedPrivateKey: encode(encryptedPrivateKey),
    privateKeyIv: encode(iv),
    vaultSalt: encode(salt),
  }
}

async function encryptMessage(text, recipients) {
  const contentKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const rawKey = new Uint8Array(await webcrypto.subtle.exportKey('raw', contentKey))
  const nonce = webcrypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    contentKey,
    encoder.encode(text),
  ))
  const keyEnvelopes = {}
  for (const recipient of recipients) {
    const publicKey = await webcrypto.subtle.importKey(
      'jwk',
      recipient.publicKey,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    )
    keyEnvelopes[recipient.id] = encode(new Uint8Array(
      await webcrypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawKey),
    ))
  }
  rawKey.fill(0)
  return {
    bodyCiphertext: encode(ciphertext),
    bodyNonce: encode(nonce),
    keyEnvelopes,
  }
}

async function wrapCallKey(rawKey, recipients) {
  const keyEnvelopes = {}
  for (const recipient of recipients) {
    const publicKey = await webcrypto.subtle.importKey(
      'jwk',
      recipient.publicKey,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    )
    keyEnvelopes[recipient.id] = encode(new Uint8Array(
      await webcrypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawKey),
    ))
  }
  return keyEnvelopes
}

async function unwrapCallKey(envelope, recipient) {
  const material = await webcrypto.subtle.importKey('raw', encoder.encode(recipient.password), 'PBKDF2', false, ['deriveKey'])
  const wrappingKey = await webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: decode(recipient.keyBundle.vaultSalt), iterations: 310_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  const privateKeyBytes = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(recipient.keyBundle.privateKeyIv) },
    wrappingKey,
    decode(recipient.keyBundle.encryptedPrivateKey),
  )
  const privateKey = await webcrypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  )
  return new Uint8Array(await webcrypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    decode(envelope),
  ))
}

async function encryptAttachment(plaintext, recipients) {
  const contentKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const rawKey = new Uint8Array(await webcrypto.subtle.exportKey('raw', contentKey))
  const nonce = webcrypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, contentKey, plaintext)
  const keyEnvelopes = {}
  for (const recipient of recipients) {
    const publicKey = await webcrypto.subtle.importKey(
      'jwk',
      recipient.publicKey,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    )
    keyEnvelopes[recipient.id] = encode(new Uint8Array(
      await webcrypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawKey),
    ))
  }
  rawKey.fill(0)
  return { ciphertext, nonce: encode(nonce), keyEnvelopes }
}

async function decryptMessage(message, recipient) {
  const material = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(recipient.password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  const wrappingKey = await webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: decode(recipient.keyBundle.vaultSalt), iterations: 310_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  const privateKeyBytes = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(recipient.keyBundle.privateKeyIv) },
    wrappingKey,
    decode(recipient.keyBundle.encryptedPrivateKey),
  )
  const privateKey = await webcrypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  )
  const rawKey = await webcrypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    decode(message.key_envelope),
  )
  const contentKey = await webcrypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  )
  const plaintext = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(message.body_nonce) },
    contentKey,
    decode(message.body_ciphertext),
  )
  return new TextDecoder().decode(plaintext)
}

async function decryptAttachment(ciphertext, nonce, keyEnvelope, recipient) {
  const material = await webcrypto.subtle.importKey('raw', encoder.encode(recipient.password), 'PBKDF2', false, ['deriveKey'])
  const wrappingKey = await webcrypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: decode(recipient.keyBundle.vaultSalt), iterations: 310_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  const privateKeyBytes = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(recipient.keyBundle.privateKeyIv) },
    wrappingKey,
    decode(recipient.keyBundle.encryptedPrivateKey),
  )
  const privateKey = await webcrypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  )
  const rawKey = await webcrypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, decode(keyEnvelope))
  const contentKey = await webcrypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt'])
  return webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(nonce) }, contentKey, ciphertext)
}

function cookieJar() {
  const cookies = new Map()
  return {
    cookies,
    header: () => [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
    store(response) {
      for (const raw of response.headers.getSetCookie()) {
        const pair = raw.split(';', 1)[0]
        const separator = pair.indexOf('=')
        const name = pair.slice(0, separator)
        if (raw.includes('Max-Age=0')) cookies.delete(name)
        else cookies.set(name, pair.slice(separator + 1))
      }
    },
  }
}

async function apiRequest(identity, path, options = {}) {
  const headers = { ...(options.headers ?? {}) }
  if (identity?.cookies?.size) headers.cookie = identity.header()
  const response = await fetch(new URL(path, apiBase), { ...options, headers })
  if (identity) identity.store(response)
  return response
}

async function createAccount(name, userPrefix) {
  const username = `${userPrefix}_${randomUUID().slice(0, 8)}`
  const email = `${username}@example.test`
  const password = `test-password-${randomUUID()}`
  const keyBundle = await createIdentity(password)
  const jar = cookieJar()
  const response = await apiRequest(jar, '/api/auth/sign-up', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, username, displayName: name, password, keyBundle }),
  })
  assert.equal(response.status, 201, await response.clone().text())
  const payload = await response.json()
  assert.equal(payload.user.discoverable, true)
  return {
    ...jar,
    id: payload.user.id,
    email,
    username,
    displayName: name,
    password,
    keyBundle,
    publicKey: keyBundle.publicKey,
  }
}

async function signInAccount(account) {
  const jar = cookieJar()
  const response = await apiRequest(jar, '/api/auth/sign-in', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: account.password }),
  })
  assert.equal(response.status, 200, await response.clone().text())
  const payload = await response.json()
  assert.equal(payload.user.discoverable, true)
  return { ...jar, id: account.id, email: account.email, username: account.username, user: payload.user }
}

async function post(identity, path, body) {
  return apiRequest(identity, path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function waitForEvent(reader, eventName) {
  let buffer = ''
  let timeoutHandle
  const timeout = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`Timed out waiting for ${eventName} event.`)), 5000)
  })
  const event = (async () => {
    while (true) {
      const { value, done } = await reader.read()
      if (done) throw new Error(`Realtime stream ended before ${eventName} event.`)
      buffer += new TextDecoder().decode(value, { stream: true })
      const match = buffer.match(new RegExp(`event: ${eventName}\\ndata: ([^\\r\\n]+)`))
      if (match) return JSON.parse(match[1])
    }
  })()
  try {
    return await Promise.race([event, timeout])
  } finally {
    clearTimeout(timeoutHandle)
  }
}

test('encrypted requests, authorized chats, ordered idempotent delivery, and groups', async (context) => {
  try {
    const health = await fetch(new URL('/api/health', apiBase))
    assert.equal(health.status, 200)
  } catch {
    context.skip(`Start the API with a migrated PostgreSQL database before running this test (TEST_API_URL=${apiBase}).`)
    return
  }

  const ava = await createAccount('Ava', 'ava')
  const nadia = await createAccount('Nadia', 'nadia')
  const chris = await createAccount('Chris', 'chris')

  let response = await post(ava, '/api/spaces', {
    name: 'Website redesign',
    description: 'Design and ship the new customer site.',
    icon: 'rocket',
    template: 'client-room',
  })
  assert.equal(response.status, 201, await response.clone().text())
  const createdSpace = await response.json()
  response = await apiRequest(ava, `/api/spaces/${createdSpace.spaceId}`)
  assert.equal(response.status, 200, await response.clone().text())
  const avaSpace = (await response.json()).space
  assert.equal(avaSpace.name, 'Website redesign')
  assert.equal(avaSpace.description, 'Design and ship the new customer site.')
  assert.equal(avaSpace.icon, 'rocket')
  assert.deepEqual(avaSpace.categories.map((category) => category.name), ['Text Channels'])
  assert.deepEqual(avaSpace.channels.map((channel) => channel.name), ['general'])
  const generalChannel = avaSpace.channels[0]

  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/categories`, { name: 'Client' })
  assert.equal(response.status, 201, await response.clone().text())
  const clientCategory = (await response.json()).category
  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/categories`, { name: 'Client' })
  assert.equal(response.status, 409)
  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/channels`, {
    name: 'feedback', type: 'discussion', categoryId: clientCategory.id, topic: 'Share design feedback here.',
  })
  assert.equal(response.status, 201, await response.clone().text())
  const feedbackChannel = await response.json()
  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/channels`, { name: 'internal', type: 'private' })
  assert.equal(response.status, 201, await response.clone().text())
  const privateChannel = await response.json()
  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/channels`, { name: 'announcements', type: 'announcement' })
  assert.equal(response.status, 201, await response.clone().text())
  const announcementChannel = await response.json()
  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/channels`, { name: 'lounge', type: 'voice' })
  assert.equal(response.status, 201, await response.clone().text())
  const voiceChannel = await response.json()
  response = await apiRequest(ava, `/api/spaces/${createdSpace.spaceId}/channels/${feedbackChannel.channelId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ topic: 'Share design feedback and approvals here.' }),
  })
  assert.equal(response.status, 200, await response.clone().text())
  assert.equal((await response.json()).channel.topic, 'Share design feedback and approvals here.')
  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/channels`, { name: 'feedback', type: 'discussion' })
  assert.equal(response.status, 409)

  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/members`, {
    username: nadia.username,
    role: 'guest',
    channels: [generalChannel.id],
  })
  assert.equal(response.status, 201, await response.clone().text())
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}/channels/${feedbackChannel.channelId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ topic: 'Unauthorized change' }),
  })
  assert.equal(response.status, 403)
  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/members`, {
    username: chris.username,
    role: 'member',
  })
  assert.equal(response.status, 201, await response.clone().text())
  response = await apiRequest(ava, `/api/spaces/${createdSpace.spaceId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Customer website', description: 'A refreshed brand and web experience.', icon: 'briefcase' }),
  })
  assert.equal(response.status, 200, await response.clone().text())
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Guest should not rename', description: '', icon: 'heart' }),
  })
  assert.equal(response.status, 403)
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}`)
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).space.categories.map((category) => category.name), ['Text Channels'])
  response = await apiRequest(chris, `/api/spaces/${createdSpace.spaceId}`)
  assert.equal(response.status, 200)
  const memberSpace = (await response.json()).space
  assert.equal(memberSpace.name, 'Customer website')
  assert.equal(memberSpace.icon, 'briefcase')
  assert.equal(memberSpace.description, 'A refreshed brand and web experience.')
  assert.ok(memberSpace.categories.some((category) => category.id === clientCategory.id))
  const feedbackDetails = memberSpace.channels.find((channel) => channel.id === feedbackChannel.channelId)
  assert.equal(feedbackDetails.topic, 'Share design feedback and approvals here.')
  assert.equal(feedbackDetails.category_id, clientCategory.id)
  assert.equal(feedbackDetails.category_name, 'Client')
  response = await apiRequest(ava, `/api/spaces/${createdSpace.spaceId}`)
  const ownerSpace = (await response.json()).space
  const ownerFeedback = ownerSpace.channels.find((channel) => channel.id === feedbackChannel.channelId)
  assert.deepEqual(ownerFeedback.permissions, [
    { role: 'moderator', can_view: true, can_send: true, can_speak: true },
    { role: 'member', can_view: true, can_send: true, can_speak: true },
    { role: 'guest', can_view: true, can_send: true, can_speak: true },
  ])
  const announcementPermissions = ownerSpace.channels
    .find((channel) => channel.id === announcementChannel.channelId).permissions
  assert.equal(announcementPermissions.find((permission) => permission.role === 'member').can_send, false)

  const configuredPermissions = [
    { role: 'moderator', can_view: true, can_send: true, can_speak: true },
    { role: 'member', can_view: true, can_send: false, can_speak: true },
    { role: 'guest', can_view: false, can_send: false, can_speak: false },
  ]
  response = await apiRequest(ava, `/api/spaces/${createdSpace.spaceId}/channels/${feedbackChannel.channelId}/permissions`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      permissions: [
        { role: 'moderator', can_view: true, can_send: true, can_speak: true },
        { role: 'member', can_view: false, can_send: true, can_speak: true },
        { role: 'guest', can_view: false, can_send: false, can_speak: false },
      ],
    }),
  })
  assert.equal(response.status, 400)
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}/channels/${feedbackChannel.channelId}/permissions`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ permissions: configuredPermissions }),
  })
  assert.equal(response.status, 403)
  response = await apiRequest(ava, `/api/spaces/${createdSpace.spaceId}/channels/${feedbackChannel.channelId}/permissions`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ permissions: configuredPermissions }),
  })
  assert.equal(response.status, 200, await response.clone().text())
  response = await apiRequest(chris, `/api/spaces/${createdSpace.spaceId}`)
  const restrictedMemberSpace = (await response.json()).space
  const restrictedFeedback = restrictedMemberSpace.channels.find((channel) => channel.id === feedbackChannel.channelId)
  assert.equal(restrictedFeedback.can_send, false)
  const defaultVoicePermission = restrictedMemberSpace.channels.find((channel) => channel.id === voiceChannel.channelId)
  assert.equal(defaultVoicePermission.can_speak, true)
  response = await apiRequest(chris, `/api/spaces/${createdSpace.spaceId}/channels/${feedbackChannel.channelId}/messages`)
  assert.equal(response.status, 200, await response.clone().text())
  response = await post(chris, `/api/spaces/${createdSpace.spaceId}/channels/${feedbackChannel.channelId}/messages`, {
    body: 'Role settings should reject this message.',
  })
  assert.equal(response.status, 403)

  const mentionedText = `Hey @${nadia.username}, please take a look.`
  response = await apiRequest(nadia, `/api/events?chat_id=${generalChannel.id}`)
  assert.equal(response.status, 200)
  const mentionReader = response.body.getReader()
  await waitForEvent(mentionReader, 'ready')
  const mentionPing = waitForEvent(mentionReader, 'channel.mention')
  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/messages`, { body: mentionedText })
  assert.equal(response.status, 201, await response.clone().text())
  const mentionPingEvent = await mentionPing
  assert.equal(mentionPingEvent.chatId, generalChannel.id)
  assert.equal(typeof mentionPingEvent.messageId, 'string')
  assert.equal(Object.hasOwn(mentionPingEvent, 'body'), false)
  await mentionReader.cancel()
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/messages`)
  const mentionedMessages = (await response.json()).messages
  const mentionedMessage = mentionedMessages.find((message) => message.body === mentionedText)
  assert.ok(mentionedMessage)
  assert.deepEqual(mentionedMessage.mentions.map((mention) => mention.id), [nadia.id])
  assert.equal(mentionedMessage.everyone_mentioned, false)
  assert.equal(mentionedMessage.is_mentioned, true)
  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/messages`, { body: 'Kickoff update for @everyone.' })
  assert.equal(response.status, 201, await response.clone().text())
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/messages`)
  const everyoneMessage = (await response.json()).messages.find((message) => message.body === 'Kickoff update for @everyone.')
  assert.equal(everyoneMessage.everyone_mentioned, true)
  assert.equal(everyoneMessage.is_mentioned, true)
  assert.equal(everyoneMessage.mentions.some((mention) => mention.id === nadia.id), true)
  response = await post(nadia, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/messages`, { body: 'Unauthorized @everyone ping.' })
  assert.equal(response.status, 403)

  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}/channels/${voiceChannel.channelId}/voice/token`, { method: 'POST' })
  assert.equal(response.status, 404)
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}/channels/${voiceChannel.channelId}/voice`)
  assert.equal(response.status, 404)
  const voicePermissions = ownerSpace.channels.find((channel) => channel.id === voiceChannel.channelId)
    .permissions.map((permission) => ({
      ...permission,
      ...(permission.role === 'member' ? { can_speak: false } : {}),
    }))
  response = await apiRequest(ava, `/api/spaces/${createdSpace.spaceId}/channels/${voiceChannel.channelId}/permissions`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ permissions: voicePermissions }),
  })
  assert.equal(response.status, 200, await response.clone().text())
  response = await apiRequest(chris, `/api/spaces/${createdSpace.spaceId}/channels/${voiceChannel.channelId}/voice/token`, { method: 'POST' })
  assert.ok([200, 503].includes(response.status), await response.clone().text())
  if (response.status === 200) {
    const voiceToken = await response.json()
    assert.equal(voiceToken.canSpeak, false)
    assert.equal(typeof voiceToken.token, 'string')
    const voiceClaims = JSON.parse(Buffer.from(voiceToken.token.split('.')[1], 'base64url').toString('utf8'))
    assert.equal(voiceClaims.video.canPublish, false)
    response = await apiRequest(chris, `/api/spaces/${createdSpace.spaceId}/channels/${voiceChannel.channelId}/voice`)
    assert.equal(response.status, 200, await response.clone().text())
    assert.deepEqual((await response.json()).participants, [])
  }
  response = await apiRequest(chris, `/api/spaces/${createdSpace.spaceId}/channels/${voiceChannel.channelId}/messages`)
  assert.equal(response.status, 404)
  response = await post(chris, `/api/spaces/${createdSpace.spaceId}/channels/${voiceChannel.channelId}/messages`, { body: 'Text does not belong in voice rooms.' })
  assert.equal(response.status, 400)

  configuredPermissions[1].can_view = false
  configuredPermissions[1].can_speak = false
  response = await apiRequest(ava, `/api/spaces/${createdSpace.spaceId}/channels/${feedbackChannel.channelId}/permissions`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ permissions: configuredPermissions }),
  })
  assert.equal(response.status, 200, await response.clone().text())
  response = await apiRequest(chris, `/api/spaces/${createdSpace.spaceId}`)
  const hiddenChannelSpace = (await response.json()).space
  assert.equal(hiddenChannelSpace.channels.some((channel) => channel.id === feedbackChannel.channelId), false)
  assert.equal(hiddenChannelSpace.categories.some((category) => category.id === clientCategory.id), false)
  response = await apiRequest(chris, '/api/spaces')
  assert.equal((await response.json()).spaces.some((item) => item.id === createdSpace.spaceId && item.channel_count === 3), true)
  response = await apiRequest(chris, `/api/spaces/${createdSpace.spaceId}/channels/${feedbackChannel.channelId}/messages`)
  assert.equal(response.status, 404)
  response = await post(chris, `/api/spaces/${createdSpace.spaceId}/channels/${feedbackChannel.channelId}/messages`, {
    body: 'A hidden channel must not accept this message.',
  })
  assert.equal(response.status, 404)
  response = await apiRequest(chris, `/api/events?chat_id=${feedbackChannel.channelId}`)
  if (response.status === 200) await response.body?.cancel()
  assert.equal(response.status, 404)
  response = await post(chris, `/api/chats/${feedbackChannel.channelId}/typing`, { active: true })
  assert.equal(response.status, 404)
  response = await apiRequest(ava, `/api/spaces/${createdSpace.spaceId}`)
  assert.equal((await response.json()).space.channels.some((channel) => channel.id === feedbackChannel.channelId), true)
  response = await apiRequest(nadia, '/api/spaces')
  assert.equal(response.status, 200)
  assert.equal((await response.json()).spaces.length, 1)
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}`)
  assert.equal(response.status, 200, await response.clone().text())
  const nadiaSpaceResponse = await response.json()
  assert.deepEqual(nadiaSpaceResponse.space.channels.map((channel) => channel.name), ['general'])
  assert.equal(JSON.stringify(nadiaSpaceResponse).includes('internal'), false)
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}/channels/${privateChannel.channelId}/messages`)
  assert.equal(response.status, 404)
  response = await post(nadia, `/api/spaces/${createdSpace.spaceId}/members`, { username: chris.username, role: 'guest' })
  assert.equal(response.status, 403)

  response = await apiRequest(chris, `/api/spaces/${createdSpace.spaceId}`)
  assert.equal(response.status, 200, await response.clone().text())
  const chrisSpace = (await response.json()).space
  assert.deepEqual(new Set(chrisSpace.channels.map((channel) => channel.name)), new Set(['general', 'announcements', 'lounge']))
  assert.equal(chrisSpace.channels.find((channel) => channel.id === announcementChannel.channelId).can_send, false)
  assert.equal(JSON.stringify(chrisSpace).includes('internal'), false)
  response = await apiRequest(chris, `/api/spaces/${createdSpace.spaceId}/channels/${privateChannel.channelId}/messages`)
  assert.equal(response.status, 404)
  response = await apiRequest(chris, `/api/chats/${generalChannel.id}`)
  assert.equal(response.status, 404)
  const encryptedWrongChannelPath = await encryptMessage('Not a channel message path.', [ava, nadia, chris])
  response = await post(chris, `/api/chats/${generalChannel.id}/messages`, {
    ...encryptedWrongChannelPath,
    idempotencyKey: randomUUID(),
  })
  assert.equal(response.status, 404)
  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/messages`, { body: 'Welcome to the client room.' })
  assert.equal(response.status, 201, await response.clone().text())
  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/channels/${announcementChannel.channelId}/messages`, { body: 'Project kickoff is Monday.' })
  assert.equal(response.status, 201, await response.clone().text())
  response = await post(chris, `/api/spaces/${createdSpace.spaceId}/channels/${announcementChannel.channelId}/messages`, { body: 'Only moderators can post here.' })
  assert.equal(response.status, 403)
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/messages`)
  assert.equal(response.status, 200, await response.clone().text())
  const generalMessages = (await response.json()).messages
  assert.equal(generalMessages.length, 3)
  assert.equal(generalMessages.find((message) => message.body === 'Welcome to the client room.')?.display_name, 'Ava')

  const privateSearchSecret = 'private-channel-search-isolation-marker'
  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/channels/${privateChannel.channelId}/messages`, { body: privateSearchSecret })
  assert.equal(response.status, 201, await response.clone().text())
  response = await apiRequest(ava, `/api/spaces/${createdSpace.spaceId}/search?q=${privateSearchSecret}`)
  assert.equal(response.status, 200, await response.clone().text())
  assert.equal((await response.json()).results.some((result) => result.title === privateSearchSecret), true)
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}/search?q=${privateSearchSecret}`)
  assert.equal(response.status, 200, await response.clone().text())
  assert.deepEqual((await response.json()).results, [])
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}/search?q=Welcome&from=${ava.id}`)
  assert.equal(response.status, 200, await response.clone().text())
  assert.equal((await response.json()).results.some((result) => result.type === 'message' && result.channel_id === generalChannel.id), true)
  response = await apiRequest(ava, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/files`)
  assert.equal(response.status, 200, await response.clone().text())
  assert.deepEqual((await response.json()).files, [])
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}/channels/${privateChannel.channelId}/files`)
  assert.equal(response.status, 404)
  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/files`, {
    filename: 'unsupported.html',
    contentType: 'text/html',
    sizeBytes: 20,
  })
  assert.equal(response.status, 400)
  const spaceFileBytes = Buffer.from('Project notes shared with channel members.')
  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/files`, {
    filename: 'release-notes.txt',
    contentType: 'text/plain',
    sizeBytes: spaceFileBytes.byteLength,
  })
  assert.equal(response.status, 201, await response.clone().text())
  const spaceFile = await response.json()
  response = await apiRequest(ava, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/files/${spaceFile.fileId}/content`, {
    method: 'PUT',
    headers: { 'content-type': 'text/plain' },
    body: spaceFileBytes,
  })
  assert.equal(response.status, 204)
  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/files/${spaceFile.fileId}/complete`, {})
  assert.equal(response.status, 204)
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/files`)
  assert.equal(response.status, 200, await response.clone().text())
  assert.equal((await response.json()).files.some((file) => file.id === spaceFile.fileId), true)
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/files/${spaceFile.fileId}/content`)
  assert.equal(response.status, 200)
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), spaceFileBytes)
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}/search?q=release-notes&has=file`)
  assert.equal(response.status, 200, await response.clone().text())
  assert.equal((await response.json()).results.some((result) => result.type === 'file' && result.id === spaceFile.fileId), true)

  const channelObjectsPath = `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/objects`
  response = await post(ava, channelObjectsPath, {
    type: 'poll', question: 'Which direction?', options: ['Minimal', 'Expressive'], anonymous: true,
  })
  assert.equal(response.status, 201, await response.clone().text())
  const pollId = (await response.json()).objectId
  response = await apiRequest(nadia, `/api/spaces/${createdSpace.spaceId}/search?q=Minimal&objectType=poll`)
  assert.equal(response.status, 200, await response.clone().text())
  assert.equal((await response.json()).results.some((result) => result.type === 'object' && result.id === pollId), true)
  response = await apiRequest(chris, channelObjectsPath)
  const poll = (await response.json()).objects.find((item) => item.id === pollId)
  assert.deepEqual(poll.payload.options.map((option) => option.text), ['Minimal', 'Expressive'])
  response = await apiRequest(nadia, '/api/spaces/updates')
  assert.equal(response.status, 200, await response.clone().text())
  assert.ok((await response.json()).stacks.needsYou.some((item) => item.id === pollId))
  response = await post(chris, `${channelObjectsPath}/${pollId}/respond`, {
    type: 'poll', optionIds: [poll.payload.options[1].id],
  })
  assert.equal(response.status, 200, await response.clone().text())
  response = await apiRequest(nadia, channelObjectsPath)
  const publicPoll = (await response.json()).objects.find((item) => item.id === pollId)
  assert.deepEqual(publicPoll.response_counts, { [poll.payload.options[1].id]: 1 })
  assert.equal(JSON.stringify(publicPoll).includes(chris.id), false)

  response = await post(ava, channelObjectsPath, {
    type: 'event', title: 'Design review', startsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    timezone: 'Mars/Phobos', rsvpRequired: true,
  })
  assert.equal(response.status, 400)
  response = await post(ava, channelObjectsPath, {
    type: 'event', title: 'Design review', startsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    timezone: 'UTC', rsvpRequired: true,
  })
  assert.equal(response.status, 201, await response.clone().text())
  const eventId = (await response.json()).objectId
  response = await apiRequest(nadia, '/api/spaces/updates')
  assert.ok((await response.json()).stacks.needsYou.some((item) => item.id === eventId))
  response = await post(nadia, `${channelObjectsPath}/${eventId}/respond`, { type: 'event', rsvp: 'yes' })
  assert.equal(response.status, 200, await response.clone().text())

  response = await post(ava, channelObjectsPath, {
    type: 'checklist', title: 'Launch checklist',
    items: [{ text: 'Review copy', assigneeId: chris.id }],
  })
  assert.equal(response.status, 201, await response.clone().text())
  const checklistId = (await response.json()).objectId
  response = await post(ava, channelObjectsPath, {
    type: 'checklist', title: 'Invalid assignment', items: [{ text: 'Review copy', assigneeId: randomUUID() }],
  })
  assert.equal(response.status, 400)
  response = await apiRequest(chris, channelObjectsPath)
  const checklist = (await response.json()).objects.find((item) => item.id === checklistId)
  response = await post(chris, `${channelObjectsPath}/${checklistId}/respond`, {
    type: 'checklist', itemId: checklist.payload.items[0].id, done: true,
  })
  assert.equal(response.status, 200, await response.clone().text())
  response = await apiRequest(ava, channelObjectsPath)
  assert.equal((await response.json()).objects.find((item) => item.id === checklistId).state, 'completed')

  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/messages`, {
    body: 'Decision source for release planning.',
  })
  assert.equal(response.status, 201, await response.clone().text())
  const sourceMessagesResponse = await apiRequest(ava, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/messages`)
  const sourceMessage = (await sourceMessagesResponse.json()).messages.find((message) => message.body === 'Decision source for release planning.')
  assert.ok(sourceMessage)
  response = await post(ava, `/api/spaces/${createdSpace.spaceId}/channels/${generalChannel.id}/messages/${sourceMessage.id}/decision`, {
    title: 'Ship the minimal direction',
  })
  assert.equal(response.status, 201, await response.clone().text())
  const decisionId = (await response.json()).objectId
  response = await apiRequest(ava, '/api/spaces/updates')
  const updates = (await response.json()).stacks
  assert.ok(updates.happening.some((item) => item.id === eventId) === false)
  assert.ok(updates.decided.some((item) => item.id === checklistId))
  assert.ok(updates.decided.some((item) => item.id === decisionId))
  response = await apiRequest(chris, '/api/spaces/updates?q=release')
  assert.equal(response.status, 200, await response.clone().text())

  response = await post(chris, `/api/spaces/${createdSpace.spaceId}/channels/${privateChannel.channelId}/messages`, { body: 'This must not go through.' })
  assert.equal(response.status, 404)
  response = await apiRequest(ava, '/api/spaces')
  assert.equal((await response.json()).spaces.some((item) => item.id === createdSpace.spaceId && item.channel_count === 5), true)
  response = await apiRequest(nadia, `/api/spaces/${randomUUID()}`)
  assert.equal(response.status, 404)
  response = await apiRequest(chris, '/api/inbox')
  assert.equal((await response.json()).chats.some((chat) => chat.kind === 'channel'), false)

  const invalidAvatar = await apiRequest(ava, '/api/auth/me/avatar', {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body: Buffer.from('not an image'),
  })
  assert.equal(invalidAvatar.status, 400)

  const avatarBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8ioAAAAASUVORK5CYII=', 'base64')
  const uploadedAvatar = await apiRequest(ava, '/api/auth/me/avatar', {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body: avatarBytes,
  })
  assert.equal(uploadedAvatar.status, 200, await uploadedAvatar.clone().text())
  const uploadedProfile = (await uploadedAvatar.json()).user
  assert.match(uploadedProfile.avatar_url, new RegExp(`^/api/auth/avatars/${ava.id}\\?v=`))

  const avatarResponse = await apiRequest(nadia, uploadedProfile.avatar_url)
  assert.equal(avatarResponse.status, 200)
  assert.equal(avatarResponse.headers.get('content-type'), 'image/png')
  assert.deepEqual(Buffer.from(await avatarResponse.arrayBuffer()), avatarBytes)
  const unauthenticatedAvatar = await apiRequest(null, uploadedProfile.avatar_url)
  assert.equal(unauthenticatedAvatar.status, 401)

  const savedProfile = await apiRequest(ava, '/api/auth/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName: ava.displayName, username: ava.username, about: '' }),
  })
  assert.equal(savedProfile.status, 200)
  assert.equal((await savedProfile.json()).user.avatar_url, uploadedProfile.avatar_url)

  const replacementAvatar = await apiRequest(ava, '/api/auth/me/avatar', {
    method: 'PUT',
    headers: { 'content-type': 'image/png' },
    body: avatarBytes,
  })
  assert.equal(replacementAvatar.status, 200, await replacementAvatar.clone().text())
  const replacementProfile = (await replacementAvatar.json()).user
  assert.notEqual(replacementProfile.avatar_url, uploadedProfile.avatar_url)
  assert.equal((await apiRequest(nadia, uploadedProfile.avatar_url)).status, 404)

  const removedAvatar = await apiRequest(ava, '/api/auth/me/avatar', { method: 'DELETE' })
  assert.equal(removedAvatar.status, 200, await removedAvatar.clone().text())
  assert.equal((await removedAvatar.json()).user.avatar_url, null)
  const missingAvatar = await apiRequest(nadia, replacementProfile.avatar_url)
  assert.equal(missingAvatar.status, 404)

  response = await apiRequest(nadia, '/api/auth/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName: nadia.displayName, username: nadia.username, about: '', discoverable: false }),
  })
  assert.equal(response.status, 200, await response.clone().text())
  assert.equal((await response.json()).user.discoverable, false)
  response = await apiRequest(ava, `/api/users?username=${encodeURIComponent(nadia.username)}`)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).users.some((match) => match.id === nadia.id), false)
  response = await apiRequest(ava, `/api/search?q=${encodeURIComponent(nadia.username)}`)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).people.some((match) => match.id === nadia.id), false)
  response = await apiRequest(nadia, '/api/auth/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName: nadia.displayName, username: nadia.username, about: '', discoverable: true }),
  })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).user.discoverable, true)
  response = await apiRequest(ava, `/api/users?username=${encodeURIComponent(nadia.username)}`)
  assert.equal(response.status, 200)
  const target = (await response.json()).users[0]
  assert.equal(target.id, nadia.id)
  response = await apiRequest(ava, `/api/users?username=${encodeURIComponent(nadia.username.slice(0, 3))}`)
  assert.equal(response.status, 200)
  assert.ok((await response.json()).users.some((match) => match.id === nadia.id))

  const firstEncrypted = await encryptMessage('Hello, Nadia — this is private.', [ava, {
    id: nadia.id,
    publicKey: target.publicKey,
  }])
  response = await post(ava, '/api/requests', {
    username: nadia.username,
    message: { ...firstEncrypted, idempotencyKey: randomUUID() },
  })
  assert.equal(response.status, 201, await response.clone().text())
  const messageRequest = await response.json()

  response = await apiRequest(nadia, '/api/inbox')
  const inbox = await response.json()
  assert.equal(response.status, 200, JSON.stringify(inbox))
  assert.equal(inbox.chats.length, 0)
  response = await apiRequest(nadia, '/api/requests')
  const requestBody = await response.json()
  assert.equal(response.status, 200, JSON.stringify(requestBody))
  const requests = requestBody.requests
  assert.equal(requests.length, 1)
  assert.equal(await decryptMessage(requests[0], nadia), 'Hello, Nadia — this is private.')
  response = await apiRequest(nadia, `/api/chats/${messageRequest.chatId}`)
  assert.equal(response.status, 404)
  response = await post(nadia, `/api/chats/${messageRequest.chatId}/read`, { lastSeq: 1 })
  assert.equal(response.status, 404)

  response = await post(nadia, `/api/requests/${messageRequest.requestId}/accept`, {})
  assert.equal(response.status, 200)
  response = await apiRequest(ava, '/api/contacts')
  assert.equal((await response.json()).contacts.length, 1)
  response = await apiRequest(ava, `/api/search?q=${encodeURIComponent(nadia.username)}`)
  assert.equal(response.status, 200, await response.clone().text())
  const searchResults = await response.json()
  assert.ok(searchResults.people.some((person) => person.id === nadia.id))
  assert.ok(searchResults.chats.some((item) => item.id === messageRequest.chatId))
  assert.match(searchResults.privacy, /only on this device/u)
  assert.equal(JSON.stringify(searchResults).includes('Hello, Nadia'), false)
  response = await fetch(new URL(`/api/search?q=${encodeURIComponent(nadia.username)}`, apiBase))
  assert.equal(response.status, 401)
  response = await apiRequest(nadia, '/api/inbox')
  assert.equal((await response.json()).chats.length, 1)

  const chatPath = `/api/chats/${messageRequest.chatId}`
  response = await post(nadia, `${chatPath}/read`, { lastSeq: 1 })
  assert.equal(response.status, 200)
  response = await apiRequest(ava, chatPath)
  const chat = (await response.json()).chat
  assert.deepEqual(new Set(chat.members.map((member) => member.id)), new Set([ava.id, nadia.id]))
  const eventController = new AbortController()
  const eventResponse = await fetch(new URL(`/api/events?chat_id=${messageRequest.chatId}`, apiBase), {
    headers: { cookie: nadia.header() },
    signal: eventController.signal,
  })
  assert.equal(eventResponse.status, 200)
  const eventReader = eventResponse.body.getReader()
  const readyEvent = await eventReader.read()
  assert.match(new TextDecoder().decode(readyEvent.value), /event: ready/)
  const presenceController = new AbortController()
  const presenceResponse = await fetch(new URL(`/api/events?chat_id=${messageRequest.chatId}`, apiBase), {
    headers: { cookie: ava.header() },
    signal: presenceController.signal,
  })
  assert.equal(presenceResponse.status, 200)
  const presenceReader = presenceResponse.body.getReader()
  const presenceReady = await presenceReader.read()
  assert.match(new TextDecoder().decode(presenceReady.value), /event: ready/)
  response = await post(nadia, `/api/chats/${messageRequest.chatId}/typing`, { active: true })
  assert.equal(response.status, 204)
  assert.deepEqual(await waitForEvent(presenceReader, 'typing'), {
    userId: nadia.id,
    displayName: nadia.displayName,
    active: true,
  })
  response = await post(chris, `/api/chats/${messageRequest.chatId}/typing`, { active: true })
  assert.equal(response.status, 404)
  await post(nadia, `/api/chats/${messageRequest.chatId}/typing`, { active: false })
  presenceController.abort()
  await presenceReader.cancel().catch(() => undefined)
  const hintPromise = (async () => {
    let buffer = ''
    while (true) {
      const { value, done } = await eventReader.read()
      if (done) throw new Error('Realtime stream closed before the message hint arrived.')
      buffer += new TextDecoder().decode(value, { stream: true })
      const match = buffer.match(/event: message\.created\ndata: ([^\r\n]+)/)
      if (match) return JSON.parse(match[1])
    }
  })()
  const filePlaintext = encoder.encode('Encrypted client file content.')
  const encryptedFile = await encryptAttachment(filePlaintext, chat.members)
  response = await post(ava, '/api/uploads/intent', {
    chatId: messageRequest.chatId,
    filename: 'meeting-notes.txt',
    contentType: 'text/plain',
    sizeBytes: filePlaintext.byteLength,
    nonce: encryptedFile.nonce,
    keyEnvelopes: encryptedFile.keyEnvelopes,
  })
  assert.equal(response.status, 201, await response.clone().text())
  const uploadIntent = await response.json()
  const objectUpload = await apiRequest(ava, `/api/uploads/${uploadIntent.attachmentId}/content`, {
    method: 'PUT',
    headers: { 'content-type': 'application/octet-stream' },
    body: encryptedFile.ciphertext,
  })
  assert.equal(objectUpload.status, 204, await objectUpload.text())
  response = await post(ava, `/api/uploads/${uploadIntent.attachmentId}/complete`, {})
  assert.equal(response.status, 204)
  response = await apiRequest(chris, `/api/uploads/${uploadIntent.attachmentId}`)
  assert.equal(response.status, 404)

  const posterPlaintext = encoder.encode('Encrypted video poster content.')
  const encryptedPoster = await encryptAttachment(posterPlaintext, chat.members)
  response = await post(ava, '/api/uploads/intent', {
    chatId: messageRequest.chatId,
    filename: 'video-preview.jpg',
    contentType: 'image/jpeg',
    sizeBytes: posterPlaintext.byteLength,
    nonce: encryptedPoster.nonce,
    keyEnvelopes: encryptedPoster.keyEnvelopes,
  })
  assert.equal(response.status, 201, await response.clone().text())
  const posterIntent = await response.json()
  const posterUpload = await apiRequest(ava, `/api/uploads/${posterIntent.attachmentId}/content`, {
    method: 'PUT',
    headers: { 'content-type': 'application/octet-stream' },
    body: encryptedPoster.ciphertext,
  })
  assert.equal(posterUpload.status, 204, await posterUpload.text())
  response = await post(ava, `/api/uploads/${posterIntent.attachmentId}/complete`, {})
  assert.equal(response.status, 204)

  const videoEnvelope = await encryptAttachment(filePlaintext, chat.members)
  response = await post(ava, '/api/uploads/v2/intent', {
    attachmentId: randomUUID(),
    chatId: messageRequest.chatId,
    filename: 'test-video.mp4',
    contentType: 'video/mp4',
    mediaKind: 'video',
    mediaMode: 'original',
    posterAttachmentId: posterIntent.attachmentId,
    plaintextSize: 1000,
    ciphertextSize: 1052,
    chunkSize: 5 * 1024 * 1024,
    chunkCount: 1,
    encryptionVersion: 2,
    keyEnvelopes: videoEnvelope.keyEnvelopes,
    durationMs: 1000,
    width: 640,
    height: 360,
  })
  assert.equal(response.status, 201, await response.clone().text())
  const videoIntent = await response.json()
  response = await apiRequest(ava, `/api/uploads/v2/${videoIntent.attachmentId}/session`, {
    method: 'DELETE',
  })
  assert.equal(response.status, 204)

  const encrypted = await encryptMessage('Message two should exist once.', chat.members)
  const duplicateAttachments = await post(ava, `${chatPath}/messages`, {
    ...encrypted,
    attachmentIds: [uploadIntent.attachmentId, uploadIntent.attachmentId],
    idempotencyKey: randomUUID(),
  })
  assert.equal(duplicateAttachments.status, 400)
  const idempotencyKey = randomUUID()
  const payload = { ...encrypted, attachmentIds: [uploadIntent.attachmentId], idempotencyKey }
  response = await post(ava, `${chatPath}/messages`, payload)
  assert.equal(response.status, 201, await response.clone().text())
  const saved = await response.json()
  assert.equal(Number(saved.serverSeq), 2)
  let hintTimeout
  try {
    const hint = await Promise.race([
      hintPromise,
      new Promise((_, reject) => {
        hintTimeout = setTimeout(() => reject(new Error('Timed out waiting for realtime message hint.')), 5000)
      }),
    ])
    assert.deepEqual(hint, { chatId: messageRequest.chatId, serverSeq: 2 })
  } finally {
    clearTimeout(hintTimeout)
    eventController.abort()
    await eventReader.cancel().catch(() => undefined)
    await hintPromise.catch(() => undefined)
  }
  response = await post(ava, `${chatPath}/messages`, payload)
  assert.equal(response.status, 200)
  const replay = await response.json()
  assert.equal(replay.duplicate, true)
  assert.equal(replay.messageId, saved.messageId)
  assert.equal(Number(replay.serverSeq), 2)

  const receiptController = new AbortController()
  context.after(() => receiptController.abort())
  const receiptStream = await fetch(new URL(`/api/events?chat_id=${messageRequest.chatId}`, apiBase), {
    headers: { cookie: ava.header() },
    signal: receiptController.signal,
  })
  assert.equal(receiptStream.status, 200)
  const receiptReader = receiptStream.body.getReader()
  await waitForEvent(receiptReader, 'ready')

  response = await apiRequest(nadia, `${chatPath}/messages?after_seq=1&limit=10`)
  let messagePage = await response.json()
  assert.equal(response.status, 200, JSON.stringify(messagePage))
  let messages = messagePage.messages
  assert.equal(messages.length, 1)
  assert.deepEqual(messages[0].delivery_receipts, [])
  assert.equal(await decryptMessage(messages[0], nadia), 'Message two should exist once.')
  assert.equal(messages[0].attachments.length, 1)
  assert.equal(messages[0].attachments[0].filename, 'meeting-notes.txt')
  const firstDeviceDelivery = waitForEvent(receiptReader, 'message.delivered')
  response = await apiRequest(nadia, `${chatPath}/messages?after_seq=1&limit=10`)
  assert.equal(response.status, 200)
  const firstDeliveryEvent = await firstDeviceDelivery
  assert.equal(firstDeliveryEvent.userId, nadia.id)
  assert.deepEqual(firstDeliveryEvent.messageIds, [saved.messageId])

  const secondNadiaDevice = await signInAccount(nadia)
  const secondDeviceDelivery = waitForEvent(receiptReader, 'message.delivered')
  response = await apiRequest(secondNadiaDevice, `${chatPath}/messages?after_seq=1&limit=10`)
  assert.equal(response.status, 200)
  const secondDeliveryEvent = await secondDeviceDelivery
  assert.equal(secondDeliveryEvent.userId, nadia.id)
  assert.deepEqual(secondDeliveryEvent.messageIds, [saved.messageId])

  response = await apiRequest(ava, `${chatPath}/messages?after_seq=1&limit=10`)
  const deliveredMessage = (await response.json()).messages[0]
  assert.deepEqual(deliveredMessage.delivery_receipts, [nadia.id])

  response = await apiRequest(nadia, `/api/uploads/${uploadIntent.attachmentId}`)
  assert.equal(response.status, 200, await response.clone().text())
  const download = (await response.json()).attachment
  const encryptedDownload = await apiRequest(nadia, download.downloadUrl)
  assert.equal(encryptedDownload.status, 200)
  const encryptedBytes = await encryptedDownload.arrayBuffer()
  assert.notEqual(Buffer.from(encryptedBytes).toString('utf8'), 'Encrypted client file content.')
  const decryptedBytes = await decryptAttachment(
    encryptedBytes,
    download.nonce,
    download.keyEnvelope,
    nadia,
  )
  assert.equal(new TextDecoder().decode(decryptedBytes), 'Encrypted client file content.')

  response = await apiRequest(chris, `${chatPath}/messages`)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).messages.length, 0)
  response = await apiRequest(chris, chatPath)
  assert.equal(response.status, 404)
  response = await apiRequest(chris, `/api/events?chat_id=${messageRequest.chatId}`)
  assert.equal(response.status, 404)

  const readEventPromise = waitForEvent(receiptReader, 'chat.read')
  response = await post(nadia, `${chatPath}/read`, { lastSeq: 9999 })
  assert.equal(response.status, 200)
  assert.equal(Number((await response.json()).lastReadSeq), 2)
  const readEvent = await readEventPromise
  assert.equal(readEvent.userId, nadia.id)
  assert.equal(Number(readEvent.lastReadSeq), 2)
  response = await apiRequest(nadia, '/api/auth/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      displayName: nadia.displayName,
      username: nadia.username,
      about: '',
      readReceiptsEnabled: false,
    }),
  })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).user.read_receipts_enabled, false)
  response = await apiRequest(ava, `${chatPath}/messages?after_seq=1&limit=10`)
  assert.deepEqual((await response.json()).messages[0].read_by, [])
  response = await apiRequest(nadia, '/api/auth/me', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      displayName: nadia.displayName,
      username: nadia.username,
      about: '',
      readReceiptsEnabled: true,
    }),
  })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).user.read_receipts_enabled, true)
  response = await apiRequest(ava, `${chatPath}/messages?after_seq=1&limit=10`)
  const readMessage = (await response.json()).messages[0]
  assert.deepEqual(readMessage.read_by, [nadia.id])
  await receiptReader.cancel()
  receiptController.abort()
  response = await post(nadia, `/api/messages/${saved.messageId}/reactions`, { emoji: '👍' })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).active, true)

  response = await post(ava, '/api/chats/groups', { title: 'Launch crew', usernames: [nadia.username] })
  assert.equal(response.status, 201, await response.clone().text())
  const group = await response.json()
  response = await apiRequest(ava, `/api/chats/${group.chatId}`)
  const groupChat = (await response.json()).chat
  assert.equal(groupChat.members.length, 2)
  const groupCallKey = webcrypto.getRandomValues(new Uint8Array(32))
  const groupCallEnvelopes = await wrapCallKey(groupCallKey, groupChat.members)
  response = await post(ava, '/api/group-calls', {
    chatId: group.chatId,
    callType: 'audio',
    keyEnvelopes: { [ava.id]: groupCallEnvelopes[ava.id] },
  })
  assert.equal(response.status, 409)
  response = await post(ava, '/api/group-calls', {
    chatId: group.chatId,
    callType: 'audio',
    keyEnvelopes: groupCallEnvelopes,
  })
  let groupCallId = null
  if (response.status === 503) {
    assert.equal((await response.json()).error.code, 'service_unavailable')
  } else {
    assert.equal(response.status, 201, await response.clone().text())
    groupCallId = (await response.json()).call.id
    response = await post(ava, '/api/group-calls', {
      chatId: group.chatId,
      callType: 'audio',
      keyEnvelopes: groupCallEnvelopes,
    })
    assert.equal(response.status, 409)
    response = await post(ava, `/api/chats/${group.chatId}/members`, { username: nadia.username })
    assert.equal(response.status, 409)
    response = await apiRequest(nadia, '/api/group-calls/incoming')
    const incomingGroupCall = (await response.json()).calls.find((call) => call.id === groupCallId)
    assert.ok(incomingGroupCall)
    assert.equal(incomingGroupCall.group_title, 'Launch crew')
    assert.equal(Object.hasOwn(incomingGroupCall, 'key_envelope'), false)
    response = await post(nadia, `/api/group-calls/${groupCallId}/answer`, {})
    assert.equal(response.status, 200, await response.clone().text())
    const answeredGroupCall = (await response.json()).call
    assert.equal(answeredGroupCall.key_envelope, groupCallEnvelopes[nadia.id])
    assert.deepEqual(await unwrapCallKey(answeredGroupCall.key_envelope, nadia), groupCallKey)
    response = await apiRequest(nadia, `/api/group-calls/${groupCallId}/token`, { method: 'POST' })
    assert.equal(response.status, 200, await response.clone().text())
    response = await apiRequest(chris, `/api/group-calls/${groupCallId}/status`)
    assert.equal(response.status, 404)
  }
  groupCallKey.fill(0)
  const chrisFirstContact = await encryptMessage('Let’s connect before adding you to a group.', [ava, chris])
  response = await post(ava, '/api/requests', {
    username: chris.username,
    message: { ...chrisFirstContact, idempotencyKey: randomUUID() },
  })
  assert.equal(response.status, 201, await response.clone().text())
  const chrisRequest = await response.json()
  response = await post(chris, `/api/requests/${chrisRequest.requestId}/accept`, {})
  assert.equal(response.status, 200)
  response = await post(ava, `/api/chats/${group.chatId}/members`, { username: chris.username })
  assert.equal(response.status, 201, await response.clone().text())
  let leaveTriggeredCallId = null
  if (groupCallId) {
    response = await apiRequest(nadia, `/api/group-calls/${groupCallId}/status`)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).status, 'ended')
    response = await apiRequest(nadia, `/api/group-calls/${groupCallId}/token`, { method: 'POST' })
    assert.equal(response.status, 404)
    response = await apiRequest(nadia, `/api/chats/${group.chatId}/group-calls`)
    assert.equal((await response.json()).calls[0].is_group, true)

    response = await apiRequest(ava, `/api/chats/${group.chatId}`)
    const expandedGroup = (await response.json()).chat
    assert.equal(expandedGroup.members.length, 3)
    const secondGroupCallKey = webcrypto.getRandomValues(new Uint8Array(32))
    const secondGroupCallEnvelopes = await wrapCallKey(secondGroupCallKey, expandedGroup.members)
    response = await post(ava, '/api/group-calls', {
      chatId: group.chatId,
      callType: 'video',
      keyEnvelopes: secondGroupCallEnvelopes,
    })
    assert.equal(response.status, 201, await response.clone().text())
    const secondGroupCallId = (await response.json()).call.id
    for (const recipient of [nadia, chris]) {
      response = await apiRequest(recipient, '/api/group-calls/incoming')
      assert.ok((await response.json()).calls.some((call) => call.id === secondGroupCallId))
    }
    response = await post(nadia, `/api/group-calls/${secondGroupCallId}/answer`, {})
    assert.equal(response.status, 200, await response.clone().text())
    const acceptedCall = (await response.json()).call
    assert.deepEqual(await unwrapCallKey(acceptedCall.key_envelope, nadia), secondGroupCallKey)
    response = await post(chris, `/api/group-calls/${secondGroupCallId}/decline`, {})
    assert.equal(response.status, 204)
    response = await apiRequest(ava, `/api/group-calls/${secondGroupCallId}/status`)
    const groupCallStatus = await response.json()
    assert.equal(groupCallStatus.status, 'active')
    assert.equal(groupCallStatus.participants.find((participant) => participant.user_id === chris.id).status, 'declined')
    response = await post(ava, `/api/group-calls/${secondGroupCallId}/end`, {})
    assert.equal(response.status, 204)
    secondGroupCallKey.fill(0)

    const leaveCallKey = webcrypto.getRandomValues(new Uint8Array(32))
    response = await post(ava, '/api/group-calls', {
      chatId: group.chatId,
      callType: 'audio',
      keyEnvelopes: await wrapCallKey(leaveCallKey, expandedGroup.members),
    })
    assert.equal(response.status, 201, await response.clone().text())
    leaveTriggeredCallId = (await response.json()).call.id
    leaveCallKey.fill(0)
    console.info('PASS all-member group-call ringing, encrypted key access, decline, and host end')
  }
  response = await apiRequest(chris, `/api/chats/${group.chatId}`)
  assert.equal((await response.json()).chat.members.length, 3)
  response = await post(ava, `/api/chats/${group.chatId}/members`, { username: chris.username })
  assert.equal(response.status, 409)
  response = await post(chris, `/api/chats/${group.chatId}/leave`, {})
  assert.equal(response.status, 204)
  if (leaveTriggeredCallId) {
    response = await apiRequest(nadia, `/api/group-calls/${leaveTriggeredCallId}/status`)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).status, 'ended')
    console.info('PASS group-call teardown when a member leaves')
  }
  response = await apiRequest(chris, `/api/chats/${group.chatId}`)
  assert.equal(response.status, 404)
  response = await post(ava, `/api/chats/${group.chatId}/leave`, {})
  assert.equal(response.status, 204)
  response = await apiRequest(ava, `/api/chats/${group.chatId}`)
  assert.equal(response.status, 404)
  response = await apiRequest(nadia, `/api/chats/${group.chatId}`)
  const remainingGroup = (await response.json()).chat
  assert.equal(remainingGroup.members.length, 1)
  assert.equal(remainingGroup.members[0].role, 'owner')

  const more = await Promise.all([
    encryptMessage('Concurrent message A', chat.members),
    encryptMessage('Concurrent message B', chat.members),
  ])
  const sent = await Promise.all(more.map((message) => post(ava, `${chatPath}/messages`, {
    ...message,
    idempotencyKey: randomUUID(),
  })))
  for (const result of sent) assert.equal(result.status, 201, await result.clone().text())
  response = await apiRequest(ava, `${chatPath}/messages?limit=2`)
  const latestPage = await response.json()
  assert.deepEqual(latestPage.messages.map((message) => Number(message.server_seq)), [3, 4])
  assert.equal(latestPage.hasMore, true)
  response = await apiRequest(ava, `${chatPath}/messages?before_seq=4&limit=2`)
  const earlierPage = await response.json()
  assert.equal(response.status, 200, JSON.stringify(earlierPage))
  assert.deepEqual(earlierPage.messages.map((message) => Number(message.server_seq)), [2, 3])
  assert.equal(earlierPage.hasMore, true)
  response = await apiRequest(ava, `${chatPath}/messages?before_seq=2&limit=2`)
  const oldestPage = await response.json()
  assert.deepEqual(oldestPage.messages.map((message) => Number(message.server_seq)), [1])
  assert.equal(oldestPage.hasMore, false)
  response = await apiRequest(ava, `${chatPath}/messages?before_seq=4&after_seq=1`)
  assert.equal(response.status, 400)
  response = await apiRequest(nadia, `${chatPath}/messages?after_seq=2&limit=10`)
  messages = (await response.json()).messages
  assert.deepEqual(messages.map((message) => Number(message.server_seq)), [3, 4])

  const editablePayload = {
    ...(await encryptMessage('Original editable message', chat.members)),
    idempotencyKey: randomUUID(),
  }
  response = await post(ava, `${chatPath}/messages`, editablePayload)
  assert.equal(response.status, 201, await response.clone().text())
  const editableMessage = await response.json()
  const editedPayload = await encryptMessage('Updated encrypted text', chat.members)
  response = await apiRequest(ava, `/api/messages/${editableMessage.messageId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(editedPayload),
  })
  assert.equal(response.status, 200, await response.clone().text())
  response = await apiRequest(nadia, `${chatPath}/messages?after_seq=${editableMessage.serverSeq - 1}&limit=10`)
  const editedMessage = (await response.json()).messages.find((message) => message.id === editableMessage.messageId)
  assert.ok(editedMessage.edited_at)
  assert.equal(await decryptMessage(editedMessage, nadia), 'Updated encrypted text')

  response = await post(nadia, `/api/messages/${editableMessage.messageId}/reactions`, { emoji: '❤️' })
  assert.equal(response.status, 200, await response.clone().text())
  assert.equal((await response.json()).active, true)
  response = await apiRequest(ava, `${chatPath}/messages?after_seq=${editableMessage.serverSeq - 1}&limit=10`)
  let reactedMessage = (await response.json()).messages.find((message) => message.id === editableMessage.messageId)
  assert.ok(reactedMessage.reactions.some((reaction) => reaction.user_id === nadia.id && reaction.emoji === '❤️'))
  response = await post(nadia, `/api/messages/${editableMessage.messageId}/reactions`, { emoji: '👍' })
  assert.equal(response.status, 200, await response.clone().text())
  assert.equal((await response.json()).active, true)
  response = await apiRequest(ava, `${chatPath}/messages?after_seq=${editableMessage.serverSeq - 1}&limit=10`)
  reactedMessage = (await response.json()).messages.find((message) => message.id === editableMessage.messageId)
  assert.deepEqual(reactedMessage.reactions.filter((reaction) => reaction.user_id === nadia.id).map((reaction) => reaction.emoji), ['👍'])
  response = await post(nadia, `/api/messages/${editableMessage.messageId}/reactions`, { emoji: '❤️' })
  assert.equal((await response.json()).active, true)
  response = await post(nadia, `/api/messages/${editableMessage.messageId}/reactions`, { emoji: '❤️' })
  assert.equal((await response.json()).active, false)
  response = await apiRequest(ava, `${chatPath}/messages?after_seq=${editableMessage.serverSeq - 1}&limit=10`)
  reactedMessage = (await response.json()).messages.find((message) => message.id === editableMessage.messageId)
  assert.equal(reactedMessage.reactions.some((reaction) => reaction.user_id === nadia.id), false)

  response = await post(nadia, `/api/messages/${editableMessage.messageId}/pin`, {})
  assert.equal(response.status, 200)
  const pinResult = await response.json()
  assert.equal(pinResult.pinned, true)
  assert.equal(pinResult.pinned_by, nadia.id)
  response = await apiRequest(ava, `${chatPath}/messages?after_seq=${editableMessage.serverSeq - 1}&limit=10`)
  let pinnedMessage = (await response.json()).messages.find((message) => message.id === editableMessage.messageId)
  assert.ok(pinnedMessage.pinned_at)
  assert.equal(pinnedMessage.pinned_by, nadia.id)
  response = await post(nadia, `/api/messages/${editableMessage.messageId}/pin`, {})
  assert.equal((await response.json()).pinned, false)

  const replyPayload = {
    ...(await encryptMessage('Reply to the earlier message', chat.members)),
    idempotencyKey: randomUUID(),
    replyToId: editableMessage.messageId,
  }
  response = await post(nadia, `${chatPath}/messages`, replyPayload)
  assert.equal(response.status, 201, await response.clone().text())
  const replyMessage = await response.json()
  response = await apiRequest(ava, `${chatPath}/messages?after_seq=${replyMessage.serverSeq - 1}&limit=10`)
  const replyBody = (await response.json()).messages.find((message) => message.id === replyMessage.messageId)
  assert.equal(replyBody.reply_context.id, editableMessage.messageId)
  assert.equal(Number(replyBody.reply_context.server_seq), editableMessage.serverSeq)
  assert.equal(await decryptMessage(replyBody.reply_context, ava), 'Updated encrypted text')

  response = await post(nadia, `/api/messages/${editableMessage.messageId}/delete`, { scope: 'me' })
  assert.equal(response.status, 200)
  response = await apiRequest(nadia, `${chatPath}/messages?after_seq=${editableMessage.serverSeq - 1}&limit=10`)
  assert.equal((await response.json()).messages.some((message) => message.id === editableMessage.messageId), false)
  response = await apiRequest(ava, `${chatPath}/messages?after_seq=${editableMessage.serverSeq - 1}&limit=10`)
  assert.equal((await response.json()).messages.some((message) => message.id === editableMessage.messageId), true)

  const deletablePayload = {
    ...(await encryptMessage('Delete for everyone test', chat.members)),
    idempotencyKey: randomUUID(),
  }
  response = await post(ava, `${chatPath}/messages`, deletablePayload)
  assert.equal(response.status, 201, await response.clone().text())
  const deletableMessage = await response.json()
  response = await post(nadia, `/api/messages/${deletableMessage.messageId}/delete`, { scope: 'everyone' })
  assert.equal(response.status, 403)
  response = await post(ava, `/api/messages/${deletableMessage.messageId}/delete`, { scope: 'everyone' })
  assert.equal(response.status, 200)
  response = await apiRequest(nadia, `${chatPath}/messages?after_seq=${deletableMessage.serverSeq - 1}&limit=10`)
  const deletedMessage = (await response.json()).messages.find((message) => message.id === deletableMessage.messageId)
  assert.ok(deletedMessage.deleted_at)
  assert.equal(deletedMessage.body_ciphertext, '')

  response = await post(ava, '/api/calls', { chatId: messageRequest.chatId, callType: 'audio' })
  assert.equal(response.status, 201, await response.clone().text())
  const call = (await response.json()).call
  response = await apiRequest(nadia, '/api/calls/incoming')
  assert.equal((await response.json()).calls[0].id, call.id)
  response = await apiRequest(chris, `/api/calls/${call.id}/token`, { method: 'POST' })
  assert.equal(response.status, 404)
  response = await post(nadia, `/api/calls/${call.id}/accept`, {})
  assert.equal(response.status, 200)
  response = await apiRequest(nadia, `/api/calls/${call.id}/status`)
  assert.equal((await response.json()).status, 'active')
  response = await apiRequest(chris, `/api/calls/${call.id}/status`)
  assert.equal(response.status, 404)
  for (const identity of [ava, nadia]) {
    response = await post(identity, `/api/calls/${call.id}/token`, {})
    assert.equal(response.status, 200, await response.clone().text())
    const token = (await response.json()).token
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    assert.equal(claims.sub, identity.id)
    assert.equal(claims.video.roomJoin, true)
  }
  response = await post(ava, `/api/calls/${call.id}/end`, {})
  assert.equal(response.status, 204)
  response = await post(ava, `/api/calls/${call.id}/end`, {})
  assert.equal(response.status, 204)
  response = await apiRequest(nadia, `/api/calls/${call.id}/status`)
  assert.equal((await response.json()).status, 'ended')
  response = await apiRequest(nadia, `/api/chats/${messageRequest.chatId}/calls`)
  const chatCalls = (await response.json()).calls
  assert.equal(chatCalls.length, 1)
  assert.equal(chatCalls[0].status, 'ended')

  response = await post(ava, '/api/calls', { chatId: messageRequest.chatId, callType: 'video' })
  assert.equal(response.status, 201)
  const declinedCall = (await response.json()).call
  response = await post(nadia, `/api/calls/${declinedCall.id}/decline`, {})
  assert.equal(response.status, 204)
  response = await apiRequest(ava, `/api/calls/${declinedCall.id}/status`)
  assert.equal((await response.json()).status, 'declined')
  response = await apiRequest(ava, '/api/calls')
  assert.equal((await response.json()).calls[0].status, 'declined')

  response = await post(nadia, '/api/reports', {
    username: chris.username,
    reason: 'spam',
    details: 'Repeated unwanted invitations.',
  })
  assert.equal(response.status, 201, await response.clone().text())
  assert.ok((await response.json()).reportId)
  response = await post(nadia, '/api/reports', {
    messageId: saved.messageId,
    reason: 'harassment',
  })
  assert.equal(response.status, 201, await response.clone().text())
  response = await post(chris, '/api/reports', {
    messageId: saved.messageId,
    reason: 'other',
  })
  assert.equal(response.status, 404)

  response = await post(ava, '/api/chats/groups', { title: 'Conversion history', usernames: [nadia.username] })
  assert.equal(response.status, 201, await response.clone().text())
  const conversionGroup = await response.json()
  response = await apiRequest(ava, `/api/chats/${conversionGroup.chatId}`)
  const conversionChat = (await response.json()).chat
  const oldFilePlaintext = encoder.encode('Attachment from before the Space conversion.')
  const oldFile = await encryptAttachment(oldFilePlaintext, conversionChat.members)
  response = await post(ava, '/api/uploads/intent', {
    chatId: conversionGroup.chatId,
    filename: 'old-notes.txt',
    contentType: 'text/plain',
    sizeBytes: oldFilePlaintext.byteLength,
    nonce: oldFile.nonce,
    keyEnvelopes: oldFile.keyEnvelopes,
  })
  assert.equal(response.status, 201, await response.clone().text())
  const oldFileIntent = await response.json()
  response = await apiRequest(ava, `/api/uploads/${oldFileIntent.attachmentId}/content`, {
    method: 'PUT',
    headers: { 'content-type': 'application/octet-stream' },
    body: oldFile.ciphertext,
  })
  assert.equal(response.status, 204)
  response = await post(ava, `/api/uploads/${oldFileIntent.attachmentId}/complete`, {})
  assert.equal(response.status, 204)
  const oldEncryptedMessage = await encryptMessage('This message predates the conversion.', conversionChat.members)
  response = await post(ava, `/api/chats/${conversionGroup.chatId}/messages`, {
    ...oldEncryptedMessage,
    attachmentIds: [oldFileIntent.attachmentId],
    idempotencyKey: randomUUID(),
  })
  assert.equal(response.status, 201, await response.clone().text())
  const preConversionMessage = await response.json()

  response = await post(nadia, `/api/chats/${conversionGroup.chatId}/upgrade-to-space`, {
    name: 'Converted history',
  })
  assert.equal(response.status, 403)
  response = await post(ava, `/api/chats/${conversionGroup.chatId}/upgrade-to-space`, {
    name: 'Converted history',
    generalChannelName: 'general',
  })
  assert.equal(response.status, 201, await response.clone().text())
  const convertedSpace = await response.json()
  assert.equal(convertedSpace.channelId, conversionGroup.chatId)
  response = await apiRequest(ava, `/api/spaces/${convertedSpace.spaceId}`)
  const convertedDetails = (await response.json()).space
  assert.equal(convertedDetails.channels[0].id, conversionGroup.chatId)
  assert.equal(convertedDetails.channels[0].has_encrypted_history, true)

  response = await apiRequest(nadia, `/api/chats/${conversionGroup.chatId}/messages`)
  assert.equal(response.status, 200)
  let convertedHistory = (await response.json()).messages
  assert.equal(convertedHistory.length, 1)
  assert.equal(await decryptMessage(convertedHistory[0], nadia), 'This message predates the conversion.')
  response = await apiRequest(ava, `/api/messages/${preConversionMessage.messageId}/reactions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ emoji: '👍' }),
  })
  assert.equal(response.status, 404)
  response = await apiRequest(ava, `/api/messages/${preConversionMessage.messageId}/delete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scope: 'me' }),
  })
  assert.equal(response.status, 404)
  const attemptedEdit = await encryptMessage('Edits are disabled for preserved history.', conversionChat.members)
  response = await apiRequest(ava, `/api/messages/${preConversionMessage.messageId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(attemptedEdit),
  })
  assert.equal(response.status, 404)
  response = await post(ava, `/api/chats/${conversionGroup.chatId}/messages`, {
    ...(await encryptMessage('Encrypted sending must stop after conversion.', conversionChat.members)),
    idempotencyKey: randomUUID(),
  })
  assert.equal(response.status, 404)
  response = await apiRequest(nadia, `/api/uploads/${oldFileIntent.attachmentId}`)
  assert.equal(response.status, 200)
  const oldFileMetadata = (await response.json()).attachment
  response = await apiRequest(nadia, oldFileMetadata.downloadUrl)
  assert.equal(response.status, 200)
  response = await apiRequest(ava, `/api/spaces/${convertedSpace.spaceId}/channels/${convertedSpace.channelId}/permissions`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      permissions: [
        { role: 'moderator', can_view: true, can_send: true, can_speak: true },
        { role: 'member', can_view: false, can_send: false, can_speak: false },
        { role: 'guest', can_view: true, can_send: true, can_speak: true },
      ],
    }),
  })
  assert.equal(response.status, 200, await response.clone().text())
  response = await apiRequest(nadia, `/api/chats/${conversionGroup.chatId}/messages`)
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).messages, [])
  response = await apiRequest(nadia, `/api/uploads/${oldFileIntent.attachmentId}`)
  assert.equal(response.status, 404)

  response = await post(ava, `/api/spaces/${convertedSpace.spaceId}/members`, {
    username: chris.username,
    role: 'guest',
  })
  assert.equal(response.status, 201, await response.clone().text())
  response = await apiRequest(chris, `/api/spaces/${convertedSpace.spaceId}`)
  const guestConvertedDetails = (await response.json()).space
  assert.equal(guestConvertedDetails.channels[0].has_encrypted_history, false)
  response = await apiRequest(chris, `/api/chats/${conversionGroup.chatId}/messages`)
  assert.equal(response.status, 200)
  convertedHistory = (await response.json()).messages
  assert.deepEqual(convertedHistory, [])
  response = await apiRequest(chris, `/api/uploads/${oldFileIntent.attachmentId}`)
  assert.equal(response.status, 404)
  const postConversionMessage = 'This new channel message is visible to the guest.'
  response = await post(ava, `/api/spaces/${convertedSpace.spaceId}/channels/${convertedSpace.channelId}/messages`, {
    body: postConversionMessage,
  })
  assert.equal(response.status, 201, await response.clone().text())
  response = await apiRequest(chris, `/api/spaces/${convertedSpace.spaceId}/channels/${convertedSpace.channelId}/messages`)
  assert.equal(response.status, 200)
  assert.ok((await response.json()).messages.some((message) => message.body === postConversionMessage))

  response = await post(ava, '/api/blocks', { username: nadia.username })
  assert.equal(response.status, 204)
  response = await apiRequest(ava, '/api/blocks')
  const blockedUsers = (await response.json()).blockedUsers
  assert.ok(blockedUsers.some((item) => item.id === nadia.id))
  response = await apiRequest(nadia, '/api/contacts')
  assert.equal((await response.json()).contacts.length, 0)
  response = await apiRequest(nadia, '/api/inbox')
  assert.equal((await response.json()).chats.some((item) => item.id === messageRequest.chatId), false)
  response = await apiRequest(nadia, chatPath)
  assert.equal(response.status, 404)
  response = await apiRequest(nadia, `/api/users?username=${encodeURIComponent(ava.username)}`)
  assert.equal((await response.json()).users.length, 0)
  response = await post(nadia, '/api/requests', {
    username: ava.username,
    message: { ...(await encryptMessage('Blocked request', [nadia, ava])), idempotencyKey: randomUUID() },
  })
  assert.equal(response.status, 404)
  response = await apiRequest(ava, `/api/blocks/${encodeURIComponent(nadia.id)}`, { method: 'DELETE' })
  assert.equal(response.status, 204)
  response = await apiRequest(ava, '/api/blocks')
  assert.equal((await response.json()).blockedUsers.some((item) => item.id === nadia.id), false)

  console.info('PASS message request isolation and E2EE delivery')
  console.info('PASS encrypted message controls and per-user pins')
  console.info('PASS user/message reports and direct-message blocking')
  console.info('PASS server authorization, transactional sequence assignment, and idempotent replay')
  console.info('PASS authorized realtime delivery of sequence-only hints')
  console.info('PASS authenticated typing updates and unauthorized activity rejection')
  console.info('PASS permission-checked people/chat search without server-side message plaintext')
  console.info('PASS group invites, member departures, and owner succession')
  console.info('PASS read cursor, reaction toggle path, and mutual-contact group creation')
  console.info('PASS backward chat-history pagination for scrollback')
  console.info('PASS encrypted object-storage upload, recipient download, and decryption')
  console.info('PASS authorized 1:1 call lifecycle, LiveKit tokens, and call history')
})
