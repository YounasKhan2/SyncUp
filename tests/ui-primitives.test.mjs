import test from 'node:test'
import assert from 'node:assert/strict'
import * as runtime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from './helpers/foundation-harness.mjs'
import { renderConsumer, nodes } from './helpers/ui-harness.mjs'

const mocks = { 'react/jsx-runtime': runtime }
const { Button } = load('client/src/shared/components/Button.tsx', mocks)
const { IconButton } = load('client/src/shared/components/IconButton.tsx', mocks)
const { Dialog } = load('client/src/shared/components/Dialog.tsx', mocks)

test('Button forwards native submit/form/disabled/name/value/ARIA attributes, children and ref', () => {
  const onClick = () => {}
  const ref = { current: null }
  const element = Button({ type: 'submit', form: 'profile', disabled: true, name: 'intent', value: 'save',
    'aria-describedby': 'hint', title: 'Save changes', onClick, ref, children: 'Saving…' })
  assert.equal(element.type, 'button')
  assert.equal(element.props.onClick, onClick)
  assert.equal(element.props.ref, ref)
  const markup = renderToStaticMarkup(element)
  for (const attribute of ['type="submit"', 'form="profile"', 'disabled=""', 'name="intent"', 'value="save"', 'aria-describedby="hint"', 'title="Save changes"']) assert.ok(markup.includes(attribute))
  assert.ok(markup.includes('Saving…'))
  assert.equal(Button({ children: 'Default submit' }).props.type, undefined) // Retain native default.
})

test('IconButton preserves accessible name, title, disabled/menu attributes and one handler invocation', () => {
  let clicked = 0
  const element = IconButton({ type: 'button', 'aria-label': 'Close profile', title: 'Close',
    'aria-expanded': false, 'aria-controls': 'menu', disabled: true, onClick: () => clicked++, children: runtime.jsx('svg', { width: 15, 'aria-hidden': true }) })
  const markup = renderToStaticMarkup(element)
  for (const attribute of ['aria-label="Close profile"', 'title="Close"', 'disabled=""', 'aria-expanded="false"', 'aria-controls="menu"', 'width="15"']) assert.ok(markup.includes(attribute))
  // Callback identity/forwarding only; disabled DOM suppression is verified in the browser fixture.
  element.props.onClick()
  assert.equal(clicked, 1)
})

for (const [path, name, states, text] of [
  ['auth/AuthScreen', 'AuthScreen', ['sign-up', '', true], 'Please wait…'],
  ['auth/UnlockScreen', 'UnlockScreen', ['', true, ''], 'Unlocking…'],
  ['account/AccountPanel', 'AccountPanel', ['', '', true], 'Saving…'],
  ['messaging/ReportDialog', 'ReportDialog', ['harassment', '', '', true], 'Submitting…'],
]) {
  test(`${name} retains submit type, busy disabling/copy and icon policy`, () => {
    const props = { user: { display_name: 'Sam', username: 'sam', email: 'sam@example.test' }, appearance: 'system', onClose() {} }
    const tree = renderConsumer(`client/src/features/${path}.tsx`, name, props, { states })
    const button = nodes(tree, (n) => n.type === 'button' && n.props.type === 'submit')[0]
    assert.equal(button.props.disabled, true)
    assert.ok(JSON.stringify(button.props.children).includes(text))
    assert.equal(nodes(button, (n) => n.type === 'svg').length, name === 'ReportDialog' ? 1 : 0)
  })
}

test('Dialog forwards overlay event unchanged and exposes the labelled section without adding lifecycle handlers', () => {
  let received
  const event = { target: {}, currentTarget: {} }
  const tree = Dialog({ 'aria-labelledby': 'title', id: 'panel', onBackdropMouseDown: (value) => { received = value }, children: 'Content' })
  tree.props.onMouseDown(event)
  assert.equal(received, event)
  assert.equal(tree.props.children.props.role, 'dialog')
  assert.equal(tree.props.children.props['aria-modal'], 'true')
  assert.equal(tree.props.children.props.id, 'panel')
  assert.equal(tree.props.children.props['aria-labelledby'], 'title')
  assert.equal(tree.props.onKeyDown, undefined)
})
