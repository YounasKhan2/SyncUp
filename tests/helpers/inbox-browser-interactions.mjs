import fs from 'node:fs/promises'
import {directory} from './inbox-browser-capture.mjs'
export async function interactions(tab,viewport,size,theme,sides=['base','head']){
 await fs.mkdir(directory,{recursive:true});await viewport.set(size==='desktop'?{width:1714,height:1071}:{width:464,height:1004})
 const traces=[]
 for(const side of sides){
  await tab.goto(`http://127.0.0.1:5183/${side}/?scene=normal&theme=${theme}&os=light&keyboard=${size}`);await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({state:'attached'});await tab.getAXState({emit:false})
  const steps=[];const observe=async step=>{await tab.getAXState({emit:false});steps.push({step,state:await tab.playwright.evaluate(()=>({fixture:document.querySelector('output[aria-label="Fixture state"]').textContent,focus:{tag:document.activeElement.tagName,label:document.activeElement.getAttribute('aria-label'),text:document.activeElement.tagName==='BUTTON'?document.activeElement.textContent:null,visible:document.activeElement.matches(':focus-visible')},rows:[...document.querySelectorAll('.chat-list-item')].map(n=>({text:n.textContent,selected:n.classList.contains('selected')})),inboxVisible:document.querySelector('.inbox-pane').getBoundingClientRect().width>0,dialog:document.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')??null,query:document.querySelector('.global-search-input input')?.value??null,events:document.getElementById('fixture-events').textContent,diagnostics:document.getElementById('final-validation-events').textContent}))})}
  await tab.playwright.locator('.chat-list-item').nth(1).press('Shift+Tab');await observe('row-focus')
  await tab.playwright.locator('.chat-list-item').nth(0).press('Enter');await observe('row-Enter')
  if(size==='mobile'){await tab.playwright.getByRole('button',{name:'Back to chat list',exact:true}).press('Enter');await observe('back-Enter')}else{await tab.playwright.locator('.primary-rail button').nth(0).press('Enter');await observe('desktop-retains-selected-chat')}
  await tab.playwright.locator('.chat-list-item').nth(1).press('Space');await observe('row-Space')
  if(size==='mobile')await tab.playwright.getByRole('button',{name:'Back to chat list',exact:true}).press('Space');await observe('return-list-contract')
  await tab.playwright.getByRole('button',{name:'Unread',exact:true}).press('Enter');await observe('unread-filter')
  await tab.playwright.getByRole('button',{name:'All',exact:true}).press('Space');await observe('all-filter')
  await tab.playwright.locator('.inbox-filters button').nth(2).press('Enter');await observe('requests-filter')
  await tab.playwright.locator('.request-list-inline button').press('Space');await observe('request-action')
  await tab.playwright.getByRole('button',{name:'All',exact:true}).press('Enter');await observe('requests-return')
  await tab.playwright.getByRole('button',{name:'New conversation',exact:true}).press('Space');await observe('new-chat-action')
  await tab.playwright.locator('.search-box').press('Enter');await observe('search-open')
  const input=tab.playwright.getByRole('textbox',{name:'Search people, chats, and loaded messages',exact:true});await input.fill('tomorrow');await tab.getAXState({emit:false});await tab.playwright.locator('.search-result:not(.search-message-result)').waitFor({state:'visible'});await observe('search-populated')
  await input.fill('');await observe('search-clear')
  await input.press('Escape');await observe('search-Escape')
  await tab.playwright.getByRole('button',{name:'New conversation',exact:true}).press('Tab');await observe('action-to-search-Tab')
  traces.push({side,size,theme,steps});await fs.writeFile(`${directory}/${size}-${theme}-${side}-trace.json`,JSON.stringify({side,size,theme,steps}))
 }
 const pair=[];for(const side of ['base','head']){try{pair.push(JSON.parse(await fs.readFile(`${directory}/${size}-${theme}-${side}-trace.json`,'utf8')))}catch{}}
 if(pair.length===2){if(JSON.stringify(pair[0].steps)!==JSON.stringify(pair[1].steps))throw Error('Inbox interaction regression '+size+' '+theme);await fs.writeFile(`${directory}/${size}-${theme}-interactions.json`,JSON.stringify(pair))}
 return{size,theme,sides,exactStepPairs:pair.length===2?pair[0].steps.length:0}
}
