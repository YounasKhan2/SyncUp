import fs from 'node:fs/promises'
import {fullSnapshot} from './design-system-wiring-visual-capture.mjs'
import {stableRaster} from './spaces-visual-capture.mjs'
export const cases=['desktop','mobile'].flatMap(size=>[{theme:'light',os:'light'},{theme:'dark',os:'light'},{theme:'system',os:'light'},{theme:'system',os:'dark'}].flatMap(mode=>['account','report','report-error','report-busy'].map(scene=>({size,...mode,scene,id:`${size}-${mode.theme}-${mode.os}-${scene}`}))))
export const nativeState=()=>({focus:{tag:document.activeElement?.tagName,id:document.activeElement?.id,label:document.activeElement?.getAttribute('aria-label'),text:document.activeElement?.tagName==='BUTTON'?document.activeElement.textContent:null},scroll:[scrollX,scrollY,...[...document.querySelectorAll('.ui-dialog')].map(n=>n.scrollTop)],panels:document.querySelectorAll('[role="dialog"]').length,fields:[...document.querySelectorAll('input,textarea,select')].map(n=>({tag:n.tagName,type:n.type,name:n.name,value:n.value,checked:n.checked,required:n.required,disabled:n.disabled,readOnly:n.readOnly,valid:n.validity.valid,labels:[...(n.labels??[])].map(l=>l.textContent)})),events:JSON.parse(document.getElementById('fixture-events').textContent),diagnostics:document.querySelector('#final-validation-events')?.textContent})
async function settledSnapshot(tab,directory,identity){
 let previous,consecutive=0,state;const samples=[]
 for(let attempt=0;attempt<20;attempt++){await tab.getAXState({emit:false});state=await tab.playwright.evaluate(fullSnapshot);samples.push(state);const serialized=JSON.stringify(state);consecutive=serialized===previous?consecutive+1:1;previous=serialized;if(consecutive===3)break}
 if(consecutive!==3)throw Error('Unsettled native transition '+identity)
 await fs.mkdir(`${directory}/settling`,{recursive:true});await fs.writeFile(`${directory}/settling/${identity}.json`,JSON.stringify(samples));return state
}
export async function capture(tab,viewport,directory,side,start,end){
 await fs.mkdir(directory,{recursive:true})
 for(const item of cases.slice(start,end)){
  const wanted=item.size==='desktop'?[1440,900]:[390,844]
  if(JSON.stringify(await tab.playwright.evaluate(()=>[innerWidth,innerHeight]))!==JSON.stringify(wanted)){
   await viewport.set(item.size==='desktop'?{width:1714,height:1071}:{width:464,height:1004})
   // Preflight the unchanged BASE after resize, before either accepted build capture.
   await tab.goto('http://127.0.0.1:5181/base/?scene=report&theme=light&os=light')
   await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({state:'attached'});await tab.getAXState({emit:false})
   await stableRaster(tab,`${directory}/resize-preflight`,item.size)
  }
  await tab.goto(`http://127.0.0.1:5181/${side}/?scene=${item.scene}&theme=${item.theme}&os=${item.os}`)
  await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({state:'attached'});await tab.getAXState({emit:false})
  if(item.scene.startsWith('report-')){await tab.playwright.getByRole('button',{name:'Submit report',exact:true}).click();await tab.getAXState({emit:false});if(item.scene==='report-error')await tab.playwright.getByRole('alert').waitFor({state:'visible'})}
  const heading=item.scene==='account'?'Profile & settings':'Report this message'
  await tab.playwright.getByRole('heading',{name:heading,exact:true}).click();await tab.getAXState({emit:false})
  const setup=await tab.playwright.evaluate(()=>({theme:document.documentElement.dataset.theme,appearance:document.documentElement.dataset.appearance,os:document.documentElement.dataset.visualOs,dark:document.documentElement.dataset.visualSystemDark,light:document.documentElement.dataset.visualSystemLight,colorScheme:document.documentElement.style.colorScheme,fonts:document.fonts.status,diagnostics:document.querySelector('#final-validation-events')?.textContent}))
  if(setup.theme!==(item.theme==='system'?item.os:item.theme)||setup.appearance!==item.theme||setup.os!==item.os||setup.dark!==String(item.os==='dark')||setup.light!==String(item.os==='light')||setup.colorScheme!==setup.theme||setup.fonts!=='loaded'||setup.diagnostics!=='[]')throw Error('Invalid theme/setup '+item.id)
  if(item.scene==='report-busy'&&await tab.playwright.getByRole('button',{name:'Submitting…',exact:false}).isEnabled())throw Error('Busy state not disabled')
  await stableRaster(tab,directory,`${side}-${item.id}`)
  const state=await settledSnapshot(tab,directory,`${side}-${item.id}`),native=await tab.playwright.evaluate(nativeState)
  if(JSON.stringify(state.viewport)!==JSON.stringify(wanted)||state.dpr!==1.190000057220459)throw Error('Invalid viewport '+item.id)
  await fs.writeFile(`${directory}/${side}-${item.id}.json`,JSON.stringify({setup,native,...state}))
  for(let repeat=1;repeat<=3;repeat++)await fs.writeFile(`${directory}/${side}-${item.id}-${repeat}.jpg`,await tab.screenshot({fullPage:false}))
  if(JSON.stringify(await tab.playwright.evaluate(fullSnapshot))!==JSON.stringify(state))throw Error('Unstable structure '+item.id)
 }
 return{side,start,end,cases:end-start}
}
// Keep builds adjacent under the same settled viewport/compositor configuration.
export async function capturePairs(tab,viewport,directory,start,end){for(let index=start;index<end;index++)for(const side of ['base','head'])await capture(tab,viewport,directory,side,index,index+1);return{start,end,pairedCases:end-start}}
export async function interactions(tab,directory,side,size){
 const traces=[]
 const observe=async step=>{
  // Observe native transitions reaching their unchanged endpoint; do not disable CSS.
  let previous,consecutive=0,structure;const settling=[]
  for(let attempt=0;attempt<16;attempt++){await tab.getAXState({emit:false});structure=await tab.playwright.evaluate(fullSnapshot);const serialized=JSON.stringify(structure);settling.push(structure);consecutive=serialized===previous?consecutive+1:1;previous=serialized;if(consecutive===3)break}
  if(consecutive!==3)throw Error('Unsettled interaction '+step)
  traces.push({step,state:await tab.playwright.evaluate(nativeState),structure})
  await fs.mkdir(`${directory}/settling`,{recursive:true});await fs.writeFile(`${directory}/settling/${side}-${size}-${step.replaceAll(':','-')}.json`,JSON.stringify(settling))
 }
 for(const scene of ['report','report-busy','account']){
  await tab.goto(`http://127.0.0.1:5181/${side}/?scene=${scene}&theme=light&os=light`);await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({state:'attached'});await observe(scene+':open')
  const close=tab.playwright.getByRole('button',{name:scene==='account'?'Close profile':'Close report',exact:true})
  await close.press('Escape');await observe(scene+':Escape')
  await close.press('Tab');await observe(scene+':Tab')
  await tab.playwright.locator(':focus').press('Shift+Tab');await observe(scene+':Shift+Tab')
  if(scene==='account'){
   const field=tab.playwright.getByLabel('Display name',{exact:true});await field.fill('');await field.press('Enter');await observe('account:invalid-required-Enter')
   await field.fill('Sam Updated');await field.press('Enter');await tab.playwright.getByText('Profile saved.',{exact:true}).waitFor({state:'visible'});await observe('account:valid-Enter-submit')
   await tab.scroll([size==='desktop'?700:200,size==='desktop'?600:600],'down',1);await observe('account:overflow-scroll')
  }else{
   await tab.playwright.locator('select').selectOption('other');await tab.playwright.getByLabel('Additional details (optional)',{exact:true}).fill('Fixture report')
   await tab.playwright.getByRole('button',{name:'Submit report',exact:true}).click();await observe(scene+':submit')
   if(scene==='report-busy'){await tab.click([10,10]);await observe('report-busy:outside-blocked');await close.click();await observe('report-busy:close-enabled')}
  }
  if(scene==='account'){await close.click();await observe('account:close-no-restoration')}
  await tab.playwright.getByRole('button',{name:'Open dialog',exact:true}).click();await observe(scene+':reopen');await tab.click([10,10]);await observe(scene+':outside-close')
 }
 await fs.writeFile(`${directory}/${side}-${size}-interactions.json`,JSON.stringify(traces))
 return{side,size,steps:traces.length}
}
