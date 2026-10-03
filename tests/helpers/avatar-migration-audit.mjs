import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import postcss from 'postcss'
import { execFileSync } from 'node:child_process'
const base='aabff6a4e15cfa73c33fd30287e1771914c3c60f', output='docs/design-system/evidence-04'
fs.mkdirSync(output,{recursive:true})
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name).replaceAll('\\','/')])
const consumers=[], overrides=[]
for(const file of walk('client/src').filter(file=>file.endsWith('.tsx'))) {
  const tree=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),99,true,ts.ScriptKind.TSX)
  function visit(node) {
    if((ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node))&&node.tagName.getText(tree)==='Avatar')consumers.push({file,line:tree.getLineAndCharacterOfPosition(node.getStart(tree)).line+1,jsx:node.getText(tree),props:node.attributes.properties.map(prop=>prop.getText(tree))})
    ts.forEachChild(node,visit)
  }
  visit(tree)
}
for(const file of walk('client/src').filter(file=>file.endsWith('.css'))) {
  postcss.parse(fs.readFileSync(file,'utf8')).walkRules(rule=>{
    if(/avatar/i.test(rule.selector))overrides.push({file,selector:rule.selector,nesting:rule.parent.type==='atrule'?rule.parent.name+' '+rule.parent.params:null,declarations:rule.nodes.filter(node=>node.type==='decl').map(node=>({property:node.prop,value:node.value})),owner:['.avatar','.avatar > img','.avatar-has-image > span'].includes(rule.selector)?'primitive':'contextual/consumer (unchanged)'})
  })
}
const ownership={}
for(const [side,input] of [['before',execFileSync('git',['show',base+':client/src/shared/styles/platform.css'],{encoding:'utf8'})],['after',fs.readFileSync('client/src/shared/styles/platform.css','utf8')]]) {
  const rules=[];postcss.parse(input).walkRules(rule=>{if(['.avatar','.avatar > img','.avatar-has-image > span'].includes(rule.selector))rules.push({selector:rule.selector,declarations:rule.nodes.filter(node=>node.type==='decl').map(node=>({property:node.prop,value:node.value}))})})
  ownership[side]={selectors:rules.length,declarations:rules.reduce((sum,rule)=>sum+rule.declarations.length,0),rules}
}
const css=fs.readdirSync('client/dist/assets').filter(file=>file.endsWith('.css')).map(file=>fs.readFileSync('client/dist/assets/'+file,'utf8')).join('\n'), classes=['ui:relative','ui:grid','ui:place-items-center','ui:overflow-hidden']
for(const name of classes)if(!css.includes('.'+name.replaceAll(':','\\:')))throw Error('Missing production class '+name)
fs.writeFileSync(output+'/consumer-overrides.json',JSON.stringify({base,consumerCount:consumers.length,consumerFiles:new Set(consumers.map(row=>row.file)).size,consumers,overrides},null,2)+'\n')
fs.writeFileSync(output+'/css-ownership.json',JSON.stringify(ownership,null,2)+'\n')
fs.writeFileSync(output+'/production-utilities.json',JSON.stringify({classes,allEmitted:true},null,2)+'\n')
console.log(JSON.stringify({consumerCount:consumers.length,files:new Set(consumers.map(row=>row.file)).size,before:ownership.before.declarations,after:ownership.after.declarations}))
