import React, {useLayoutEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import '../../client/src/index.css'
import '../../client/src/App.css'
import {AccountPanel} from '../../client/src/features/account/AccountPanel'
import {ReportDialog} from '../../client/src/features/messaging/components/ReportDialog'
import {applyAppearancePreference} from '../../client/src/shared/appearance'
const params=new URLSearchParams(location.search),scene=params.get('scene')!
const user={id:'me',display_name:'Sam Rivera',username:'sam',email:'sam@example.test',about:'Project member',avatar_url:null,discoverable:true,read_receipts_enabled:true}
function Preview(){
 const [open,setOpen]=useState(true)
 useLayoutEffect(()=>{applyAppearancePreference(params.get('theme') as 'light'|'dark'|'system');document.fonts.ready.then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{document.documentElement.dataset.visualReady='true'})))},[])
 return <><button type="button" onClick={()=>setOpen(true)}>Open dialog</button>{open?(scene==='account'?<AccountPanel user={user} appearance={params.get('theme') as 'light'|'dark'|'system'} onAppearanceChange={()=>{}} onSaved={()=>{}} onClose={()=>setOpen(false)}/>:<ReportDialog messageId="message" onClose={()=>setOpen(false)}/>):<p>Dialog closed</p>}</>
}
createRoot(document.getElementById('root')!).render(<Preview/> )
