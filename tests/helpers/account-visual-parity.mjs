import {restoreUpdatesVisual} from './updates-visual-parity.mjs'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const contract=JSON.parse(fs.readFileSync(new URL('../fixtures/account-visual-contract.json',import.meta.url),'utf8'))
export function restoreAccountVisual(file,source){
 source=restoreUpdatesVisual(file,source).replaceAll('\r\n','\n')
 const digest=contract.files[file];if(!digest)return source
 const before=execFileSync('git',['show',`${contract.base}:${file}`],{encoding:'utf8'}).replaceAll('\r\n','\n')
 if(source===before)return source
 assert.equal(createHash('sha256').update(source).digest('hex'),digest,`Only exact Phase 10 presentation allowed: ${file}`)
 return before
}
