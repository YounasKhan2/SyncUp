import {restoreAuthVisual,authVisualFiles} from './helpers/auth-visual-parity.mjs'
import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import postcss from 'postcss'
import {restoreCallsVisual} from './helpers/calls-visual-parity.mjs'
const base='8df5b5f9d00c9a1ae22c136c866bceec4978ee78',file='client/src/shared/styles/platform.css'
const read=f=>restoreAuthVisual(f,fs.readFileSync(f,'utf8')),before=execFileSync('git',['show',`${base}:${file}`],{encoding:'utf8'})
const owned=s=>/\.(?:calls?-|incoming-call-banner|answer-call-button|decline-call-button|voice-room-)/.test(s)&&!s.includes('.call-history-message')||s.includes('.inbox-pane:not(.inbox-content)')||s==='.workspace.has-active-calls > .inbox-pane'
test('Calls approved CSS plus exact later Auth presentation preserves every runtime, security, API, callback, history and Space voice source',()=>{
 assert.deepEqual(execFileSync('git',['diff','--name-only',base,'--','client','server','package.json','package-lock.json'],{encoding:'utf8'}).trim().split('\n').sort(),[...new Set([file,...authVisualFiles])].sort())
 assert.equal(restoreCallsVisual(file,read(file)),before)
})
test('Calls preserves every unowned selector, declaration, nesting and order including Conversation call history and Spaces',()=>{
 function unowned(text){const rows=[];postcss.parse(text).walkRules(r=>{const nesting=[];for(let p=r.parent;p;p=p.parent)if(p.type==='atrule')nesting.unshift([p.name,p.params]);for(const selector of r.selectors)if(!owned(selector))rows.push({selector,nesting,decls:r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value,n.important])})});return rows}
 assert.deepEqual(unowned(read(file)),unowned(before))
})
test('Calls uses existing semantic palette, visible focus, danger controls and a final scoped mobile correction',()=>{
 const css=read(file),tokens=read('client/src/shared/styles/tokens.css');postcss.parse(css).walkRules(r=>{if(!r.selectors.some(owned))return;r.walkDecls(d=>{assert.doesNotMatch(d.value,/#|rgba?\(/);for(const [,token] of d.value.matchAll(/var\((--ds-[\w-]+)\)/g))assert.ok(tokens.includes(token+':'),token)})})
 assert.match(css,/outline: 2px solid var\(--ds-color-focus\)/);assert.match(css,/\.call-end-button[^}]+background: var\(--ds-color-danger\)/)
 const mobile=css.lastIndexOf('@media (max-width: 700px)');assert.ok(mobile>css.indexOf('.calls-home { display: grid'))
 assert.match(css.slice(mobile),/\.calls-home \{ display: none; \}/);assert.match(css.slice(mobile),/\.workspace\.has-active-calls > \.inbox-pane \{[^}]+grid-column: 1/)
})
