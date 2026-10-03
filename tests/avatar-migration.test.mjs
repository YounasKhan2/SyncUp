import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import postcss from 'postcss'
import { buildProof } from './helpers/design-system-wiring-proof.mjs'
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/avatar-migration-baseline.json','utf8'))
const read=file=>fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')

test('Avatar transfers only four exact root declarations and static prefixed utilities',()=>{
  for(const [file,record] of Object.entries(fixture.files)) {
    assert.equal(record.before,execFileSync('git',['show',`${fixture.base}:${file}`],{encoding:'utf8'}))
    assert.equal(read(file),record.after)
  }
  const file='client/src/shared/components/Avatar.tsx',record=fixture.files[file]
  assert.equal(record.after.replace(' ui:relative ui:grid ui:place-items-center ui:overflow-hidden',''),record.before)
  assert.doesNotMatch(record.after, /#[\da-f]{3,8}\b|ui:[\w-]+-\[|!important|ui:.*!/i)
  const cssFile='client/src/shared/styles/platform.css', css=fixture.files[cssFile]
  assert.equal(css.after.replace('.avatar { ','.avatar { position: relative; display: grid; ').replace('flex: 0 0 auto; border-radius: 50%;','flex: 0 0 auto; place-items: center; overflow: hidden; border-radius: 50%;'),css.before)
})

test('Avatar keeps every contextual override, image/fallback rule and unrelated production file frozen',()=>{
  const files=execFileSync('git',['ls-tree','-r','--name-only',fixture.base],{encoding:'utf8'}).trim().split('\n').filter(file=>file.startsWith('client/')||file.startsWith('server/')||['package.json','package-lock.json'].includes(file))
  for(const file of files)if(!fixture.files[file])assert.equal(read(file),execFileSync('git',['show',`${fixture.base}:${file}`],{encoding:'utf8'}).replaceAll('\r\n','\n'),file)
  const root=postcss.parse(read('client/src/shared/styles/platform.css'));let avatar
  root.walkRules('.avatar',rule=>{avatar=rule})
  assert.ok(avatar)
  for(const declaration of avatar.nodes)assert.ok(!['position','display','place-items','overflow'].includes(declaration.prop))
  assert.equal(avatar.nodes.find(d=>d.prop==='border-radius').value,'50%')
})

test('Avatar root utilities are emitted by client-only production source detection',async()=>{
  const result=await buildProof('.git/design04/utility-proof')
  for(const name of ['relative','grid','place-items-center','overflow-hidden'])assert.ok(result.css.includes('.ui\\:'+name),name)
})
