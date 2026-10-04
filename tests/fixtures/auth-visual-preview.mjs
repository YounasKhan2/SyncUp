// Run: node tests/fixtures/auth-visual-preview.mjs
// http://127.0.0.1:5190/?scene=auth&theme=light
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import {build} from 'vite'
import tailwindcss from '@tailwindcss/vite'
const dir='.git/visual14'
fs.mkdirSync(dir,{recursive:true})
const bootstrap=fs.readFileSync('tests/fixtures/spaces-visual-bootstrap.js','utf8')
fs.writeFileSync(dir+'/preview.html',`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><script>${bootstrap}</script><title>Auth visual preview</title></head><body><div id="root"></div><script type="module" src="/tests/fixtures/auth-visual-preview.tsx"></script></body></html>`)
await build({configFile:false,root:process.cwd(),base:'/',resolve:{alias:[{find:/^(?:\.\.\/auth\/crypto\/crypto|\.\.\/features\/auth\/crypto\/crypto|\.\.\/features\/workspace\/WorkspacePage)$/,replacement:path.resolve('tests/fixtures/auth-visual-crypto.tsx')}]},plugins:[tailwindcss({optimize:false})],build:{outDir:dir+'/dist',emptyOutDir:true,rollupOptions:{input:dir+'/preview.html'}},logLevel:'error'})
fs.copyFileSync(dir+'/dist/'+dir+'/preview.html',dir+'/dist/index.html')
const root=path.resolve(dir+'/dist')
http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]??'application/octet-stream');res.end(fs.readFileSync(file))}).listen(5190,'127.0.0.1',()=>console.log('Auth fixture: http://127.0.0.1:5190'))
