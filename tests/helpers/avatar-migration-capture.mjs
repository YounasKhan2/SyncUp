import fs from 'node:fs/promises'
import { fullSnapshot } from './design-system-wiring-visual-capture.mjs'
import { stableRaster } from './spaces-visual-capture.mjs'
const scenes = [['workspace','inbox'],['workspace','history'],['workspace','direct'],['conversation','conversation'],['conversation','welcome'],['conversation','details'],['conversation','group-details'],['custom','profile'],['custom','voice'],['custom','requests'],['custom','search'],['custom','probe']]
export const cases = ['desktop', 'mobile'].flatMap(size => [{ theme:'light',os:'light' },{ theme:'dark',os:'light' },{ theme:'system',os:'light' },{ theme:'system',os:'dark' }].flatMap(mode => scenes.map(([family,scene]) => ({ size,...mode,family,scene,id:`${size}-${mode.theme}-${mode.os}-${family}-${scene}` }))))
export const observeImages = () => [...document.querySelectorAll('.avatar')].map(node => {
  const image=node.querySelector('img'), fallback=node.lastElementChild
  return { className:node.className,label:node.getAttribute('aria-label'),fallback:fallback.textContent,fallbackVisibility:getComputedStyle(fallback).visibility,img:image?{src:image.getAttribute('src'),complete:image.complete,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,display:getComputedStyle(image).display,objectFit:getComputedStyle(image).objectFit}:null }
})
export async function capture(tab,viewport,directory,start,end) {
  await fs.mkdir(directory,{recursive:true})
  for (const item of cases.slice(start,end)) {
    const wanted=item.size==='desktop'?[1440,900]:[390,844]
    if(JSON.stringify(await tab.playwright.evaluate(()=>[innerWidth,innerHeight]))!==JSON.stringify(wanted))await viewport.set(item.size==='desktop'?{width:1714,height:1071}:{width:464,height:1004})
    for(const side of ['base','head']) {
      await tab.goto(`http://127.0.0.1:5180/${side}/${item.family}/?scene=${item.scene}&theme=${item.theme}&os=${item.os}`)
      await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({state:'attached'})
      await tab.getAXState({emit:false})
      if(item.scene==='search') {
        await fs.mkdir(`${directory}/focused-search`,{recursive:true})
        await fs.writeFile(`${directory}/focused-search/${side}-${item.id}.json`,JSON.stringify(await tab.playwright.evaluate(fullSnapshot)))
        // Real pointer blur on both builds removes the native blinking caret.
        // Preserve automatic-focus observations separately; no CSS masks or edits.
        await tab.playwright.getByRole('heading',{name:'Search SyncUp',exact:true}).click()
        await tab.getAXState({emit:false})
      }
      const setup=await tab.playwright.evaluate(()=>({theme:document.documentElement.dataset.theme,appearance:document.documentElement.dataset.appearance,os:document.documentElement.dataset.visualOs,dark:document.documentElement.dataset.visualSystemDark,light:document.documentElement.dataset.visualSystemLight,colorScheme:document.documentElement.style.colorScheme,fonts:document.fonts.status,diagnostics:document.querySelector('#final-validation-events')?.textContent}))
      if(setup.theme!==(item.theme==='system'?item.os:item.theme)||setup.appearance!==item.theme||setup.os!==item.os||setup.dark!==String(item.os==='dark')||setup.light!==String(item.os==='light')||setup.colorScheme!==setup.theme||setup.fonts!=='loaded'||setup.diagnostics!=='[]')throw Error('Invalid setup '+item.id+' '+JSON.stringify(setup))
      await stableRaster(tab,directory,`${side}-${item.id}`)
      const images=await tab.playwright.evaluate(observeImages)
      if(!images.length||images.some(row=>row.img&&(!row.img.complete||(row.img.src==='/broken-avatar'&&(row.img.naturalWidth!==0||row.img.display!=='none'||row.className.includes('avatar-has-image')||row.fallbackVisibility!=='visible')))))throw Error('Unsettled Avatar '+item.id)
      const state=await tab.playwright.evaluate(fullSnapshot)
      if(JSON.stringify(state.viewport)!==JSON.stringify(wanted)||state.dpr!==1.190000057220459)throw Error('Invalid viewport '+item.id)
      await fs.writeFile(`${directory}/${side}-${item.id}.json`,JSON.stringify({setup,images,...state}))
      for(let repeat=1;repeat<=3;repeat++)await fs.writeFile(`${directory}/${side}-${item.id}-${repeat}.jpg`,await tab.screenshot({fullPage:false}))
      if(JSON.stringify(await tab.playwright.evaluate(fullSnapshot))!==JSON.stringify(state))throw Error('Unstable DOM '+item.id)
    }
  }
  return {start,end,cases:end-start}
}
export async function imageTrace(tab,directory,side) {
  await tab.goto(`http://127.0.0.1:5180/${side}/custom/?scene=probe&theme=light&os=light`)
  await tab.getAXState({emit:false})
  const steps=[{step:'initial',state:await tab.playwright.evaluate(observeImages)}]
  for(const name of ['Same props rerender','Change name','Change class','Valid source','Missing source','Broken source']) {
    await tab.playwright.getByRole('button',{name,exact:true}).click()
    await tab.getAXState({emit:false})
    steps.push({step:name,state:await tab.playwright.evaluate(observeImages)})
  }
  await fs.writeFile(`${directory}/${side}-image-trace.json`,JSON.stringify(steps,null,2))
  return steps.map(row=>({step:row.step,changing:row.state.at(-1)}))
}
