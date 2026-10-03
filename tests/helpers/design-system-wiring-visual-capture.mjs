import fs from 'node:fs/promises'
import {snapshot,stableRaster} from './spaces-visual-capture.mjs'
export const cases=['desktop','mobile'].flatMap(size=>[{theme:'light',os:'light'},{theme:'dark',os:'light'},{theme:'system',os:'light'},{theme:'system',os:'dark'}].flatMap(mode=>[['workspace','inbox'],['workspace','calls'],['workspace','direct'],['conversation','conversation'],['conversation','report'],['account-updates','account-sessions'],['account-updates','updates-items'],['spaces','text']].map(([family,scene])=>({size,...mode,family,scene,id:`${size}-${mode.theme}-${mode.os}-${family}-${scene}`}))))
export async function capture(tab,viewport,directory,start,end){await fs.mkdir(directory,{recursive:true});for(const item of cases.slice(start,end)){const wanted=item.size==='desktop'?[1440,900]:[390,844];if(JSON.stringify(await tab.playwright.evaluate(()=>[innerWidth,innerHeight]))!==JSON.stringify(wanted))await viewport.set(item.size==='desktop'?{width:1714,height:1071}:{width:464,height:1004});await tab.goto(`http://127.0.0.1:5178/${item.family}/?scene=${item.scene}&theme=${item.theme}&os=${item.os}`);await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({state:'attached'});await tab.getAXState({emit:false});const state=await tab.playwright.evaluate(snapshot),effective=item.theme==='system'?item.os:item.theme;if(state.theme!==effective||state.appearance!==item.theme||state.colorScheme!==effective||state.systemDark!==(item.os==='dark')||state.systemLight!==(item.os==='light')||state.fonts!=='loaded'||state.diagnostics!=='[]'||state.dpr!==1.190000057220459||JSON.stringify(state.viewport)!==JSON.stringify(wanted))throw Error('Invalid wiring setup '+item.id);await fs.writeFile(directory+'/'+item.id+'.json',JSON.stringify(state));await fs.writeFile(directory+'/'+item.id+'-full-head.json',JSON.stringify(await tab.playwright.evaluate(fullSnapshot)));await stableRaster(tab,directory,item.id);for(let repeat=1;repeat<=3;repeat++){await fs.writeFile(directory+'/'+item.id+'-'+repeat+'.jpg',await tab.screenshot({fullPage:false}));if(JSON.stringify(await tab.playwright.evaluate(snapshot))!==JSON.stringify(state))throw Error('Unstable DOM '+item.id)}await captureFullStyles(tab,directory,item)}return{start,end,cases:end-start}}

export const fullSnapshot = () => {
  const nodes=[document.documentElement,document.body,...document.querySelectorAll('#root, #root *')]
  const chunk = values => values.reduce((result,value,index)=>{if(index%100===0)result.push([]);result.at(-1).push(value);return result},[])
  const styles = node => {
    const computed=getComputedStyle(node),keys=[...computed].sort(),result=[]
    for(let index=0;index<keys.length;index+=100)result.push(Object.fromEntries(keys.slice(index,index+100).map(key=>[key,computed.getPropertyValue(key)])))
    return result
  }
  const rows=nodes.map(node=>{const rect=node.getBoundingClientRect();return {tag:node.tagName,attributes:Object.fromEntries([...node.attributes].map(a=>[a.name,a.value]).sort()),style:styles(node),bounds:[rect.x,rect.y,rect.width,rect.height],value:'value' in node?node.value:null,children:[...node.childNodes].map(child=>child.nodeType===1?{element:nodes.indexOf(child)}:{type:child.nodeType,text:child.textContent}),focus:node===document.activeElement}})
  return {viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,nodes:chunk(rows)}
}

export async function captureFullStyles(tab, directory, item) {
  await tab.goto(`http://127.0.0.1:5178/legacy/${item.family}/?scene=${item.scene}&theme=${item.theme}&os=${item.os}`)
  await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({state:'attached'})
  await tab.getAXState({emit:false})
  await fs.writeFile(directory+'/'+item.id+'-supplemental-base.json',JSON.stringify(await tab.playwright.evaluate(fullSnapshot)))
  const state=await tab.playwright.evaluate(snapshot),name='paired-base-'+item.id
  await fs.writeFile(directory+'/'+name+'.json',JSON.stringify(state))
  await stableRaster(tab,directory,name)
  for(let repeat=1;repeat<=3;repeat++) {
    await fs.writeFile(directory+'/'+name+'-'+repeat+'.jpg',await tab.screenshot({fullPage:false}))
    if(JSON.stringify(await tab.playwright.evaluate(snapshot))!==JSON.stringify(state))throw Error('Paired base unstable '+item.id)
  }

}
export async function captureUnchangedBase(tab,viewport,directory,start,end) {
  for (const item of cases.slice(start,end)) {
    const wanted=item.size==='desktop'?[1440,900]:[390,844]
    if(JSON.stringify(await tab.playwright.evaluate(()=>[innerWidth,innerHeight]))!==JSON.stringify(wanted))await viewport.set(item.size==='desktop'?{width:1714,height:1071}:{width:464,height:1004})
    await tab.goto(`http://127.0.0.1:5178/legacy/${item.family}/?scene=${item.scene}&theme=${item.theme}&os=${item.os}`)
    await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({state:'attached'})
    await tab.getAXState({emit:false})
    const state=await tab.playwright.evaluate(snapshot),name='unchanged-base-'+item.id
    await tab.playwright.evaluate(fullSnapshot)
    await fs.writeFile(directory+'/'+name+'.json',JSON.stringify(state))
    await stableRaster(tab,directory,name)
    for(let repeat=1;repeat<=3;repeat++) {
      await fs.writeFile(directory+'/'+name+'-'+repeat+'.jpg',await tab.screenshot({fullPage:false}))
      if(JSON.stringify(await tab.playwright.evaluate(snapshot))!==JSON.stringify(state))throw Error('Unchanged base unstable '+item.id)
    }
  }
  return{start,end,cases:end-start}
}
