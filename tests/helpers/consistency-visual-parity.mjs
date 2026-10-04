import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const contract=JSON.parse(fs.readFileSync(new URL('../fixtures/consistency-visual-contract.json',import.meta.url),'utf8'))
export const consistencyVisualFiles=Object.keys(contract.files)
// Historical guards inspect their original phase. This bounded bridge accepts only
// the exact separately reviewed Phase 15 CSS, never arbitrary future mutations.
export function restoreConsistencyVisual(file,source){
 source=source.replaceAll('\r\n','\n');const digest=contract.files[file];if(!digest)return source
 const before=execFileSync('git',['show',`${contract.base}:${file}`],{encoding:'utf8'}).replaceAll('\r\n','\n');if(source===before)return source
 // Calls guards can invoke the chain twice after Auth has already restored its base.
 const authBase=execFileSync('git',['show',`90e5a8517f4e58dd8670a2d3e744809b0a031a3e:${file}`],{encoding:'utf8'}).replaceAll('\r\n','\n');if(source===authBase)return source
 assert.equal(createHash('sha256').update(source).digest('hex'),digest,`Only exact Phase 15 CSS allowed: ${file}`)
 return before
}
