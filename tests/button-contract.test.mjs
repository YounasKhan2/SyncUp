import test from 'node:test'
import assert from 'node:assert/strict'
import * as runtime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from './helpers/foundation-harness.mjs'

for (const name of ['Button', 'IconButton']) {
  const component = load(`client/src/shared/components/${name}.tsx`, { 'react/jsx-runtime': runtime })[name]
  test(`${name}: native props, callback/ref identity, class extensions and child order`, () => {
    const ref = { current: null }, callback = () => {}, children = [runtime.jsx('svg', { 'data-icon': 'first' }, 'icon'), runtime.jsx('span', { children: 'Action' }, 'text')]
    const input = { id: 'probe', name: 'intent', value: 'save', 'data-probe': 'yes', 'aria-label': 'Action', 'aria-describedby': 'hint', title: 'Action title', tabIndex: 2, onClick: callback, onKeyDown: callback, ref, children, className: 'consumer-one consumer-two' }
    const output = component(input)
    assert.equal(output.type, 'button')
    for (const [key, value] of Object.entries(input)) if (key !== 'className') assert.equal(output.props[key], value, key)
    const classes = output.props.className.split(' ')
    assert.equal(classes[0], name === 'Button' ? 'ui-button' : 'ui-icon-button')
    assert.deepEqual(classes.slice(-2), ['consumer-one', 'consumer-two'])
    assert.equal(output.props.type, undefined)
    assert.equal(output.props.disabled, undefined)
    const html = renderToStaticMarkup(output)
    assert.ok(html.indexOf('<svg') < html.indexOf('<span'))
    assert.ok(html.includes('data-probe="yes"'))
    for (const type of ['button', 'submit', 'reset']) assert.equal(component({ ...input, type }).props.type, type)
    for (const disabled of [false, true]) assert.equal(component({ ...input, disabled }).props.disabled, disabled)
    for (const className of [undefined, '', null]) assert.equal(component({ className, 'aria-label': 'Action' }).props.className.split(' ').includes('undefined'), false)
  })
}
