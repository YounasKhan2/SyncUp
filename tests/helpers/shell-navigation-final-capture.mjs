import fs from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {fullSnapshot} from './design-system-wiring-visual-capture.mjs'
import {stableRaster} from './spaces-visual-capture.mjs'
export const modes=[{theme:'light',os:'light'},{theme:'dark',os:'light'},{theme:'system',os:'light'},{theme:'system',os:'dark'}]
export const cases=['desktop','mobile'].flatMap(size=>modes.flatMap(mode=>['inbox','calls','unread','no-badge','account','focus','hover'].map(scene=>({size,...mode,scene,width:size==='desktop'?1440:390,height:size==='desktop'?900:844,id:`${size}-${mode.theme}-${mode.os}-${scene}`}))))
cases.push(...[320,699,700,701,768,1024,1099,1100,1101].flatMap(width=>modes.slice(0,2).map(mode=>({size:'boundary',...mode,scene:'inbox',width,height:900,id:`boundary-${width}-${mode.theme}`}))))
export const state=()=>({theme:document.documentElement.dataset.theme,appearance:document.documentElement.dataset.appearance,os:document.documentElement.dataset.visualOs,dark:document.documentElement.dataset.visualSystemDark,light:document.documentElement.dataset.visualSystemLight,colorScheme:document.documentElement.style.colorScheme,fonts:document.fonts.status,diagnostics:document.getElementById('final-validation-events').textContent,events:document.getElementById('fixture-events').textContent,scroll:[scrollX,scrollY,document.documentElement.scrollWidth],ownership:[document.documentElement,document.body,...document.querySelectorAll('#root,#root *')].map(node=>node.closest('.primary-rail,.mobile-bottom-nav')?'NAVIGATION_OWNED':node.matches('.workspace,.inbox-pane')?'SHELL_OWNED':'FEATURE_OWNED'),navigation:[...document.querySelectorAll('.primary-rail button,.mobile-bottom-nav button')].map(node=>{const rect=node.getBoundingClientRect(),css=getComputedStyle(node);return{text:node.textContent,label:node.getAttribute('aria-label'),current:node.getAttribute('aria-current'),visible:rect.width>0&&rect.height>0,bounds:[rect.x,rect.y,rect.width,rect.height],hover:node.matches(':hover'),focus:node.matches(':focus-visible'),background:css.backgroundColor,color:css.color,outline:css.outline,border:[css.borderLeft,css.borderTop],animation:css.animationName,transition:css.transitionDuration}}),regions:[...document.querySelectorAll('.primary-rail,.inbox-pane,.mobile-bottom-nav')].map(node=>({name:node.classList[0],bounds:node.getBoundingClientRect().toJSON()}))})
const directory=fileURLToPath(new URL('../../docs/design-system/evidence-06/captures',import.meta.url))
export async function capture(tab,viewport,start,end,sides=['base','head']){await fs.mkdir(directory,{recursive:true});for(const item of cases.slice(start,end)){
 const wanted=[item.width,item.height];if(JSON.stringify(await tab.playwright.evaluate(()=>[innerWidth,innerHeight]))!==JSON.stringify(wanted)){
  await viewport.set({width:Math.round(item.width*1.190000057220459),height:Math.round(item.height*1.190000057220459)})
  await tab.goto('http://127.0.0.1:5182/base/?scene=inbox&theme=light&os=light&preflight='+item.id);await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({state:'attached'});await tab.getAXState({emit:false});await stableRaster(tab,directory+'/preflight',item.id)
 }
 for(const side of sides){
  const scene=item.scene==='calls'?'calls':'inbox',badge=item.scene==='unread'?140:item.scene==='no-badge'?0:1
  await tab.goto(`http://127.0.0.1:5182/${side}/?scene=${scene}&theme=${item.theme}&os=${item.os}&badge=${badge}&case=${item.id}`)
  await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({state:'attached'});await tab.getAXState({emit:false})
  await tab.playwright.getByRole('heading',{name:scene==='calls'?'Calls':'Chats',exact:true}).click();await tab.getAXState({emit:false})
  const selector=item.width<=700?'.mobile-bottom-nav button':'.primary-rail button'
  if(item.scene==='focus'){await tab.playwright.locator(selector).nth(1).press('Shift+Tab');await tab.getAXState({emit:false})}
  if(item.scene==='hover'){await tab.playwright.locator(selector).nth(0).click();await tab.getAXState({emit:false})}
  if(item.scene==='account'){await tab.playwright.locator(selector).nth(4).click();await tab.getAXState({emit:false});await tab.playwright.getByRole('heading',{name:'Profile & settings',exact:true}).waitFor({state:'visible'})}
  await stableRaster(tab,directory,side+'-'+item.id)
  const snapshot=await tab.playwright.evaluate(fullSnapshot),setup=await tab.playwright.evaluate(state)
  if(JSON.stringify(snapshot.viewport)!==JSON.stringify(wanted)||snapshot.dpr!==1.190000057220459||setup.theme!==(item.theme==='system'?item.os:item.theme)||setup.appearance!==item.theme||setup.os!==item.os||setup.dark!==String(item.os==='dark')||setup.light!==String(item.os==='light')||setup.colorScheme!==setup.theme||setup.fonts!=='loaded'||setup.diagnostics!=='[]')throw Error('Invalid setup '+side+'-'+item.id+JSON.stringify(setup))
  const visible=setup.navigation.filter(n=>n.visible);if(visible.length!==5)throw Error('Visibility contract '+item.id)
  if(side==='head'&&item.width<=700&&new Set(visible.map(n=>n.bounds[0])).size!==5)throw Error('Overlapping mobile destinations '+item.id)
  if(side==='head'&&visible.some(n=>n.bounds[2]<44||n.bounds[3]<44))throw Error('Small target '+item.id)
  if(item.scene==='focus'&&!visible[0].focus)throw Error('Missing native focus '+item.id)
  if(item.scene==='hover'&&!visible[0].hover)throw Error('Missing pointer hover '+item.id)
  await fs.writeFile(`${directory}/${side}-${item.id}.json`,JSON.stringify({setup,...snapshot}))
  for(let repeat=1;repeat<=3;repeat++)await fs.writeFile(`${directory}/${side}-${item.id}-${repeat}.jpg`,await tab.screenshot({fullPage:false}))
  if(JSON.stringify(await tab.playwright.evaluate(fullSnapshot))!==JSON.stringify(snapshot))throw Error('Unsettled DOM '+item.id)
 }
 }return{start,end,cases:end-start}}
