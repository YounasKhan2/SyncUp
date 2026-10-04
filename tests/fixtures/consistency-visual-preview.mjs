// Bounded Phase 15 review: reuse four existing real-component fixtures.
// No production server, real accounts, upload transport or hardware is involved.
// Run: node tests/fixtures/consistency-visual-preview.mjs
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import {build} from 'vite'
import tailwindcss from '@tailwindcss/vite'
const dir='.git/visual15',bootstrap=fs.readFileSync('tests/fixtures/spaces-visual-bootstrap.js','utf8')
fs.mkdirSync(dir,{recursive:true})
const entries={auth:'auth-visual-preview',messaging:'composer-visual-preview',spaces:'spaces-modern-visual-preview',calls:'calls-visual-preview'}
for(const [name,entry]of Object.entries(entries))fs.writeFileSync(`${dir}/${name}.html`,`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><script>${bootstrap}</script><title>Consistency: ${name}</title></head><body><div id="root"></div><script type="module" src="/tests/fixtures/${entry}.tsx"></script></body></html>`)
for(const name of Object.keys(entries)){
 const alias=name==='calls'?[{find:/^livekit-client$/,replacement:path.resolve('tests/fixtures/calls-visual-sdk.ts')}]:name==='auth'?[{find:/^(?:\.\.\/auth\/crypto\/crypto|\.\.\/features\/auth\/crypto\/crypto|\.\.\/features\/workspace\/WorkspacePage)$/,replacement:path.resolve('tests/fixtures/auth-visual-crypto.tsx')}]:[]
 await build({configFile:false,root:process.cwd(),base:`/${name}/`,resolve:{alias},plugins:[tailwindcss({optimize:false})],build:{outDir:`${dir}/dist/${name}`,emptyOutDir:true,rollupOptions:{input:`${dir}/${name}.html`}},logLevel:'error'})
 fs.copyFileSync(`${dir}/dist/${name}/${dir}/${name}.html`,`${dir}/dist/${name}/index.html`)
}
const root=path.resolve(dir+'/dist')
http.createServer((req,res)=>{let pathname=new URL(req.url,'http://localhost').pathname;if(pathname.endsWith('/'))pathname+='index.html';const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return res.writeHead(404).end();res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]??'application/octet-stream');res.end(fs.readFileSync(file))}).listen(5191,'127.0.0.1',()=>console.log('Consistency fixture: http://127.0.0.1:5191/auth/'))
