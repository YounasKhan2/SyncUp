import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { root, read, hash, parse, searchRegion, canonical } from './helpers/conversation-presentation-parity.mjs'

const baseline = JSON.parse(read('tests/fixtures/conversation-presentation-baseline.json'))
test('Conversation presentation pass preserves complete moved and retained implementations and resolved dependency identities', () => {
  for (const [old, value] of Object.entries(baseline.files)) {
    const file = fs.existsSync(new URL(value.relocatedPath, root)) ? value.relocatedPath : old
    assert.equal(hash(canonical(file, read(file), baseline.files)), value.canonicalDigest, file)
    if (file !== old) assert.equal(fs.existsSync(new URL(old, root)), false, `no compatibility copy: ${old}`)
  }
})
test('Conversation search region uses only the frozen markup and parent-owned query, label calculation and callbacks', () => {
  const file = 'client/src/features/messaging/Conversation.tsx'
  const tree = parse(file)
  const region = searchRegion(tree).getText(tree)
  const component = 'client/src/features/messaging/components/ConversationSearchBar.tsx'
  if (fs.existsSync(new URL(component, root))) {
    assert.equal(region, baseline.search.replacementRegion)
    assert.equal(hash(read(component)), baseline.search.componentDigest)
  } else assert.equal(region, baseline.search.originalRegion)
})
