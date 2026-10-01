import assert from 'node:assert/strict'
import test from 'node:test'
import { countUnreadConversations, insertAtSelection, splitMessageLinks } from '../client/src/shared/presentation.ts'
import { parseAppearancePreference } from '../client/src/shared/appearance.ts'

test('unread badge counts conversations, not unread messages', () => {
  assert.equal(countUnreadConversations([
    { unread_count: 0 },
    { unread_count: 1 },
    { unread_count: '8' },
    { unread_count: '0' },
  ]), 2)
})

test('message URL splitting accepts only safe HTTP(S) URLs and preserves punctuation', () => {
  assert.deepEqual(splitMessageLinks('See https://syncup.example/path?q=1, then www.example.org!'), [
    { text: 'See ' },
    { text: 'https://syncup.example/path?q=1', href: 'https://syncup.example/path?q=1' },
    { text: ',' },
    { text: ' then ' },
    { text: 'www.example.org', href: 'https://www.example.org/' },
    { text: '!' },
  ])
  assert.deepEqual(splitMessageLinks('javascript:alert(1) ftp://example.org'), [
    { text: 'javascript:alert(1) ftp://example.org' },
  ])
  assert.deepEqual(splitMessageLinks('https://user:pass@example.org'), [
    { text: 'https://user:pass@example.org' },
  ])
})

test('emoji insertion replaces the selection and reports the new caret position', () => {
  assert.deepEqual(insertAtSelection('Hello world', 6, 11, '👋'), {
    value: 'Hello 👋',
    cursor: 8,
  })
})

test('appearance preference accepts saved overrides and defaults invalid values to system', () => {
  assert.equal(parseAppearancePreference('dark'), 'dark')
  assert.equal(parseAppearancePreference('light'), 'light')
  assert.equal(parseAppearancePreference('system'), 'system')
  assert.equal(parseAppearancePreference(null), 'system')
  assert.equal(parseAppearancePreference('sepia'), 'system')
})
