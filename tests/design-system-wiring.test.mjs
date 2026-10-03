import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import test from 'node:test'
import postcss from 'postcss'
import {buildProof,proofClasses} from './helpers/design-system-wiring-proof.mjs'
import {restoreButtonMigration} from './helpers/button-migration-parity.mjs'

const base='d9324b16475783681aece801fcb5b0a7935ad77d'
const contract=JSON.parse(fs.readFileSync('docs/design-system/semantic-contract.json','utf8'))
const tokens=postcss.parse(fs.readFileSync('client/src/shared/styles/tokens.css','utf8'))
const theme=fs.readFileSync('client/src/shared/styles/tailwind.css','utf8')
const rules=selector=>{const found=[];tokens.walkRules(selector,r=>found.push(r));return found}
const values=rule=>Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]))
const light=values(rules(':root')[0]),dark=values(rules(':root[data-theme="dark"]')[0]),fallback=values(rules(':root:not([data-theme])')[0])

function expectedStatic() {
  const out={}
  for(const [role,fields] of Object.entries(contract.typography))for(const field of ['family','size','lineHeight','weight','tracking','transform'])out[`--ds-type-${role}-${field==='lineHeight'?'line-height':field}`]=String(fields[field])
  for(const [family,key,unit] of [['space','spacingPx','px'],['space','spacingRoles','px'],['radius','radiusPx','px'],['control','controlsPx','px'],['breakpoint','breakpointsPx','px'],['layer','layers','']])for(const [name,value] of Object.entries(contract[key]))out[`--ds-${family}-${name.replace(/([a-z])([A-Z])/g,'$1-$2').toLowerCase()}`]=`${value}${unit}`
  for(const [name,value] of Object.entries(contract.elevation))out[`--ds-elevation-${name}`]=value.split(';')[0]
  for(const [name,value] of Object.entries(contract.motion.durationsMs))out[`--ds-duration-${name}`]=`${value}ms`
  for(const [name,value] of Object.entries(contract.motion.easing))out[`--ds-ease-${name}`]=value
  return out
}

test('semantic foundation preserves every approved theme color, companion and static scale',()=>{
  for(const [mode,decls] of [['light',light],['dark',dark],['dark',fallback]]) {
    for(const [role,value] of Object.entries(contract.palettes[mode]))assert.equal(decls[`--ds-color-${role}`],value)
    for(const [role,values] of Object.entries(contract.companions))if(typeof values==='object')assert.equal(decls[`--ds-color-${role}`],values[mode])
    assert.equal(decls['--ds-shadow-rgb'],contract.shadowRGB[mode])
  }
  assert.equal(rules(':root:not([data-theme])')[0].parent.params,'(prefers-color-scheme: dark)')
  for(const [name,value] of Object.entries(expectedStatic()))assert.equal(light[name],value,name)
  assert.equal(light['--ds-color-status-soft-foreground'],'var(--ds-color-text-primary)')
  assert.equal(light['--ds-color-text-inverse'],'var(--ds-color-brand-foreground)')
  assert.equal(light['--ds-color-border-strong'],'var(--ds-color-text-secondary)')
  for(const status of ['success','warning','danger','info'])assert.equal(light[`--ds-color-${status}-soft`],`color-mix(in srgb, var(--ds-color-${status}) 10%, var(--ds-color-surface))`)
})

test('semantic compatibility aliases resolve without cycles to exact historical legacy values',()=>{
  const original=postcss.parse(execFileSync('git',['show',`${base}:client/src/shared/styles/tokens.css`],{encoding:'utf8'}))
  function resolve(name,vars,seen=[]) {assert.ok(!seen.includes(name),`Custom-property cycle ${seen} -> ${name}`);assert.ok(name in vars,`Missing ${name}`);return vars[name].replace(/var\((--[\w-]+)\)/g,(_,ref)=>resolve(ref,vars,[...seen,name]))}
  for(const selector of [':root',':root[data-theme="dark"]',':root:not([data-theme])']) {
    const historic={};original.walkRules(':root',r=>Object.assign(historic,values(r)));if(selector!==':root')original.walkRules(selector,r=>Object.assign(historic,values(r)))
    const current={...light,...(selector=== ':root'?{}:selector.includes('not(')?fallback:dark)}
    for(const key of Object.keys(historic))if(key.startsWith('--'))assert.equal(resolve(key,current),resolve(key,historic),`${selector} ${key}`)
  }
})

test('Tailwind source detection is client-only, prefixed and excludes Preflight/default theme',()=>{
  assert.match(theme,/utilities\.css.*source\(none\)/)
  assert.deepEqual([...theme.matchAll(/@source\s+"([^"]+)"/g)].map(x=>path.resolve('client/src/shared/styles',x[1])),[path.resolve('client/src')])
  assert.doesNotMatch(theme,/preflight\.css|tailwindcss\/theme\.css|@import\s+["']tailwindcss["']/)
  assert.match(theme,/@theme inline prefix\(ui\)/);assert.match(theme,/--\*: initial/)
  assert.match(fs.readFileSync('client/vite.config.ts','utf8'),/plugins: \[react\(\), tailwindcss\(\{optimize:false\}\)\]/)
})

test('Phase 02 leaves all feature JSX, appearance and frozen legacy CSS identical after Git checkout newline normalization',()=>{
  const files=execFileSync('git',['ls-tree','-r','--name-only',base,'client/src'],{encoding:'utf8'}).trim().split('\n').filter(file=>/\.tsx?$/.test(file)||/\/(platform-shell|spaces|platform|primitives)\.css$/.test(file)||file.endsWith('/App.css'))
  for(const file of files)assert.equal(restoreButtonMigration(file,fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')),execFileSync('git',['show',`${base}:${file}`],{encoding:'utf8'}),file)
  assert.ok(files.length>=70)
})

test('Phase 02 introduces only approved palette literals into canonical tokens and no theme literals',()=>{
  const allowed=new Set([...Object.values(contract.palettes.light),...Object.values(contract.palettes.dark),...Object.values(contract.companions).filter(x=>typeof x==='object').flatMap(x=>Object.values(x)),'rgb(39 34 40 / 45%)','rgb(23 21 26 / 70%)'].map(x=>x.toLowerCase()))
  tokens.walkDecls(d=>{if(d.prop.startsWith('--ds-'))for(const value of d.value.match(/#[\da-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/gi)??[])if(!value.includes('var('))assert.ok(allowed.has(value.toLowerCase()),value)})
  assert.doesNotMatch(theme,/#[\da-f]{3,8}\b|rgba?\(|hsla?\(/i)
})

test('official Vite integration generates all semantic proof utilities and full typography roles',async()=>{
  const result=await buildProof('.git/design02/unit-proof'),css=postcss.parse(result.css),map=new Map()
  css.walkRules(r=>{if(r.selector.startsWith('.ui\\:'))map.set(r.selector,r)})
  const rule=name=>{const selector='.'+name.replaceAll(':','\\:');assert.ok(map.has(selector),`Missing ${name}`);return map.get(selector)}
  for(const name of proofClasses)rule(name)
  for(const [name,property,value] of [['ui:bg-canvas','background-color','var(--ds-color-canvas)'],['ui:text-primary','color','var(--ds-color-text-primary)'],['ui:border-default','border-color','var(--ds-color-border)'],['ui:p-1','padding','var(--ds-space-1)'],['ui:rounded-xs','border-radius','var(--ds-radius-xs)'],['ui:duration-fast','transition-duration','var(--ds-duration-fast)'],['ui:z-a11y','z-index','var(--ds-layer-a11y)']])assert.equal(values(rule(name))[property],value)
  for(const role of Object.keys(contract.typography))for(const [prop,field] of [['font-family','family'],['font-size','size'],['line-height','line-height'],['font-weight','weight'],['letter-spacing','tracking'],['text-transform','transform']])assert.equal(values(rule(`ui:text-${role}`))[prop],`var(--ds-type-${role}-${field})`)
  assert.match(rule('ui:two-pane:bg-canvas').parent.params,/width\s*>=\s*701px|min-width:\s*701px/)
  assert.match(rule('ui:workspace-wide:p-7').parent.params,/width\s*>=\s*1100px|min-width:\s*1100px/)
  assert.match(rule('ui:shadow-raised').toString(),/var\(--ds-elevation-raised\)/)
  assert.match(rule('ui:ring-focus').toString(),/var\(--ds-color-focus\)/)
  assert.doesNotMatch(result.css,/margin: 0;\s*padding: 0;/)
})
