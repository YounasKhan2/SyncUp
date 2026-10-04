import {restoreComposerVisual} from './helpers/composer-visual-parity.mjs'
import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'
const contract=JSON.parse(fs.readFileSync('tests/fixtures/conversation-visual-contract.json','utf8'))
const before=file=>execFileSync('git',['show',`${contract.base}:${file}`],{encoding:'utf8'})
const read=file=>restoreComposerVisual(file,fs.readFileSync(file,'utf8')).replaceAll('\r\n','\n')
function behavior(file,text){const tree=ts.createSourceFile(file,text,99,true,ts.ScriptKind.TSX);const result=ts.transform(tree,[context=>{const visit=node=>ts.isJsxAttributes(node)?context.factory.updateJsxAttributes(node,node.properties.filter(p=>!ts.isJsxAttribute(p)||p.name.text!=='className')):ts.visitEachChild(node,visit,context);return node=>ts.visitNode(node,visit)}]);return ts.createPrinter().printFile(result.transformed[0])}
test('Conversation visual changes preserve complete rendering logic, ordering, replies/reactions, IDs/ARIA, refs, callbacks, receipt calculations and imports',()=>{
 for(const file of Object.keys(contract.files).filter(f=>f.endsWith('.tsx')))assert.equal(behavior(file,read(file)),behavior(file,before(file)),file)
 assert.deepEqual(execFileSync('git',['diff','--name-only',contract.base,'--','client','server','package.json','package-lock.json'],{encoding:'utf8'}).trim().split('\n').sort(),[...new Set([...Object.keys(contract.files),...Object.keys(JSON.parse(fs.readFileSync('tests/fixtures/composer-visual-contract.json','utf8')).files),...Object.keys(JSON.parse(fs.readFileSync('tests/fixtures/account-visual-contract.json','utf8')).files),...Object.keys(JSON.parse(fs.readFileSync('tests/fixtures/updates-visual-contract.json','utf8')).files)])].sort())
})
test('Conversation migration preserves unowned CSS declarations/cascade including composer, attachments and Spaces reaction styles',()=>{
 const owned=/\.(?:conversation-header(?:-actions)?|chat-title-group|conversation-identity-button|conversation-heading|conversation-subheading|chat-avatar|connection-status|call-action|mobile-back|message-list|older-messages-loading|conversation-loading|message-empty|message-row|message-avatar|message-content|message-meta|message-bubble|message-footer|message-time|message-receipt|message-actions|message-pinned-label|message-edited|reply-quote|call-history-message|conversation-reactions)(?![\w-])/
 function unowned(text){const rows=[];postcss.parse(text).walkRules(rule=>{if(rule.parent.name==='keyframes'&&rule.parent.params==='message-jump-highlight')return;const nesting=[];for(let p=rule.parent;p;p=p.parent)if(p.type==='atrule')nesting.unshift([p.name,p.params]);for(let selector of rule.selectors){selector=selector.replaceAll('.message-reactions:not(:where(.conversation-reactions))','.message-reactions');if(owned.test(selector))continue;rows.push({selector,nesting,decls:rule.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value,n.important])})}});return rows}
 const file='client/src/shared/styles/platform.css';assert.deepEqual(unowned(read(file)),unowned(before(file)))
})
test('Conversation metadata stays in flow and reactions attach to their own bubble without raw palette or altered picker/upload contracts',()=>{
 const css=postcss.parse(read('client/src/shared/styles/platform.css'));const rules=selector=>css.nodes.filter(n=>n.type==='rule'&&n.selector===selector)
 assert.equal(rules('.message-footer').at(-1).nodes.find(n=>n.prop==='position'),undefined)
 assert.ok(rules('.message-bubble:not(.media-pending-bubble)').length);assert.ok(rules('.message-bubble:where(.media-pending-bubble)').length);
 assert.ok(rules('.conversation-reactions').at(-1).nodes.some(n=>n.prop==='margin-top'&&n.value==='var(--ds-space-2)'))
 for(const file of Object.keys(contract.files).filter(f=>f.endsWith('.tsx')))assert.doesNotMatch(read(file),/#[\da-f]{3,8}\b|rgba?\(|ui:(?:text|leading|tracking)-\[/)
 assert.equal(read('client/src/features/messaging/MessageComposer.tsx'),before('client/src/features/messaging/MessageComposer.tsx'))
})
