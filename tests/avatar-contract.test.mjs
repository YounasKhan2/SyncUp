import test from 'node:test'
import assert from 'node:assert/strict'
import * as runtime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from './helpers/foundation-harness.mjs'
const { Avatar } = load('client/src/shared/components/Avatar.tsx', { 'react/jsx-runtime': runtime })

test('Avatar freezes root semantics, exact fallback algorithm and missing/empty source behavior', () => {
  for (const [name, expected] of [[' Sam Rivera ', 'S'], ['', '?'], ['   ', '?'], ['éclair', 'É'], ['ßeta', 'SS'], ['😀 Smile', '\ud83d']]) {
    for (const src of [undefined, null, '']) {
      const element = Avatar({ name, src })
      assert.equal(element.type, 'span')
      assert.equal(element.props.role, 'img')
      assert.equal(element.props['aria-label'], name)
      assert.ok(element.props.children[0] == null || element.props.children[0] === '')
      assert.equal(element.props.children[1].type, 'span')
      assert.equal(element.props.children[1].props['aria-hidden'], 'true')
      assert.equal(element.props.children[1].props.children, expected)
      assert.ok(!element.props.className.includes('avatar-has-image'))
    }
  }
})

test('Avatar preserves image key/attributes/order, extension order and unsupported prop behavior', () => {
  const output = Avatar({ name: 'Sam', src: '/avatar.png', className: 'profile-avatar extension', title: 'ignored', 'aria-label': 'ignored', 'data-probe': 'ignored', style: {}, ref: {} })
  assert.equal(output.props['aria-label'], 'Sam')
  for (const key of ['title', 'data-probe', 'style', 'ref']) assert.equal(output.props[key], undefined)
  const classes = output.props.className.split(' ')
  assert.equal(classes[0], 'avatar')
  assert.deepEqual(classes.slice(-3), ['profile-avatar', 'extension', 'avatar-has-image'])
  const image = output.props.children[0]
  assert.equal(image.type, 'img'); assert.equal(image.key, '/avatar.png')
  for (const [key, expected] of Object.entries({ src: '/avatar.png', alt: '', width: 64, height: 64 })) assert.equal(image.props[key], expected)
  for (const key of ['loading', 'decoding', 'srcSet', 'ref']) assert.equal(image.props[key], undefined)
  const html = renderToStaticMarkup(output)
  assert.ok(html.indexOf('<img') < html.lastIndexOf('<span'))
})

test('Avatar image error mutates only display and image marker without changing props/source', () => {
  const element = Avatar({ name: 'Sam', src: '/broken.png', className: 'profile-avatar' })
  const removed = [], target = { style: {}, parentElement: { classList: { remove: value => removed.push(value) } } }
  element.props.children[0].props.onError({ currentTarget: target })
  assert.equal(target.style.display, 'none')
  assert.deepEqual(removed, ['avatar-has-image'])
  assert.equal(element.props.children[0].props.src, '/broken.png')
  assert.ok(element.props.className.endsWith('avatar-has-image'))
  const next = Avatar({ name: 'Sam', src: '/new.png' })
  assert.equal(next.props.children[0].key, '/new.png')
  element.props.children[0].props.onError({ currentTarget: { style: {}, parentElement: null } })
})
