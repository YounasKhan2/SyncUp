import {authVisualFiles} from './helpers/auth-visual-parity.mjs'
import fs from 'node:fs'
import {restoreSpacesModernVisual} from './helpers/spaces-modern-visual-parity.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'
const contract=JSON.parse(fs.readFileSync('tests/fixtures/updates-visual-contract.json','utf8'))
const read=f=>restoreSpacesModernVisual(f,fs.readFileSync(f,'utf8')).replaceAll('\r\n','\n')
const before=f=>execFileSync('git',['show',`${contract.base}:${f}`],{encoding:'utf8'})
function behavior(file,text){const tree=ts.createSourceFile(file,text,99,true,ts.ScriptKind.TSX);const result=ts.transform(tree,[context=>{const visit=node=>ts.isJsxAttributes(node)?context.factory.updateJsxAttributes(node,node.properties.filter(p=>!ts.isJsxAttribute(p)||p.name.text!=='className')):ts.visitEachChild(node,visit,context);return node=>ts.visitNode(node,visit)}]);return ts.createPrinter().printFile(result.transformed[0])}
test('Updates preserves complete fetching/state/effects/search/filter/order/identity/navigation/respond/state-change/ARIA contracts outside classes',()=>{
 for(const f of Object.keys(contract.files).filter(f=>f.endsWith('.tsx')))assert.equal(behavior(f,read(f)),behavior(f,before(f)),f)
 assert.equal(read('client/src/features/spaces/SharedObjectCard.tsx'),before('client/src/features/spaces/SharedObjectCard.tsx'))
 assert.deepEqual(execFileSync('git',['diff','--name-only',contract.base,'--','client','server','package.json','package-lock.json'],{encoding:'utf8'}).trim().split('\n').sort(),[...new Set([...Object.keys(contract.files),...authVisualFiles])].sort())
})
test('Updates CSS preserves all unowned declarations/nesting/cascade including Spaces shared objects, Account and Shell placement',()=>{
 function unowned(text){const rows=[];postcss.parse(text).walkRules(rule=>{const nesting=[];for(let p=rule.parent;p;p=p.parent)if(p.type==='atrule')nesting.unshift([p.name,p.params]);for(const selector of rule.selectors)if(!(/\.updates-[\w-]+/.test(selector)&&!selector.includes('.workspace.has-active-updates')))rows.push({selector,nesting,decls:rule.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value,n.important])})});return rows}
 for(const f of Object.keys(contract.files).filter(f=>f.endsWith('.css')))assert.deepEqual(unowned(read(f)),unowned(before(f)),f)
})
test('Updates semantic rows/metadata/focus replace cards without raw palette or unrelated shared-object changes',()=>{
 const f='client/src/features/spaces/spaces.css',text=read(f),owned=postcss.parse(text.slice(text.indexOf('/* Updates presentation only;')))
 owned.walkDecls(d=>assert.doesNotMatch(d.value,/#|rgba?\(|hsla?\(|!important/))
 assert.match(text,/\.updates-grid \{ display: flex/);assert.match(text,/outline: 2px solid var\(--ds-color-focus\)/);assert.match(text,/\.updates-item \.shared-object-card \{[^}]*border: 0/)
 for(const file of Object.keys(contract.files).filter(f=>f.endsWith('.tsx')))assert.doesNotMatch(read(file),/#[\da-f]{3,8}\b|rgba?\(/)
 assert.ok(read('client/src/shared/styles/platform.css').split('\n').length<before('client/src/shared/styles/platform.css').split('\n').length)
})
