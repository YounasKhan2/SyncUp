import test from 'node:test'
import assert from 'node:assert/strict'
import { renderConsumer, nodes } from './helpers/ui-harness.mjs'
import { source } from './helpers/foundation-harness.mjs'

const account = 'client/src/features/account/AccountPanel.tsx'
const report = 'client/src/features/messaging/components/ReportDialog.tsx'
const user = { display_name: 'Sam', username: 'sam', email: 'sam@example.test' }
const profileProps = { user, appearance: 'system', onAppearanceChange() {}, onSaved() {} }

for (const [path, name, label, props, busyStates] of [
  [account, 'AccountPanel', 'Close profile', profileProps, ['', '', true]],
  [report, 'ReportDialog', 'Close report', { messageId: 'message' }, ['harassment', '', '', true]],
]) {
  test(`${name}: close button, outside/content propagation and busy dismissal retain existing policy`, () => {
    for (const busy of [false, true]) {
      let closed = 0
      const tree = renderConsumer(path, name, { ...props, onClose: () => closed++ }, { states: busy ? busyStates : [] })
      const panel = nodes(tree, (n) => n.props.role === 'dialog')[0]
      assert.equal(panel.type, 'section')
      assert.equal(panel.props['aria-modal'], 'true')
      assert.ok(panel.props['aria-labelledby'])
      const close = nodes(tree, (n) => n.props['aria-label'] === label)[0]
      assert.equal(close.type, 'button')
      assert.equal(close.props.type, 'button')
      assert.ok(!close.props.disabled) // Even Report's busy close button remains enabled.
      close.props.onClick()
      assert.equal(closed, 1)
      const overlay = nodes(tree, (n) => n.props.role === 'presentation')[0]
      const target = {}
      overlay.props.onMouseDown({ target: {}, currentTarget: target, stopPropagation() { assert.fail('must not stop propagation') } })
      assert.equal(closed, 1)
      overlay.props.onMouseDown({ target, currentTarget: target })
      assert.equal(closed, name === 'ReportDialog' && busy ? 1 : 2)
    }
  })
  test(`${name}: no Escape listener, focus trap/restoration, or automatic focus is introduced`, () => {
    const effects = []
    const tree = renderConsumer(path, name, { ...props, onClose() {} }, { effects })
    const cleanups = effects.map((effect) => effect()).filter((cleanup) => typeof cleanup === 'function')
    cleanups.forEach((cleanup) => cleanup())
    assert.equal(nodes(tree, (n) => n.props.autoFocus || n.props.onKeyDown || n.props.onKeyUp).length, 0)
  })
}

test('Report content submission retains payload and closes only after a successful response', async () => {
  for (const reject of [false, true]) {
    let closed = 0
    const calls = []
    const tree = renderConsumer(report, 'ReportDialog', { messageId: 'message', onClose: () => closed++ }, {
      api: async (...args) => { calls.push(args); if (reject) throw new Error('Denied') },
    })
    let prevented = 0
    nodes(tree, (n) => n.type === 'form')[0].props.onSubmit({ preventDefault: () => prevented++ })
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(prevented, 1)
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], '/api/reports')
    assert.deepEqual(JSON.parse(calls[0][1].body), { messageId: 'message', reason: 'harassment', details: '' })
    assert.equal(closed, reject ? 0 : 1)
  }
})

test('Dialog mount conditions remain owned by Workspace and Conversation', () => {
  assert.match(source('client/src/features/workspace/WorkspacePage.tsx'), /\{accountOpen && <AccountPanel/)
  assert.match(source('client/src/features/messaging/Conversation.tsx'), /\{reportingMessageId && \(\s*<ReportDialog/)
})
