// Isolated visual preview; alias applies only to this build, never production.
// Run: node tests/fixtures/calls-visual-preview.mjs
// Browse: http://127.0.0.1:5189/?scene=history&theme=light
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import {build} from 'vite'
import tailwindcss from '@tailwindcss/vite'
const dir='.git/visual13'
fs.mkdirSync(dir,{recursive:true})
const bootstrap=fs.readFileSync('tests/fixtures/spaces-visual-bootstrap.js','utf8')
fs.writeFileSync(dir+'/preview.html',`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><script>${bootstrap}</script><title>Calls visual preview</title></head><body><div id="root"></div><script type="module" src="/tests/fixtures/calls-visual-preview.tsx"></script></body></html>`)
await build({configFile:false,root:process.cwd(),base:'/',resolve:{alias:[{find:/^livekit-client$/,replacement:path.resolve('tests/fixtures/calls-visual-sdk.ts')}]},plugins:[tailwindcss({optimize:false})],build:{outDir:dir+'/dist',emptyOutDir:true,rollupOptions:{input:dir+'/preview.html'}},logLevel:'error'})
fs.copyFileSync(dir+'/dist/'+dir+'/preview.html',dir+'/dist/index.html')
const root=path.resolve(dir+'/dist')
http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]??'application/octet-stream');res.end(fs.readFileSync(file))}).listen(5189,'127.0.0.1',()=>console.log('Calls fixture: http://127.0.0.1:5189'))
