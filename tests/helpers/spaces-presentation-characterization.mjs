import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spacesPage, space, channel, settle } from './spaces-harness.mjs'
import { plain } from './foundation-harness.mjs'
import { nodes } from './ui-harness.mjs'
import { root, read, hash, parse, headerRegion, canonical } from './spaces-presentation-parity.mjs'

const baseline = JSON.parse(read('tests/fixtures/spaces-presentation-baseline.json'))
const selected = (type = 'discussion', role = 'owner', topic = '') => spacesPage({ seed: {
  space: { ...space, role, channels: [{ ...channel, type, topic }] }, channelId: channel.id,
} })

test('Spaces header preserves exact root/order/icons/topic fallbacks and prepared edit visibility for all channel types and roles', () => {
  const fallback = { discussion: 'Visible to invited members', announcement: 'Only Space moderators can post here', private: 'Private channel', voice: 'Persistent voice room · up to 16 people' }
  const icon = { discussion: 'Hash', announcement: 'Megaphone', private: 'LockKeyhole', voice: 'Volume2' }
  for (const type of Object.keys(fallback)) for (const role of ['owner', 'admin', 'moderator', 'member', 'guest']) {
    const view = selected(type, role), header = view.cls('space-channel-header')
    assert.equal(header.type, 'header')
    assert.equal(header.props.children[0].type, 'div')
    assert.equal(header.props.children[1].props.className, 'space-channel-actions')
    assert.equal(nodes(header, n => n.type === 'small')[0].props.children, fallback[type])
    const glyph = nodes(header, n => n.type === `icon:${icon[type]}`)[0]
    assert.equal(glyph.props.size, 16)
    assert.equal(glyph.props['aria-hidden'], 'true')
    const actions = nodes(header, n => n.type === 'button')
    assert.equal(actions.length, (type === 'voice' ? 1 : 2) + (['owner', 'admin'].includes(role) ? 1 : 0))
    if (type !== 'voice') {
      assert.equal(actions[0].props['aria-label'], 'Search Project')
      assert.equal(actions[1].props['aria-label'], 'Files in general')
    }
    assert.equal(view.cls('space-channel-view').props.children.props.children[0].type, 'header')
  }
  assert.equal(nodes(selected('private', 'guest', 'Exact topic').cls('space-channel-header'), n => n.type === 'small')[0].props.children, 'Exact topic')
})

test('Spaces header callbacks preserve search reset order, file loading, settings initialization and exact listen-only voice payload', async () => {
  const view = selected()
  view.state.error = 'old'; view.state.searchResults = [1]; view.state.searchSubmitted = true
  view.render(); view.aria('Search Project').props.onClick()
  assert.deepEqual(plain(view.trace.slice(-4)), [['state', 'error', ''], ['state', 'searchResults', []], ['state', 'searchSubmitted', false], ['state', 'searchOpen', true]])
  view.aria('Files in general').props.onClick(); await settle()
  assert.ok(view.requests.some(([path]) => path === '/api/spaces/space/channels/text/files'))
  nodes(view.cls('space-channel-header'), n => n.type === 'button').at(-1).props.onClick()
  assert.equal(view.state.channelSettingsTab, 'overview')
  const voice = selected('voice', 'guest')
  nodes(voice.cls('space-channel-header'), n => n.type === 'button')[0].props.onClick()
  assert.deepEqual(plain(voice.trace.at(-1)), ['voice', { id: 'text', chatId: 'text', callType: 'audio', title: 'Project · general', isVoiceRoom: true, voiceSpaceId: 'space', voiceChannelId: 'text', canPublish: false }])
  assert.equal(voice.requests.length, 0)
})

test('Spaces retained sidebar preserves category/channel order, collapse, selection resets and role-derived controls', () => {
  const channels = ['discussion', 'announcement', 'private', 'voice'].map((type, i) => ({ ...channel, id: `c${i}`, name: `name${i}`, type }))
  const view = spacesPage({ seed: { space: { ...space, categories: [...space.categories, { id: 'empty', name: 'Empty' }], channels }, channelId: 'c2', historyCursor: { old: true } } })
  const sidebar = view.cls('space-sidebar')
  assert.equal(sidebar.type, 'aside')
  assert.deepEqual(plain(view.all(n => n.props.className === 'space-channel').map(n => n.props.children[1].props.children)), ['name0', 'name1', 'name2', 'name3'])
  assert.equal(view.all(n => n.props.className === 'space-channel-row is-active').length, 1)
  view.all(n => n.props.className === 'space-channel')[3].props.onClick()
  assert.equal(view.state.historyCursor, null)
  assert.equal(view.state.channelId, 'c3')
  view.aria('Create channel in Project').props.onClick()
  assert.equal(view.state.channelCategoryId, 'category')
  assert.equal(view.state.channelDialogOpen, true)
  view.all(n => n.props.className === 'space-category-toggle')[0].props.onClick(); view.render()
  assert.equal(view.all(n => n.props.className === 'space-channel').length, 0)
  assert.equal(view.all(n => n.props.className === 'space-category-toggle')[0].props['aria-expanded'], false)
  for (const role of ['owner', 'admin', 'moderator', 'member', 'guest']) {
    const candidate = selected('discussion', role)
    assert.equal(Boolean(candidate.aria('Space settings')), ['owner', 'admin'].includes(role))
    assert.equal(Boolean(candidate.cls('space-manage-members')), ['owner', 'admin', 'moderator'].includes(role))
  }
})

test('Spaces presentation pass preserves complete relocated and retained source/dependency identity outside only the approved header', () => {
  for (const [old, value] of Object.entries(baseline.files)) {
    const file = fs.existsSync(new URL(value.relocatedPath, root)) ? value.relocatedPath : old
    assert.equal(hash(canonical(file, read(file), baseline.files)), value.canonicalDigest, file)
    if (file !== old) assert.equal(fs.existsSync(new URL(old, root)), false, `no compatibility copy: ${old}`)
  }
})

test('Spaces header extraction uses exact frozen markup and parent callbacks without permission, API or voice-runtime migration', () => {
  const tree = parse('client/src/features/spaces/SpacesPage.tsx')
  const region = headerRegion(tree).getText(tree)
  const child = 'client/src/features/spaces/components/SpaceChannelHeader.tsx'
  if (fs.existsSync(new URL(child, root))) {
    assert.equal(region, baseline.header.replacement)
    assert.equal(hash(read(child)), baseline.header.componentDigest)
  } else assert.equal(region, baseline.header.original)
})
