import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {restoreCallsVisual} from './calls-visual-parity.mjs'
const contract=JSON.parse(fs.readFileSync(new URL('../fixtures/spaces-modern-visual-contract.json',import.meta.url),'utf8'))
export function restoreSpacesModernVisual(file,source){
 source=restoreCallsVisual(file,source);const digest=contract.files[file];if(!digest)return source
 const before=execFileSync('git',['show',`${contract.base}:${file}`],{encoding:'utf8'}).replaceAll('\r\n','\n');if(source===before)return source
 assert.equal(createHash('sha256').update(source).digest('hex'),digest,`Only exact Phase 12 CSS allowed: ${file}`)
 return before
}
