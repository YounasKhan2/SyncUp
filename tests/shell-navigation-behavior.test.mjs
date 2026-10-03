import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as runtime from 'react/jsx-runtime'
import {load} from './helpers/foundation-harness.mjs'
import {nodes} from './helpers/ui-harness.mjs'
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/shell-navigation-baseline.json','utf8'))
const root='client/src/features/workspace/components/'
const mocks={'react/jsx-runtime':runtime,'lucide-react':new Proxy({},{get:(_,name)=>props=>runtime.jsx('icon:'+String(name),props)}),'../../../shared/components/BrandMark':{BrandMark:props=>runtime.jsx('BrandMark',props)},'../../../shared/components/Avatar':{Avatar:props=>runtime.jsx('Avatar',props)}}
const semantic=node=>{
 if(node==null||typeof node!=='object')return node
 if(Array.isArray(node))return node.map(semantic)
 const {className,onClick,children,...props}=node.props
 return {type:typeof node.type==='function'?node.type.name:node.type,key:node.key,props,children:semantic(children)}
}
test('Shell navigation preserves every destination, account precedence, badge boundary and callback identity',()=>{
 for(const name of ['WorkspaceRail','MobileNavigation'])for(const section of ['chats','calls','updates','spaces'])for(const accountOpen of [false,true])for(const count of [0,1,99,100,140]){
  const calls=[],callbacks=Object.fromEntries(['Chats','Calls','Updates','Spaces'].map(label=>['onShow'+label,()=>calls.push(label)])),props={user:{display_name:'Sam'},section,accountOpen,showCalls:section==='calls',showUpdates:section==='updates',showSpaces:section==='spaces',unreadConversationCount:count,...callbacks,onOpenAccount:()=>calls.push('You')}
  const file=root+name+'.tsx',before=load(file,mocks,{},fixture.files[file].before)[name](props),after=load(file,mocks)[name](props)
  assert.equal(JSON.stringify(semantic(after)),JSON.stringify(semantic(before)))
  const buttons=nodes(after,n=>n.type==='button');assert.equal(buttons.length,5)
  buttons.forEach(button=>button.props.onClick());assert.deepEqual(calls,['Chats','Calls','Updates','Spaces','You'])
  assert.equal(buttons[0].props['aria-label'],count?`Chats, ${count} unread conversations`:'Chats')
  const selected=buttons.filter(button=>button.props['aria-current']==='page');assert.equal(selected.length,1)
  if(name==='MobileNavigation'&&accountOpen)assert.equal(selected[0],buttons[4])
 }
})
