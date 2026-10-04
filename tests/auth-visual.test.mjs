import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import postcss from 'postcss'
import * as jsx from 'react/jsx-runtime'
import {load} from './helpers/foundation-harness.mjs'
import {restoreAuthVisual,authVisualFiles} from './helpers/auth-visual-parity.mjs'
import {restoreConsistencyVisual} from './helpers/consistency-visual-parity.mjs'
const base='90e5a8517f4e58dd8670a2d3e744809b0a031a3e'
const read=f=>restoreConsistencyVisual(f,fs.readFileSync(f,'utf8')),before=f=>execFileSync('git',['show',`${base}:${f}`],{encoding:'utf8'})
const owned=s=>/\.(?:auth-[\w-]+|story-[\w-]+|mobile-brand|form-intro|privacy-note|orbit-one|orbit-two|loading-screen|service-error)(?![\w-])/.test(s)
test('Auth CSS-only scope freezes every auth, crypto, session, bootstrap, routing, API and server source byte',()=>{
 assert.deepEqual(execFileSync('git',['diff','--name-only',base,'--','client','server','package.json','package-lock.json'],{encoding:'utf8'}).trim().split('\n').sort(),authVisualFiles.sort())
 for(const f of authVisualFiles)assert.equal(restoreAuthVisual(f,read(f)),before(f),f)
})
test('Auth preserves exact unowned CSS selectors, declarations, nesting and order including Calls, shared fields, Account and Shell',()=>{
 function unowned(text){const rows=[];postcss.parse(text).walkRules(r=>{const nesting=[];for(let p=r.parent;p;p=p.parent)if(p.type==='atrule')nesting.unshift([p.name,p.params]);for(const selector of r.selectors)if(!owned(selector))rows.push({selector,nesting,decls:r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value,n.important])})});return rows}
 for(const f of authVisualFiles)assert.deepEqual(unowned(read(f)),unowned(before(f)),f)
})
test('Auth uses existing semantic colors, scoped fields/errors/focus and a fluid scrollable mobile form',()=>{
 const css=read('client/src/shared/styles/platform.css'),tokens=read('client/src/shared/styles/tokens.css');for(const f of authVisualFiles)postcss.parse(read(f)).walkRules(r=>{if(!r.selectors.some(owned))return;r.walkDecls(d=>{assert.doesNotMatch(d.value,/#|rgba?\(|gradient\(/);for(const [,token] of d.value.matchAll(/var\((--ds-[\w-]+)\)/g))assert.ok(tokens.includes(token+':'),token)})})
 assert.match(css,/\.auth-page \.form-error[^}]+var\(--ds-color-danger\)/);assert.match(css,/outline: 2px solid var\(--ds-color-focus\)/);assert.match(css,/width: min\(440px,100%\)/)
 const mobile=css.slice(css.lastIndexOf('@media (max-width: 700px)'));assert.match(mobile,/align-items: start/);assert.match(mobile,/font-size: 16px/);assert.doesNotMatch(mobile,/overflow: hidden|position: fixed/)
})
function elements(tree){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(elements);return [tree,...elements(tree.props?.children)]}
function render(name,seeds){const states=[],writes=[];let slot=0;const mock={react:{useState(initial){const i=slot++,value=i in seeds?seeds[i]:initial;states[i]=value;return [value,v=>writes.push([i,v])]}},'react/jsx-runtime':jsx,'lucide-react':new Proxy({},{get:()=>()=>null}),'../../shared/api':{api:()=>{throw new Error('Unexpected submit in markup test')}},'../auth/crypto/crypto':{},'../../shared/components/BrandMark':{BrandMark:()=>null},'../../shared/components/Button':{Button:()=>null}};return {nodes:elements(load(`client/src/features/auth/${name}.tsx`,mock)[name]({onSignedIn(){},onUnlocked(){}})),writes}}
test('Actual Auth/Unlock forms retain field validation, mode switch, loading/error, autocomplete and controlled-password contracts',()=>{
 const signup=render('AuthScreen',{}),fields=signup.nodes.filter(n=>n.type==='input').map(n=>n.props);assert.deepEqual(fields.map(p=>p.name),['displayName','username','email','password']);assert.ok(fields.every(p=>p.required));assert.equal(fields[1].pattern,'[A-Za-z0-9_]+');assert.equal(fields[1].minLength,3);assert.equal(fields[1].maxLength,24);assert.equal(fields[3].minLength,10);assert.equal(fields[3].autoComplete,'new-password')
 signup.nodes.find(n=>n.type==='button').props.onClick();assert.deepEqual(signup.writes,[[1,''],[0,'sign-in']])
 const signin=render('AuthScreen',{0:'sign-in',1:'Original backend error',2:true}),inputs=signin.nodes.filter(n=>n.type==='input').map(n=>n.props);assert.deepEqual(inputs.map(p=>p.name),['email','password']);assert.equal(inputs[1].minLength,1);assert.equal(inputs[1].autoComplete,'current-password');assert.equal(signin.nodes.find(n=>n.props?.type==='submit').props.disabled,true);assert.equal(signin.nodes.find(n=>n.props?.role==='alert').props.children,'Original backend error')
 const unlock=render('UnlockScreen',{0:'synthetic',1:true,2:'Original unlock error'}),password=unlock.nodes.find(n=>n.type==='input').props;assert.equal(password.type,'password');assert.equal(password.required,true);assert.equal(password.autoComplete,'current-password');password.onChange({target:{value:'changed-synthetic'}});assert.deepEqual(unlock.writes,[[0,'changed-synthetic']]);assert.equal(unlock.nodes.find(n=>n.props?.type==='submit').props.disabled,true);assert.equal(unlock.nodes.find(n=>n.props?.role==='alert').props.children,'Original unlock error')
})
