import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import ts from 'typescript'
import postcss from 'postcss'
import {restoreInbox} from './helpers/inbox-parity.mjs'
import {buildProof} from './helpers/design-system-wiring-proof.mjs'
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/shell-navigation-baseline.json','utf8')),read=file=>restoreInbox(file,fs.readFileSync(file,'utf8'))
function behavior(file,source){const tree=ts.createSourceFile(file,source,99,true,ts.ScriptKind.TSX),result=ts.transform(tree,[context=>{const visit=node=>ts.isJsxAttributes(node)?context.factory.updateJsxAttributes(node,node.properties.filter(n=>!ts.isJsxAttribute(n)||n.name.text!=='className')):ts.visitEachChild(node,visit,context);return node=>ts.visitNode(node,visit)}]);return ts.createPrinter().printFile(result.transformed[0])}
const owned=selector=>/\.(?:workspace|inbox-pane|primary-rail|rail-item(?:-active|-icon)?|rail-spacer|rail-glyph|profile-trigger|navigation-badge|mobile-nav-icon|mobile-bottom-nav|avatar-you)(?=[\s.:>#,\[]|$)/.test(selector)
function featureRules(source){const rows=[];postcss.parse(source).walkRules(rule=>{const nesting=[];for(let p=rule.parent;p;p=p.parent)if(p.type==='atrule')nesting.unshift(`@${p.name} ${p.params}`);for(const selector of rule.selectors)if(!owned(selector))rows.push({selector,nesting,declarations:rule.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value,Boolean(n.important)])})});return rows}
test('Shell redesign changes only JSX classes; hooks, handlers, ARIA, IDs, icons, conditions and composition remain exact',()=>{
 for(const[file,record]of Object.entries(fixture.files)){
  assert.equal(record.before,execFileSync('git',['show',`${fixture.base}:${file}`],{encoding:'utf8'}));assert.equal(read(file),record.after)
  if(file.endsWith('.tsx')){assert.equal(behavior(file,record.before),behavior(file,record.after));assert.doesNotMatch(record.after,/ui:(?:text|leading|tracking)-\[(?:\d|#)/)}
 }
 const files=execFileSync('git',['ls-tree','-r','--name-only',fixture.base],{encoding:'utf8'}).trim().split('\n').filter(f=>f.startsWith('client/')||f.startsWith('server/')||['package.json','package-lock.json'].includes(f))
 for(const file of files)if(!fixture.files[file])assert.equal(read(file),execFileSync('git',['show',`${fixture.base}:${file}`],{encoding:'utf8'}).replaceAll('\r\n','\n'),file)
})
test('Shell CSS leaves every feature/shared/global selector declaration and cascade order frozen',()=>{
 for(const file of ['client/src/shared/styles/platform.css','client/src/shared/styles/platform-shell.css'])assert.deepEqual(featureRules(read(file)),featureRules(fixture.files[file].before))
 const css=postcss.parse(read('client/src/shared/styles/platform.css'));css.walkRules(rule=>{if(rule.selectors.every(owned))for(const decl of rule.nodes.filter(n=>n.type==='decl'))assert.doesNotMatch(decl.value,/#|gradient\(|rgba?\(/,rule.selector)})
 const visibility=[];css.walkRules('.primary-rail',rule=>{if(rule.parent.type==='atrule')visibility.push([rule.parent.params,rule.nodes.map(n=>[n.prop,n.value])])});assert.deepEqual(visibility,[['(max-width: 700px)',[['display','none']]]])
 assert.match(read('client/src/shared/styles/platform-shell.css'),/grid-template-columns: 72px 280px minmax\(0, 1fr\)/)
 assert.match(read('client/src/shared/styles/platform.css'),/grid-template-columns: 56px 248px minmax\(0, 1fr\)/)
 assert.doesNotMatch(read('client/src/shared/styles/platform.css'),/\.rail-item-active\s*\{|\.mobile-bottom-nav button\[aria-current="page"\]/)
})
test('Production source detection emits shell utilities with semantic colors and approved role typography',async()=>{
 const result=await buildProof('.git/visual06/utility-proof')
 for(const className of ['bg-sidebar','bg-surface','aria-[current=page]:bg-selected','text-caption','text-label','aria-[current=page]:border-brand','rounded-md','gap-5','min-h-9','w-dvw'])assert.ok(result.css.includes('.ui\\:'+className.replace(/[^a-zA-Z0-9_-]/g,c=>'\\'+c)),className)
 assert.match(result.css,/font-size:\s*var\(--ds-type-caption-size\)/);assert.match(result.css,/background-color:\s*var\(--ds-color-sidebar\)/)
 assert.doesNotMatch(result.css,/@property --tw-border-style/)
 assert.match(result.css,/width:\s*100dvw/)
})
