import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import postcss from 'postcss'
const base='be72e8778e9fcb823959e9f7f287eadf0e8b254f',feature='client/src/features/spaces/spaces.css',platform='client/src/shared/styles/platform.css'
const read=f=>fs.readFileSync(f,'utf8').replaceAll('\r\n','\n'),before=f=>execFileSync('git',['show',`${base}:${f}`],{encoding:'utf8'})
test('Spaces CSS-only scope preserves every source byte: permissions/disabled/fallback, routing, polling, SSE, messaging, shared objects and voice',()=>{
 assert.deepEqual(execFileSync('git',['diff','--name-only',base,'--','client','server','package.json','package-lock.json'],{encoding:'utf8'}).trim().split('\n').sort(),[feature,platform].sort())
 const files=execFileSync('git',['ls-tree','-r','--name-only',base,'client/src/features/spaces'],{encoding:'utf8'}).trim().split('\n').filter(f=>/\.tsx?$/.test(f))
 for(const f of files)assert.equal(read(f),before(f),f)
})
test('Spaces leaves unowned CSS, shared object defaults, Updates, direct group upgrade and Shell placement exactly unchanged',()=>{
 const owned=s=>s.includes('.spaces-page')&&!s.includes('.workspace')||/\.(?:spaces?|legacy-history|legacy-space)-[\w-]+/.test(s)&&!s.includes('.workspace')&&!s.includes('.spaces-error')
 function unowned(text){const rows=[];postcss.parse(text).walkRules(r=>{const nesting=[];for(let p=r.parent;p;p=p.parent)if(p.type==='atrule')nesting.unshift([p.name,p.params]);for(const selector of r.selectors)if(!owned(selector))rows.push({selector,nesting,decls:r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value,n.important])})});return rows}
 for(const f of [feature,platform])assert.deepEqual(unowned(read(f)),unowned(before(f)),f)
})
test('Spaces owned presentation uses existing semantic tokens, scoped shared items and focus without new raw palette or stylesheet',()=>{
 const tokens=read('client/src/shared/styles/tokens.css'),css=read(feature);postcss.parse(css).walkRules(r=>{if(!r.selector.includes(':root .spaces-page'))return;r.walkDecls(d=>{assert.doesNotMatch(d.value,/#|rgba?\(/);for(const [,token] of d.value.matchAll(/var\((--ds-[\w-]+)\)/g))assert.ok(tokens.includes(token+':'),token)})})
 assert.match(css,/outline: 2px solid var\(--ds-color-focus\)/);assert.match(css,/:root \.spaces-page \.space-channel-view \.shared-object-card/)
 assert.ok(read(platform).split('\n').length<before(platform).split('\n').length)
 assert.equal(read('client/src/App.css'),before('client/src/App.css'))
})
