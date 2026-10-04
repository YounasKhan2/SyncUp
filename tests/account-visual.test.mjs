import {authVisualFiles} from './helpers/auth-visual-parity.mjs'
import {restoreUpdatesVisual} from './helpers/updates-visual-parity.mjs'
import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'
const contract=JSON.parse(fs.readFileSync('tests/fixtures/account-visual-contract.json','utf8'))
const read=f=>restoreUpdatesVisual(f,fs.readFileSync(f,'utf8')).replaceAll('\r\n','\n')
const before=f=>execFileSync('git',['show',`${contract.base}:${f}`],{encoding:'utf8'})
function behavior(file,text){const tree=ts.createSourceFile(file,text,99,true,ts.ScriptKind.TSX);const result=ts.transform(tree,[context=>{const visit=node=>ts.isJsxAttributes(node)?context.factory.updateJsxAttributes(node,node.properties.filter(p=>!ts.isJsxAttribute(p)||p.name.text!=='className')):ts.visitEachChild(node,visit,context);return node=>ts.visitNode(node,visit)}]);return ts.createPrinter().printFile(result.transformed[0])}
test('Account presentation preserves all state/effects, profile/avatar/session/privacy/theme handlers, labels, ARIA, field rules and current-device gating',()=>{
 for(const f of Object.keys(contract.files).filter(f=>f.endsWith('.tsx')))assert.equal(behavior(f,read(f)),behavior(f,before(f)),f)
 assert.deepEqual(execFileSync('git',['diff','--name-only',contract.base,'--','client','server','package.json','package-lock.json'],{encoding:'utf8'}).trim().split('\n').sort(),[...new Set([...authVisualFiles,...Object.keys(contract.files),...Object.keys(JSON.parse(fs.readFileSync('tests/fixtures/updates-visual-contract.json','utf8')).files)])].sort())
})
test('Account CSS preserves unowned declarations/order/nesting and zero-specificity shared-form exclusions protect other dialogs',()=>{
 const owned=/\.(?:profile-avatar(?:-editor|-actions)?|profile-checkbox|appearance-caption|sessions-section|sessions-heading|sessions-caption|session-list|session-row|session-device|safety-settings|safety-inline-form|blocked-user-list|blocked-user-row)(?![\w-])/
 const exclusions={'account-dialog':'account-settings-dialog','profile-form':'account-profile-form','safety-form':'account-safety-form','username-input':'account-username-input'}
 function unowned(text){const rows=[];postcss.parse(text).walkRules(rule=>{const nesting=[];for(let p=rule.parent;p;p=p.parent)if(p.type==='atrule')nesting.unshift([p.name,p.params]);for(let selector of rule.selectors){if(/\.account-(?:settings|profile|safety|username|danger)/.test(selector)&&!selector.includes(':not(:where('))continue;for(const [legacy,marker] of Object.entries(exclusions))selector=selector.replaceAll('.'+legacy+':not(:where(.'+marker+'))','.'+legacy);if(!owned.test(selector))rows.push({selector,nesting,decls:rule.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value,n.important])})}});return rows}
 const f='client/src/shared/styles/platform.css';assert.deepEqual(unowned(read(f)),unowned(before(f)))
})
test('Account controls use semantic palette/focus/danger and compact bounded dialog without new raw colors or token/shared-form changes',()=>{
 const f='client/src/shared/styles/platform.css',text=read(f),owned=text.slice(text.indexOf('/* Account-only presentation.'))
 assert.doesNotMatch(owned,/#|rgba?\(|hsla?\(|!important/);assert.match(owned,/outline: 2px solid var\(--ds-color-focus\)/);assert.match(owned,/var\(--ds-color-danger\)/);assert.match(owned,/min-width: 0/);assert.match(owned,/max-height: calc\(100svh - 40px\)/)
 for(const file of Object.keys(contract.files).filter(f=>f.endsWith('.tsx')))assert.doesNotMatch(read(file),/#[\da-f]{3,8}\b|rgba?\(/)
 for(const file of ['client/src/shared/styles/tokens.css','client/src/shared/styles/platform-shell.css','client/src/features/account/api.ts','client/src/shared/appearance.ts'])assert.equal(read(file),before(file),file)
 assert.ok(text.split('\n').length<before(f).split('\n').length)
})
