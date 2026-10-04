// Real forms/router/API with synthetic HTTP and an isolated key boundary.
import React,{useLayoutEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import '../../client/src/index.css'
import '../../client/src/App.css'
import {AuthScreen} from '../../client/src/features/auth/AuthScreen'
import {AppRouter} from '../../client/src/app/AppRouter'
import {applyAppearancePreference,parseAppearancePreference} from '../../client/src/shared/appearance'
const params=new URLSearchParams(location.search),scene=params.get('scene')??'auth'
const user={id:'fixture',username:'sam',display_name:'Sam Rivera',email:'preview@example.invalid'}
const requests:string[]=[]
const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})
window.fetch=async(input,options={})=>{const path=new URL(String(input),location.origin).pathname;requests.push((options.method??'GET')+' '+path)
 if(path==='/api/auth/me'){if(scene==='loading')return new Promise<Response>(()=>{});if(scene==='service-error')return reply({error:{message:'The service is temporarily unavailable. Please try again.'}},503);return reply({user})}
 if(path==='/api/auth/key-bundle')return reply({keyBundle:{fixture:true}})
 if(path==='/api/auth/sign-in'||path==='/api/auth/sign-up'){if(scene==='error')return reply({error:{message:'Unable to sign in. The service is temporarily unavailable. Please try again or contact your administrator if this problem continues.'}},503);if(scene==='busy')return new Promise<Response>(()=>{});return reply({user,keyBundle:{fixture:true}})}
 if(path==='/api/auth/encryption/initialize')return reply({})
 throw new Error('Unexpected fixture request '+path)
}
function Preview(){const [completed,setCompleted]=useState(false);useLayoutEffect(()=>applyAppearancePreference(parseAppearancePreference(params.get('theme'))),[]);return <><output hidden aria-label="Fixture completion">{String(completed)}</output><output hidden aria-label="Fixture requests">{requests.join('\n')}</output>{['loading','service-error','unlock','unlock-error'].includes(scene)?<AppRouter/>:<AuthScreen onSignedIn={()=>setCompleted(true)}/>}</>}
createRoot(document.getElementById('root')!).render(<Preview/> )
