import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {build} from 'vite'
import tailwindcss from '@tailwindcss/vite'
const base='5e03916584781f7769243de88d4a9f785dbfe03f',root=path.resolve('.git/visual07'),files=JSON.parse(fs.readFileSync('tests/fixtures/inbox-baseline.json','utf8')).files;const paths=Object.keys(files)
fs.mkdirSync(root,{recursive:true});const archive=execFileSync('git',['archive',base,'client'],{maxBuffer:32*1024*1024});fs.writeFileSync(root+'/client.tar',archive)
const hash=x=>createHash('sha256').update(x).digest('hex')
for(const side of process.argv.slice(2).length?process.argv.slice(2):['base','head']){
 const dir=root+'/'+side;fs.mkdirSync(dir+'/tests/fixtures',{recursive:true});execFileSync('tar',['-xf',root+'/client.tar','-C',dir])
 if(side==='head')for(const file of paths)fs.copyFileSync(file,dir+'/'+file)
 fs.copyFileSync('tests/fixtures/inbox-preview.tsx',dir+'/tests/fixtures/inbox-preview.tsx')
 const bootstrap=fs.readFileSync('tests/fixtures/spaces-visual-bootstrap.js','utf8'),observer=fs.readFileSync('tests/fixtures/final-observer.js','utf8')
 fs.writeFileSync(dir+'/index.html',`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>SyncUp primitive verification</title><script>${bootstrap}</script><script>${observer}</script></head><body><div id="root"></div><pre id="fixture-events" hidden>[]</pre><script type="module" src="./tests/fixtures/inbox-preview.tsx"></script></body></html>`)
 const api=`const user=${JSON.stringify({id:'me',display_name:'Sam Rivera',username:'sam',email:'sam@example.test'})};export async function api(url,options){const el=document.getElementById('fixture-events');const calls=JSON.parse(el.textContent);calls.push({url,options:options??null});el.textContent=JSON.stringify(calls);if(url.startsWith('/api/search?'))return{people:[],chats:[{id:'alex',kind:'direct',display_title:'Alex Chen',peer_username:'alex'}],privacy:''};if(url==='/api/auth/sessions')return{sessions:[],currentSessionId:'current'};if(url==='/api/blocks')return{blockedUsers:[]};if(url==='/api/reports'){const scene=new URLSearchParams(location.search).get('scene');if(scene==='report-busy')return new Promise(()=>{});if(scene==='report-error')throw Error('Denied');return{};}return{user};}export const apiUpload=api;`
 const isolate={name:'fixture-api-only',load(id){if(id.replaceAll('\\','/').endsWith('/client/src/shared/api.ts'))return api}}
 await build({configFile:false,root:dir,base:'./',logLevel:'error',plugins:[tailwindcss({optimize:false}),isolate],build:{outDir:'dist',emptyOutDir:true}})
 fs.writeFileSync(root+'/build-'+side+'.json',JSON.stringify({base,side,archiveSHA256:hash(archive),fixtureSHA256:hash(fs.readFileSync('tests/fixtures/inbox-preview.tsx')),bootstrapSHA256:hash(bootstrap),apiBoundarySHA256:hash(api),production:Object.fromEntries(paths.map(file=>[file,hash(fs.readFileSync(dir+'/'+file))])),productionCanonicalLF:Object.fromEntries(paths.map(file=>[file,hash(fs.readFileSync(dir+'/'+file,'utf8').replaceAll('\r\n','\n'))]))},null,2))
}
