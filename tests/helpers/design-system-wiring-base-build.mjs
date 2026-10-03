import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import ts from 'typescript'
import {build} from 'vite'
import {createHash} from 'node:crypto'
const base='d9324b16475783681aece801fcb5b0a7935ad77d',work=path.resolve('.git/design02/legacy'),manifest=[]
fs.mkdirSync(work,{recursive:true});const archive=execFileSync('git',['archive',base,'client'],{maxBuffer:32*1024*1024});fs.writeFileSync(path.join(work,'client.tar'),archive)
for(const [family,fixture]of [['workspace','workspace-preview'],['conversation','conversation-preview'],['account-updates','account-updates-preview'],['spaces','spaces-dialog-preview']]){
 const dir=path.join(work,family);fs.mkdirSync(path.join(dir,'tests/fixtures'),{recursive:true});execFileSync('tar',['-xf',path.join(work,'client.tar'),'-C',dir])
 const input=fs.readFileSync('tests/fixtures/'+fixture+'.tsx','utf8').replace('<nav aria-label="Fixture controls"','<nav hidden aria-label="Fixture controls"');fs.writeFileSync(path.join(dir,'tests/fixtures',fixture+'.tsx'),input)
 const bootstrap=fs.readFileSync('tests/fixtures/spaces-visual-bootstrap.js','utf8'),observer=fs.readFileSync('tests/fixtures/final-observer.js','utf8')
 fs.writeFileSync(path.join(dir,'tests/fixtures/entry.ts'),`import './${fixture}'\ndocument.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => {document.documentElement.dataset.visualReady = 'true'})))`)
 fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>SyncUp pre-migration baseline</title><script>${bootstrap}</script><script>${observer}</script></head><body><div id="root"></div><script type="module" src="./tests/fixtures/entry.ts"></script></body></html>`)
 await build({configFile:false,root:dir,base:'./',logLevel:'error',plugins:[{name:'test-only-root-state',transform(source,id){const owner=id.replaceAll('\\','/').match(/\/features\/(?:account|spaces)\/(AccountPanel|SafetySettings|UpdatesPage|SpacesPage)\.tsx$/)?.[1];if(!owner)return;const tree=ts.createSourceFile(id,source,99,true,ts.ScriptKind.TSX),edits=[];function visit(n){if(ts.isVariableDeclaration(n)&&n.initializer&&ts.isCallExpression(n.initializer)&&n.initializer.expression.getText(tree)==='useState')edits.push([n.initializer.getStart(tree),n.initializer.end,`useVisualState(${JSON.stringify((owner==='SpacesPage'?'':owner+':')+n.name.elements[0].getText(tree))}, ${n.initializer.arguments[0].getText(tree)})`]);if(ts.isCallExpression(n)&&n.expression.getText(tree)==='useEffect')edits.push([n.getStart(tree),n.end,'void 0']);ts.forEachChild(n,visit)}visit(tree);return `import {useVisualState} from '../../../../tests/fixtures/${fixture}'\n`+edits.sort((a,b)=>b[0]-a[0]).reduce((s,[a,b,r])=>s.slice(0,a)+r+s.slice(b),source)}}],build:{outDir:'dist',emptyOutDir:true}})
 const hash=x=>createHash('sha256').update(x).digest('hex');manifest.push({family,fixture,base,archiveSHA256:hash(archive),fixtureSHA256:hash(input),bootstrapSHA256:hash(bootstrap),htmlSHA256:hash(fs.readFileSync(path.join(dir,'index.html')))})
}
fs.writeFileSync('docs/design-system/evidence-02/supplemental-base-build-manifest.json',JSON.stringify(manifest,null,2)+'\n')
