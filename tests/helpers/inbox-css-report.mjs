import fs from 'node:fs'
import postcss from 'postcss'
import {inventory,exclusive,productionFiles} from './inbox-audit.mjs'
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/inbox-baseline.json','utf8')),counts={}
for(const side of ['before','after']){const source=fixture.files[productionFiles[2]][side];let selectors=0,sites=0;postcss.parse(source).walkRules(rule=>{const relevant=rule.selectors.filter(s=>side==='before'?(exclusive.test(s)||/\.(?:chat-list|list-empty|empty-symbol|empty-title|empty-copy|list-section-label|list-error)(?=[\s.:>#,\[]|$)/.test(s)&&!s.includes('empty-request')):exclusive.test(s)||/^\.inbox-(?:action|error|empty-action|content|chat-list|empty-copy)/.test(s));selectors+=relevant.length;if(relevant.length)sites+=rule.nodes.filter(n=>n.type==='decl').length});counts[side]={lines:source.trimEnd().split('\n').length,inboxSelectorBranches:selectors,inboxDeclarationSites:sites}}
fs.writeFileSync('docs/design-system/evidence-07/css-ownership.json',JSON.stringify({counts,method:'Before counts include shared selector branches applying to Inbox instances. After excludes retained :not contracts belonging to Calls/RequestsPanel. Each rule is one declaration site even when several owned branches share it.',after:inventory(fixture.files[productionFiles[2]].after)},null,2)+'\n')
console.log(JSON.stringify(counts))
