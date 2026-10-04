import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const contract=JSON.parse(fs.readFileSync(new URL('../fixtures/conversation-visual-contract.json',import.meta.url),'utf8'))
export function restoreConversationVisual(file,source){
 source=source.replaceAll('\r\n','\n')
 const digest=contract.files[file];if(!digest)return source
 const before=execFileSync('git',['show',`${contract.base}:${file}`],{encoding:'utf8'}).replaceAll('\r\n','\n')
 if(source===before)return source
 assert.equal(createHash('sha256').update(source).digest('hex'),digest,`Only exact Phase 08 presentation allowed: ${file}`)
 return before
}
