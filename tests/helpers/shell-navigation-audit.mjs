import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import postcss from 'postcss'
export const base = 'bf407baf96aa0e9329f143e1ffa01280d664172a'
export const productionFiles = ['client/src/features/workspace/WorkspacePage.tsx','client/src/features/workspace/components/WorkspaceRail.tsx','client/src/features/workspace/components/MobileNavigation.tsx','client/src/features/workspace/components/InboxPane.tsx','client/src/shared/styles/platform.css','client/src/shared/styles/platform-shell.css']
const directory = 'docs/design-system/evidence-06'
fs.mkdirSync(directory,{recursive:true})
const rules=[]
for(const file of execFileSync('rg',['--files','client/src','-g','*.css'],{encoding:'utf8'}).trim().split(/\r?\n/)){
 const name=file.replaceAll('\\','/'),css=postcss.parse(execFileSync('git',['show',`${base}:${name}`],{encoding:'utf8'}))
 css.walkRules(rule=>{
  const nesting=[];for(let parent=rule.parent;parent;parent=parent.parent)if(parent.type==='atrule')nesting.unshift(`@${parent.name} ${parent.params}`)
  const selectors=rule.selectors.map(selector=>({selector,classification:/primary-rail|rail-item|rail-spacer|rail-glyph|profile-trigger|navigation-badge|mobile-bottom-nav|mobile-nav-icon|avatar-you/.test(selector)?'NAVIGATION_OWNED':/workspace|inbox-pane/.test(selector)?'SHELL_OWNED':/ui-|\.avatar\b|brand-mark/.test(selector)?'SHARED_PRIMITIVE':/^:root|^body|^html|^\*|focus-visible|skip-link/.test(selector)?'GLOBAL_REQUIRED':'FEATURE_OWNED'}))
  if(selectors.some(row=>row.classification!=='FEATURE_OWNED')||/workspace|rail|mobile-nav|inbox-pane/.test(rule.selector))rules.push({file:name,line:rule.source.start.line,nesting,selectors,mixedOwnership:new Set(selectors.map(row=>row.classification)).size>1?'LEGACY_COUPLING':null,declarations:rule.nodes.filter(n=>n.type==='decl').map(n=>({property:n.prop,value:n.value,important:Boolean(n.important)}))})
 })
}
fs.writeFileSync(`${directory}/ownership-before.json`,JSON.stringify({base,rules},null,2))
if(!fs.existsSync('tests/fixtures/shell-navigation-baseline.json'))fs.writeFileSync('tests/fixtures/shell-navigation-baseline.json',JSON.stringify({base,files:Object.fromEntries(productionFiles.map(file=>[file,{before:execFileSync('git',['show',`${base}:${file}`],{encoding:'utf8'}),after:null}]))},null,2))
const css=fs.readFileSync('client/src/shared/styles/tokens.css','utf8'),light=css.slice(0,css.indexOf(':root[data-theme="dark"]')),dark=css.slice(css.indexOf(':root[data-theme="dark"]'))
const ratio=(a,b)=>{const lum=h=>{const c=h.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722};const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
const measurements=[]
for(const[theme,text]of [['light',light],['dark',dark]]){const tokens=Object.fromEntries([...text.matchAll(/--ds-color-([\w-]+):\s*(#[\da-fA-F]{6})/g)].map(m=>[m[1],m[2]]));for(const[label,fg,bg,minimum]of [['default label','text-secondary','sidebar',4.5],['selected label','text-primary','selected',4.5],['selected accent','brand','selected',3],['badge','danger-foreground','danger',4.5],['focus ring','focus','sidebar',3]]){const value=ratio(tokens[fg],tokens[bg]);measurements.push({theme,label,foreground:tokens[fg],background:tokens[bg],ratio:value,minimum,pass:value>=minimum})}}
fs.writeFileSync(`${directory}/contrast-plan.json`,JSON.stringify(measurements,null,2));console.log(JSON.stringify({rules:rules.length,measurements}))
