import {restoreShellNavigation} from './helpers/shell-navigation-parity.mjs'
import fs from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
import {execFileSync} from 'node:child_process'
import postcss from 'postcss'
import {buildProof} from './helpers/design-system-wiring-proof.mjs'
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/shared-primitives-baseline.json','utf8')),read=file=>fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')
test('Dialog transfers only six exact declarations and static prefixed utilities',()=>{
 for(const[file,record]of Object.entries(fixture.files)){assert.equal(record.before,execFileSync('git',['show',`${fixture.base}:${file}`],{encoding:'utf8'}));assert.equal(read(file),record.after)}
 const jsx=fixture.files['client/src/shared/components/Dialog.tsx'];assert.equal(jsx.after.replace(' ui:fixed ui:z-overlay ui:grid ui:place-items-center ui:bg-overlay','').replace(' ui:box-border',''),jsx.before)
 assert.doesNotMatch(jsx.after,/#[\da-f]{3,8}\b|ui:[\w-]+-\[|!important/)
 const css=fixture.files['client/src/shared/styles/primitives.css'];assert.equal(css.after.replace('.ui-dialog-overlay { inset: 0; padding: 20px; }','.ui-dialog-overlay { position: fixed; z-index: 15; inset: 0; display: grid; place-items: center; padding: 20px; background: var(--color-overlay); }').replace('overflow-y: auto; padding: 24px;','overflow-y: auto; box-sizing: border-box; padding: 24px;'),css.before)
 const parsed=postcss.parse(read('client/src/shared/styles/primitives.css'));parsed.walkRules('.ui-dialog-overlay',rule=>assert.deepEqual(rule.nodes.map(d=>d.prop),['inset','padding']))
})
test('Completion freezes every other production file, all consumers, BrandMark, packages and configuration',()=>{
 const files=execFileSync('git',['ls-tree','-r','--name-only',fixture.base],{encoding:'utf8'}).trim().split('\n').filter(file=>file.startsWith('client/')||file.startsWith('server/')||['package.json','package-lock.json'].includes(file))
 for(const file of files)if(!fixture.files[file])assert.equal(restoreShellNavigation(file,read(file)),execFileSync('git',['show',`${fixture.base}:${file}`],{encoding:'utf8'}).replaceAll('\r\n','\n'),file)
 const diff=execFileSync('git',['diff','--name-only',fixture.base,'--','client','server','package.json','package-lock.json'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);assert.deepEqual(diff.sort(),[...new Set([...Object.keys(fixture.files),...Object.keys(JSON.parse(fs.readFileSync('tests/fixtures/shell-navigation-baseline.json','utf8')).files),...Object.keys(JSON.parse(fs.readFileSync('tests/fixtures/inbox-baseline.json','utf8')).files),...Object.keys(JSON.parse(fs.readFileSync('tests/fixtures/conversation-visual-contract.json','utf8')).files),...Object.keys(JSON.parse(fs.readFileSync('tests/fixtures/composer-visual-contract.json','utf8')).files)])].sort())
})
test('Production source detection emits each exact Dialog utility with semantic token backing',async()=>{
 const result=await buildProof('.git/design05/utility-proof');for(const name of ['fixed','z-overlay','grid','place-items-center','bg-overlay','box-border'])assert.ok(result.css.includes('.ui\\:'+name),name)
 assert.match(result.css,/z-index:\s*var\(--ds-layer-overlay\)/);assert.match(result.css,/background-color:\s*var\(--ds-color-overlay\)/)
})
