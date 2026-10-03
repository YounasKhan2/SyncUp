// UI operations run only inside cua_repl with documented browser handles.
import fs from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {fullSnapshot} from './design-system-wiring-visual-capture.mjs'
import {stableRaster} from './spaces-visual-capture.mjs'
export const modes=[{theme:'light',os:'light'},{theme:'dark',os:'light'},{theme:'system',os:'light'},{theme:'system',os:'dark'}]
const desktop=['normal','selected','hover','focus','selected-focus','unread','search','empty','requests','scroll','calls-empty','calls-history','error','offline']
const mobile=desktop.filter(s=>!['selected','hover','selected-focus'].includes(s)).concat('open')
export const cases=['desktop','mobile'].flatMap(size=>modes.flatMap(mode=>(size==='desktop'?desktop:mobile).map(scene=>({size,...mode,scene,width:size==='desktop'?1440:390,height:size==='desktop'?900:844,id:`${size}-${mode.theme}-${mode.os}-${scene}`}))))
cases.push(...[320,699,700,701,768,1024,1099,1100,1101].flatMap(width=>modes.slice(0,2).map(mode=>({size:'boundary',...mode,scene:'normal',width,height:900,id:`boundary-${width}-${mode.theme}`}))))
export let directory=fileURLToPath(new URL('../../docs/design-system/evidence-07/captures',import.meta.url))
export function useEvidenceDirectory(value){directory=value}
export const state=()=>({theme:document.documentElement.dataset.theme,appearance:document.documentElement.dataset.appearance,os:document.documentElement.dataset.visualOs,dark:document.documentElement.dataset.visualSystemDark,light:document.documentElement.dataset.visualSystemLight,colorScheme:document.documentElement.style.colorScheme,fonts:document.fonts.status,diagnostics:document.getElementById('final-validation-events').textContent,events:document.getElementById('fixture-events').textContent,fixture:document.querySelector('output[aria-label="Fixture state"]').textContent,scroll:[scrollX,scrollY,document.documentElement.scrollWidth],ownership:[document.documentElement,document.body,...document.querySelectorAll('#root,#root *')].map(n=>n.closest('.pane-heading')?'SHARED_INBOX_HEADING':n.closest('.inbox-pane')&&(document.querySelector('h1')?.textContent==='Chats'||n.matches('.inbox-pane'))?'INBOX_OWNED':'UNOWNED'),regions:[...document.querySelectorAll('.inbox-pane')].map(n=>({label:'Inbox',bounds:[n.getBoundingClientRect().x,n.getBoundingClientRect().y,n.getBoundingClientRect().width,n.getBoundingClientRect().height],display:getComputedStyle(n).display})),rows:[...document.querySelectorAll('.chat-list-item')].map(n=>{const r=n.getBoundingClientRect(),small=n.querySelector('small'),name=n.querySelector('strong'),meta=n.querySelector('.chat-row-meta');return{text:n.textContent,selected:n.classList.contains('selected'),focus:n.matches(':focus-visible'),hover:n.matches(':hover'),bounds:[r.x,r.y,r.width,r.height],name:name?.getBoundingClientRect().toJSON(),preview:small?.getBoundingClientRect().toJSON(),meta:meta?.getBoundingClientRect().toJSON(),nameOverflow:name?.scrollWidth>name?.clientWidth,previewOverflow:small?.scrollWidth>small?.clientWidth,whiteSpace:small&&getComputedStyle(small).whiteSpace,ellipsis:small&&getComputedStyle(small).textOverflow,background:getComputedStyle(n).backgroundColor,border:getComputedStyle(n).borderLeft,outline:getComputedStyle(n).outline,animation:getComputedStyle(n).animationName,transition:getComputedStyle(n).transitionDuration}}),targets:[...document.querySelectorAll('.inbox-pane button')].map(n=>{const r=n.getBoundingClientRect();return{text:n.textContent,label:n.getAttribute('aria-label'),bounds:[r.x,r.y,r.width,r.height]}}),listScroll:[...document.querySelectorAll('.chat-list')].map(n=>({top:n.scrollTop,height:n.clientHeight,scrollHeight:n.scrollHeight,width:n.clientWidth,scrollWidth:n.scrollWidth,overflow:getComputedStyle(n).overflowY}))})
export async function capture(tab,viewport,start,end,sides=['base','head']){await fs.mkdir(directory,{recursive:true});for(const item of cases.slice(start,end)){
 const wanted=[item.width,item.height]
 if(JSON.stringify(await tab.playwright.evaluate(()=>[innerWidth,innerHeight]))!==JSON.stringify(wanted)){
  await viewport.set({width:Math.round(item.width*1.190000057220459),height:Math.round(item.height*1.190000057220459)})
  await tab.goto(`http://127.0.0.1:5183/base/?scene=normal&theme=light&os=light&preflight=${item.id}`);await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({state:'attached'});await tab.getAXState({emit:false});await stableRaster(tab,directory+'/preflight',item.id)
 }
 for(const side of sides){
  await tab.goto(`http://127.0.0.1:5183/${side}/?scene=${item.scene}&theme=${item.theme}&os=${item.os}&case=${item.id}`)
  await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({state:'attached'});await tab.getAXState({emit:false})
  // Neutralize previous pointer/focus identically. Avoid hidden Inbox in mobile open.
  if(item.scene!=='open')await tab.playwright.getByRole('heading',{name:item.scene.startsWith('calls')?'Calls':'Chats',exact:true}).click()
  await tab.getAXState({emit:false})
  if(item.scene==='unread'){await tab.playwright.getByRole('button',{name:'Unread',exact:true}).click();await tab.getAXState({emit:false})}
  if(item.scene==='requests'){await tab.playwright.locator('.inbox-filters button').nth(2).click();await tab.getAXState({emit:false})}
  if(item.scene==='focus'||item.scene==='selected-focus'){await tab.playwright.locator('.chat-list-item').nth(1).press('Shift+Tab');await tab.getAXState({emit:false})}
  if(item.scene==='hover'){
   // Native drag from blank heading padding leaves an unselected row hovered.
   await tab.screenshot({fullPage:false});const points=await tab.playwright.evaluate(()=>{const h=document.querySelector('.pane-heading').getBoundingClientRect(),r=document.querySelector('.chat-list-item').getBoundingClientRect();return{from:[h.x+5,h.y+5],to:[r.x+r.width/2,r.y+r.height/2]}})
   await tab.drag(points.from,points.to);await tab.getAXState({emit:false})
  }
  if(item.scene==='search'){
   await tab.playwright.locator('.search-box').press('Enter');await tab.getAXState({emit:false});await tab.playwright.getByRole('textbox',{name:'Search people, chats, and loaded messages',exact:true}).fill('tomorrow');await tab.getAXState({emit:false});await tab.playwright.getByRole('button',{name:'Open message in Alex Chen',exact:true}).waitFor({state:'visible'});await tab.playwright.locator('.search-result:not(.search-message-result)').waitFor({state:'visible'});await tab.playwright.getByRole('heading',{name:'Search SyncUp',exact:true}).click();await tab.getAXState({emit:false})
  }
  if(item.scene==='scroll'){await tab.playwright.locator('.chat-list-item').nth(0).press('PageDown');await tab.getAXState({emit:false})}
  await stableRaster(tab,directory,side+'-'+item.id)
  const snapshot=await tab.playwright.evaluate(fullSnapshot),setup=await tab.playwright.evaluate(state)
  if(JSON.stringify(snapshot.viewport)!==JSON.stringify(wanted)||snapshot.dpr!==1.190000057220459||setup.theme!==(item.theme==='system'?item.os:item.theme)||setup.appearance!==item.theme||setup.os!==item.os||setup.dark!==String(item.os==='dark')||setup.light!==String(item.os==='light')||setup.colorScheme!==setup.theme||setup.fonts!=='loaded'||setup.diagnostics!=='[]')throw Error('Invalid setup '+side+'-'+item.id+JSON.stringify(setup))
  if(item.scene==='focus'||item.scene==='selected-focus'){if(!setup.rows[0].focus)throw Error('Native row focus missing '+item.id)}
  if(item.scene==='selected-focus'&&!setup.rows[0].selected)throw Error('Selected + focused missing')
  if(item.scene==='hover'&&(!setup.rows[0].hover||setup.rows[0].selected))throw Error('Unselected pointer hover missing')
  if(side==='head'&&!item.scene.startsWith('calls')&&item.scene!=='open'){
   const actual=await tab.playwright.evaluate(()=>({root:getComputedStyle(document.querySelector('.inbox-pane')).minHeight,list:getComputedStyle(document.querySelector('.chat-list')).minHeight,height:document.querySelector('.inbox-pane').getBoundingClientRect().height}));if(actual.root!=='0px'||actual.list!=='0px'||actual.height>item.height+.1)throw Error('Inbox scroll geometry not emitted '+item.id+JSON.stringify(actual));if(setup.scroll[2]>item.width)throw Error('Horizontal document overflow '+item.id)
   if(setup.listScroll.some(n=>n.scrollWidth>n.width))throw Error('Horizontal list overflow '+item.id)
   for(const row of setup.rows)if(row.bounds[2]>0){if(row.meta&&row.name.right>row.meta.x+.01)throw Error('Name overlaps metadata '+item.id);if(row.whiteSpace!=='nowrap'||row.ellipsis!=='ellipsis')throw Error('Truncation contract '+item.id);if(row.transition!=='0s'||row.animation!=='none')throw Error('Unexpected motion')}
   for(const target of setup.targets)if(target.bounds[2]>0&&(target.bounds[2]<43.9||target.bounds[3]<43.9))throw Error('Below 44px target '+item.id+JSON.stringify(target))
  }
  await fs.writeFile(`${directory}/${side}-${item.id}.json`,JSON.stringify({setup,...snapshot}))
  for(let repeat=1;repeat<=3;repeat++)await fs.writeFile(`${directory}/${side}-${item.id}-${repeat}.jpg`,await tab.screenshot({fullPage:false}))
  if(JSON.stringify(await tab.playwright.evaluate(fullSnapshot))!==JSON.stringify(snapshot))throw Error('Unsettled DOM '+item.id)
 }
 }return{start,end,cases:end-start,total:cases.length}}
