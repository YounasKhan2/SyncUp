import {authVisualFiles} from './helpers/auth-visual-parity.mjs'
import {restoreAccountVisual} from './helpers/account-visual-parity.mjs'
import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'
const contract=JSON.parse(fs.readFileSync('tests/fixtures/composer-visual-contract.json','utf8'))
const read=f=>restoreAccountVisual(f,fs.readFileSync(f,'utf8')).replaceAll('\r\n','\n')
const before=f=>execFileSync('git',['show',`${contract.base}:${f}`],{encoding:'utf8'})
function behavior(file,text){const tree=ts.createSourceFile(file,text,99,true,ts.ScriptKind.TSX);const result=ts.transform(tree,[context=>{const visit=node=>ts.isJsxAttributes(node)?context.factory.updateJsxAttributes(node,node.properties.filter(p=>!ts.isJsxAttribute(p)||p.name.text!=='className')):ts.visitEachChild(node,visit,context);return node=>ts.visitNode(node,visit)}]);return ts.createPrinter().printFile(result.transformed[0])}
test('Composer preserves every handler, state/effect, draft/typing, emoji selection, reply, upload, submit/keyboard, voice and disabled contract',()=>{
 const file='client/src/features/messaging/MessageComposer.tsx';assert.equal(behavior(file,read(file)),behavior(file,before(file)))
 for(const f of ['client/src/features/messaging/VoiceRecorder.tsx','client/src/shared/components/FullEmojiPicker.tsx','client/src/features/messaging/Conversation.tsx'])assert.equal(read(f),before(f),f)
 const files=execFileSync('git',['diff','--name-only',contract.base,'--','client','server','package.json','package-lock.json'],{encoding:'utf8'}).trim().split('\n').sort();assert.deepEqual(files,[...new Set([...authVisualFiles,...Object.keys(contract.files),...Object.keys(JSON.parse(fs.readFileSync('tests/fixtures/account-visual-contract.json','utf8')).files),...Object.keys(JSON.parse(fs.readFileSync('tests/fixtures/updates-visual-contract.json','utf8')).files)])].sort())
})
test('Composer CSS migration preserves every unowned selector/declaration/nesting/cascade including sent attachments, voice and other screens',()=>{
 const owned=/\.(?:message-composer|composer-toolbar|composer-tools|composer-hint|composer-reply|composer-send-button|emoji-picker-popover|staged-attachments|attach-file-button)(?![\w-])/
 function unowned(text){const rows=[];postcss.parse(text).walkRules(rule=>{const nesting=[];for(let p=rule.parent;p;p=p.parent)if(p.type==='atrule')nesting.unshift([p.name,p.params]);for(const selector of rule.selectors)if(!owned.test(selector))rows.push({selector,nesting,decls:rule.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value,n.important])})});return rows}
 const f='client/src/shared/styles/platform.css';assert.deepEqual(unowned(read(f)),unowned(before(f)))
})
test('Composer has semantic palette, bounded textarea, visible focus and wrapping staged media without new raw color or typography',()=>{
 const f='client/src/shared/styles/platform.css',text=read(f),owned=text.slice(text.indexOf('/* Conversation composer:'))
 assert.doesNotMatch(owned,/#|rgba?\(|hsla?\(/);assert.match(owned,/max-height: 160px/);assert.match(owned,/outline: 2px solid var\(--ds-color-focus\)/);assert.match(owned,/overflow-wrap: anywhere/);assert.match(owned,/flex-wrap: wrap/)
 assert.doesNotMatch(read('client/src/features/messaging/MessageComposer.tsx'),/#[\da-f]{3,8}\b|rgba?\(|ui:(?:text|leading|tracking)-\[/)
 assert.ok(text.split('\n').length<before(f).split('\n').length)
})
