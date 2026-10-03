import fs from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
const directory=fileURLToPath(new URL('../../docs/design-system/evidence-06/captures',import.meta.url))

export async function interactions(tab,viewport,size,theme){
 const traces=[],selector=size==='desktop'?'.primary-rail button':'.mobile-bottom-nav button'
 await viewport.set(size==='desktop'?{width:1714,height:1071}:{width:464,height:1004})
 for(const side of ['base','head']){
  const steps=[]
  await tab.goto(`http://127.0.0.1:5182/${side}/?scene=inbox&theme=${theme}&os=light&keyboard=true`);await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({state:'attached'});await tab.getAXState({emit:false})
  const observe=async step=>{await tab.getAXState({emit:false});steps.push({step,state:await tab.playwright.evaluate(()=>({navigation:JSON.parse(document.querySelector('output[aria-label="Fixture state"]').textContent),selected:[...document.querySelectorAll('.primary-rail button,.mobile-bottom-nav button')].filter(n=>n.getBoundingClientRect().width>0&&n.getAttribute('aria-current')==='page').map(n=>n.textContent),focus:{tag:document.activeElement.tagName,id:document.activeElement.id,label:document.activeElement.getAttribute('aria-label'),text:document.activeElement.tagName==='BUTTON'?document.activeElement.textContent:null,visible:document.activeElement.matches(':focus-visible')},dialogs:document.querySelectorAll('[role="dialog"]').length,hash:location.hash,diagnostics:document.getElementById('final-validation-events').textContent,motion:[...document.querySelectorAll('.primary-rail button,.mobile-bottom-nav button')].map(n=>({transition:getComputedStyle(n).transitionDuration,animation:getComputedStyle(n).animationName}))}))})}
  await tab.playwright.getByRole('link',{name:'Skip to main content',exact:true}).press('Enter');await observe('skip-Enter')
  await tab.playwright.locator('#workspace-main').press('Tab');await observe('main-Tab')
  for(const[index,key,name]of [[0,'Enter','chats'],[1,'Space','calls'],[2,'Enter','updates'],[3,'Space','spaces'],[0,'Enter','chats-return']]){await tab.playwright.locator(selector).nth(index).press(key);await observe(name+'-'+key)}
  await tab.playwright.locator(selector).nth(0).press('Tab');await observe('nav-Tab');await tab.playwright.locator(':focus').press('Shift+Tab');await observe('nav-Shift+Tab')
  await tab.playwright.locator(selector).nth(4).press('Enter');await tab.playwright.getByRole('heading',{name:'Profile & settings',exact:true}).waitFor({state:'visible'});await observe('profile-Enter')
  const close=tab.playwright.getByRole('button',{name:'Close profile',exact:true});await close.press('Escape');await observe('profile-Escape-existing-contract');await close.press('Enter');await observe('profile-close-Enter')
  traces.push({side,size,theme,steps})
 }
 if(JSON.stringify(traces[0].steps)!==JSON.stringify(traces[1].steps))throw Error('Keyboard regression '+size+' '+theme)
 await fs.writeFile(`${directory}/${size}-${theme}-interactions.json`,JSON.stringify(traces));return{size,theme,exactStepPairs:traces[0].steps.length}
}
