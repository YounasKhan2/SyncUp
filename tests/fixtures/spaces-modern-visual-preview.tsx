// Real SpacesPage effects/handlers with synthetic local transport. No production API.
import React, {useLayoutEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import '../../client/src/index.css'
import '../../client/src/App.css'
import {SpacesPage} from '../../client/src/features/spaces/SpacesPage'
import {WorkspaceRail} from '../../client/src/features/workspace/components/WorkspaceRail'
import {MobileNavigation} from '../../client/src/features/workspace/components/MobileNavigation'
import {applyAppearancePreference} from '../../client/src/shared/appearance'
const params=new URLSearchParams(location.search),scene=params.get('scene')??'main',role=params.get('role')??'owner'
const members=[{id:'me',username:'sam',display_name:'Sam Rivera',role},{id:'alex',username:'alex',display_name:'Alex Chen',role:'member'}]
const permissions=[{role:'moderator',can_view:true,can_send:true,can_speak:true},{role:'member',can_view:true,can_send:true,can_speak:true},{role:'guest',can_view:false,can_send:false,can_speak:false}]
const common={category_id:'project',category_name:'Project',can_send:role!=='guest',can_speak:role!=='guest',members,permissions:scene==='fallback'?null:permissions}
const space={id:'space',name:'Product planning',description:'Share drafts, review work and make decisions together.',icon:'layers',role,categories:[{id:'project',name:'Project'},{id:'design',name:'Design'}],channels:[{...common,id:'general',name:'general',type:'discussion',topic:'Project updates and team decisions'},{...common,id:'announcements',name:'announcements',type:'announcement',topic:'Reviewed project announcements',can_send:role==='owner'},{...common,id:'voice',name:'team-room',type:'voice',topic:'Persistent team voice room'}],members}
const created='2026-10-04T08:00:00Z',objectCommon={space_id:'space',space_name:space.name,chat_id:'general',channel_name:'general',created_by:'me',created_at:created,updated_at:created,terminal_at:null,message_seq:'2',response_counts:{},my_response:null,state:'active'}
let objects:any[]=scene==='empty'?[]:[{...objectCommon,id:'poll',message_id:'poll-message',object_type:'poll',title:'Which day works for the design review?',payload:{options:[{id:'a',text:'Tuesday morning'},{id:'b',text:'Wednesday afternoon'}]},response_counts:{a:2,b:1}},{...objectCommon,id:'checklist',message_id:'checklist-message',object_type:'checklist',title:'Prepare the release notes and review accessibility with the team',payload:{items:[{id:'review',text:'Review the release notes',assigneeId:'me',done:false},{id:'feedback',text:'Gather feedback from the team',assigneeId:'alex',done:true}]}},{...objectCommon,id:'event',message_id:'event-message',object_type:'event',title:'Team review',payload:{startsAt:created,endsAt:'2026-10-04T09:00:00Z',timezone:'UTC',locationText:'Design room'},my_response:{rsvp:'yes'}},{...objectCommon,id:'decision',message_id:'decision-message',object_type:'decision',title:'Release scope agreed',payload:{quote:'Ship reviewed messaging improvements before beginning the next phase.'}}]
let messages=scene==='empty'?[]:[{id:'intro',body:'The latest draft is ready for review. Please add your feedback before the team meeting.'},...objects.map(o=>({id:o.message_id,body:o.title,shared_object_id:o.id}))].map((m,i)=>({...m,chat_id:'general',server_seq:String(i+1),sender_id:'me',display_name:'Sam Rivera',username:'sam',mentions:[],everyone_mentioned:false,is_mentioned:false,created_at:created}))
const requests:string[]=[]
const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})
window.fetch=async(input,options={})=>{const url=new URL(String(input),'http://fixture.invalid'),path=url.pathname,method=options.method??'GET';requests.push(method+' '+path+(options.body?' '+String(options.body):''))
 if(scene==='error')return reply({error:{message:'Unable to load Spaces.'}},500)
 if(method==='GET'&&path==='/api/spaces')return reply({spaces:scene==='overview-empty'?[]:[{...space,channel_count:3}]})
 if(method==='GET'&&path==='/api/spaces/space')return reply({space})
 if(method==='GET'&&path.endsWith('/messages'))return reply({messages:path.includes('/general/')?messages:[]})
 if(method==='GET'&&path.endsWith('/objects'))return reply({objects:path.includes('/general/')?objects:[]})
 if(method==='GET'&&path.endsWith('/files'))return reply({files:[]})
 if(method==='GET'&&path.endsWith('/search'))return reply({results:[]})
 const data=options.body?JSON.parse(String(options.body)):{}
 if(method==='PATCH'&&path.endsWith('/permissions')){space.channels[0].permissions=data.permissions;return reply({})}
 if(method==='PATCH'&&path==='/api/spaces/space'){Object.assign(space,data);return reply({})}
 if(method==='POST'&&path.endsWith('/respond')){const o=objects.find(o=>path.includes('/'+o.id+'/'))!;if(data.type==='poll')o.my_response={optionIds:data.optionIds};if(data.type==='event')o.my_response={rsvp:data.rsvp};if(data.type==='checklist'){o.payload.items=o.payload.items.map((i:any)=>i.id===data.itemId?{...i,done:data.done}:i);if(o.payload.items.every((i:any)=>i.done))o.state='completed'}return reply({})}
 if(method==='PATCH'&&path.endsWith('/state')){objects.find(o=>path.includes('/'+o.id+'/'))!.state=data.state;return reply({})}
 if(method==='POST'&&path.endsWith('/messages')){messages.push({...messages[0],id:'sent',body:data.body,server_seq:'6'});return reply({})}
 throw new Error('Unexpected local preview request '+method+' '+path)
}
// No live SSE connection; production effect registration/cleanup still executes.
window.EventSource=class {addEventListener(){} removeEventListener(){} close(){}} as any
const user={id:'me',username:'sam',display_name:'Sam Rivera',email:'preview@example.invalid'}
function Preview(){const [actions,setActions]=useState<string[]>([]);useLayoutEffect(()=>applyAppearancePreference(params.get('theme')==='dark'?'dark':'light'),[]);const record=(s:string)=>setActions(a=>[...a,s]);const overview=scene.startsWith('overview')||scene==='error';return <><output hidden aria-label="Fixture navigation">{actions.join('\n')}</output><output hidden aria-label="Fixture requests">{requests.join('\n')}</output><main className="workspace has-active-space ui:bg-canvas"><WorkspaceRail user={user} showCalls={false} showUpdates={false} showSpaces unreadConversationCount={0} onShowChats={()=>record('chats')} onShowCalls={()=>record('calls')} onShowUpdates={()=>record('updates')} onShowSpaces={()=>record('spaces')} onOpenAccount={()=>record('account')}/><SpacesPage userId="me" onBack={()=>record('back')} onJoinVoiceRoom={call=>record(JSON.stringify(call))} openTarget={overview?null:{spaceId:'space',channelId:scene==='voice'?'voice':'general',messageId:''}}/><MobileNavigation section="spaces" accountOpen={false} unreadConversationCount={0} onShowChats={()=>record('chats')} onShowCalls={()=>record('calls')} onShowUpdates={()=>record('updates')} onShowSpaces={()=>record('spaces')} onOpenAccount={()=>record('account')}/></main></>}
createRoot(document.getElementById('root')!).render(<Preview/> )
