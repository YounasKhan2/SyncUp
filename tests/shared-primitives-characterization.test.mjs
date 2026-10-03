import test from 'node:test'
import assert from 'node:assert/strict'
import * as runtime from 'react/jsx-runtime'
import { load, source } from './helpers/foundation-harness.mjs'
const {Dialog}=load('client/src/shared/components/Dialog.tsx',{'react/jsx-runtime':runtime})
test('Dialog preserves inline overlay/section, native extensions, children, callbacks and actual ref forwarding',()=>{
 const ref={current:null}, mouse=()=>{}, key=()=>{}, content=runtime.jsx('form',{id:'form',children:'content'})
 const tree=Dialog({'aria-labelledby':'title',id:'panel',className:'consumer',overlayClassName:'overlay-extension',onBackdropMouseDown:mouse,onKeyDown:key,tabIndex:-1,ref,children:content,role:'ignored','aria-modal':false})
 assert.equal(tree.type,'div');assert.equal(tree.props.role,'presentation');assert.equal(tree.props.onMouseDown,mouse)
 assert.ok(tree.props.className.startsWith('ui-dialog-overlay'));assert.ok(tree.props.className.endsWith('overlay-extension'))
 const panel=tree.props.children;assert.equal(panel.type,'section');assert.equal(panel.props.role,'dialog');assert.equal(panel.props['aria-modal'],'true')
 assert.equal(panel.props.ref,ref);assert.equal(panel.props.onKeyDown,key);assert.equal(panel.props.children,content);assert.equal(panel.props.id,'panel');assert.equal(panel.props.tabIndex,-1)
 assert.ok(panel.props.className.includes('account-dialog'));assert.ok(panel.props.className.endsWith('consumer'))
 assert.equal(tree.props.onKeyDown,undefined)
})
test('Dialog supplies no open state, portal, Escape, trap, scroll lock or focus restoration policy',()=>{
 const text=source('client/src/shared/components/Dialog.tsx').replace(/\/\/[^\n]*/g,'');assert.doesNotMatch(text,/useEffect|useState|createPortal|addEventListener|\.focus\(|document\.|Escape/)
 const tree=Dialog({'aria-labelledby':'title',onBackdropMouseDown:()=>{},children:null});assert.equal(tree.props.children.props.children,null)
})
