// Local presentation fixture: actual Account modules, synthetic API replies only.
import React, {useLayoutEffect, useState} from 'react'
import {createRoot} from 'react-dom/client'
import '../../client/src/index.css'
import '../../client/src/App.css'
import {AccountPanel} from '../../client/src/features/account/AccountPanel'
import {applyAppearancePreference, type AppearancePreference} from '../../client/src/shared/appearance'
import type {User} from '../../client/src/shared/types'
const params=new URLSearchParams(location.search)
const initial=(params.get('theme')??'light') as AppearancePreference
const sample:User={id:'me',display_name:'Sam Rivera',username:'sam_rivera',email:'sam@example.invalid',about:'Building useful things together.',discoverable:true,read_receipts_enabled:true,avatar_url:null}
let user=sample
let sessions=[{id:'current',device_name:'Chrome · Windows · This browser',last_active_at:'2026-10-04T08:00:00Z'},{id:'other',device_name:'Mobile browser · Android',last_active_at:'2026-10-03T15:30:00Z'}]
let blocks=[{id:'blocked',display_name:'Morgan Blake',username:'morgan_blake',blocked_at:'2026-10-01T08:00:00Z'}]
const trace:string[]=[]
window.fetch=async (input, options={})=>{
 const path=String(input),method=options.method??'GET';trace.push(method+' '+path)
 const reply=(data:unknown,status=200)=>Promise.resolve(new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}}))
 if(path==='/api/auth/sessions')return params.get('scene')==='error'?reply({error:{message:'Unable to load sessions.'}},500):reply({sessions,currentSessionId:'current'})
 if(path.endsWith('/revoke')){sessions=sessions.filter(s=>!path.includes(s.id));return new Response(null,{status:204})}
 if(path==='/api/auth/me'&&method==='PATCH'){const fields=JSON.parse(String(options.body));if(fields.displayName==='Fail')return reply({error:{message:'Unable to save changes. Please try again.'}},400);user={...user,display_name:fields.displayName,username:fields.username,about:fields.about,discoverable:fields.discoverable,read_receipts_enabled:fields.readReceiptsEnabled};return reply({user})}
 if(path==='/api/blocks'&&method==='POST'){const {username}=JSON.parse(String(options.body));blocks.push({id:username,username,display_name:username,blocked_at:'2026-10-04T08:00:00Z'});return new Response(null,{status:204})}
 if(path==='/api/blocks')return reply({blockedUsers:blocks})
 if(path.startsWith('/api/blocks/')&&method==='DELETE'){blocks=blocks.filter(b=>!path.endsWith(encodeURIComponent(b.id)));return new Response(null,{status:204})}
 if(path==='/api/reports')return reply({})
 throw new Error('No network in Account fixture: '+path)
}
function Preview(){const [appearance,setAppearance]=useState<AppearancePreference>(initial),[profile,setProfile]=useState(user),[open,setOpen]=useState(true);useLayoutEffect(()=>applyAppearancePreference(initial),[]);return <><output hidden aria-label="Fixture trace">{trace.join('\n')}</output>{open&&<AccountPanel user={profile} appearance={appearance} onAppearanceChange={p=>{setAppearance(p);applyAppearancePreference(p)}} onClose={()=>setOpen(false)} onSaved={setProfile}/>}</>}
createRoot(document.getElementById('root')!).render(<Preview/> )
