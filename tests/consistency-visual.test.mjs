import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import postcss from 'postcss'
import ts from 'typescript'
const contract=JSON.parse(fs.readFileSync('tests/fixtures/consistency-visual-contract.json','utf8'))
const read=f=>fs.readFileSync(f,'utf8').replaceAll('\r\n','\n')
const names=['account-menu-button','avatar-small','chevron','inbox-empty']
test('Consistency CSS scope freezes all runtime, feature, token, configuration and backend source',()=>{
 const changed=execFileSync('git',['diff','--name-only',contract.base,'--','client','server','package.json','package-lock.json'],{encoding:'utf8'}).trim().split('\n').sort()
 assert.deepEqual(changed,Object.keys(contract.files).sort())
 for(const [f,hash]of Object.entries(contract.files))assert.equal(createHash('sha256').update(read(f)).digest('hex'),hash,f)
})
test('Retired class names have no static or template-literal production producer',()=>{
 const files=execFileSync('git',['ls-files','client/src'],{encoding:'utf8'}).trim().split('\n').filter(f=>/\.(?:ts|tsx)$/.test(f))
 for(const f of files){const tree=ts.createSourceFile(f,read(f),ts.ScriptTarget.Latest,true);function visit(n){if(ts.isStringLiteralLike(n)||ts.isTemplateHead(n)||ts.isTemplateMiddle(n)||ts.isTemplateTail(n))for(const name of names)assert.doesNotMatch(n.text,new RegExp(`(^|[\\s.])${name}($|[\\s.:])`),f);ts.forEachChild(n,visit)}visit(tree)}
 const css=read('client/src/shared/styles/platform.css');for(const name of names)assert.doesNotMatch(css,new RegExp(`\\.${name}(?![\\w-])`))
})
test('Active CSS parses, semantic variables resolve and primitive ownership remains bounded',()=>{
 const tokens=read('client/src/shared/styles/tokens.css')
 for(const f of Object.keys(contract.files)){postcss.parse(read(f)).walkDecls(d=>{for(const [,token]of d.value.matchAll(/var\((--ds-[\w-]+)/g))assert.ok(tokens.includes(token+':'),`${f}: ${token}`)})}
 const global=read('client/src/shared/styles/platform.css')+read('client/src/shared/styles/platform-shell.css'),primitive=read('client/src/shared/styles/primitives.css')
 assert.doesNotMatch(global,/^\.brand-mark(?:\s|[-{])/m);assert.doesNotMatch(global,/^\.avatar \{/m)
 assert.match(primitive,/:where\(\.avatar\)/);assert.match(primitive,/var\(--ds-duration-normal\)/)
 const root=postcss.parse(global);assert.equal(root.nodes.filter(r=>r.type==='rule'&&r.selector==='.secondary-button').length,1)
})
test('Media color cleanup keeps progress, animations and technical geometry; welcome is semantic in both themes',()=>{
 const css=read('client/src/shared/styles/platform.css')
 assert.match(css,/conic-gradient\(var\(--ds-color-brand\) var\(--media-progress, 0deg\), var\(--ds-color-border\) 0\)/)
 assert.match(css,/\.voice-scrubber\{[^}]*accent-color:var\(--ds-color-brand\)/)
 assert.match(css,/attachment-video-spin 1s linear infinite/);assert.match(css,/voice-record-pulse 1\.4s ease-out infinite/)
 assert.match(css,/\.welcome-profile \{ border-color: var\(--ds-color-border\); background: var\(--ds-color-surface\)/)
})
