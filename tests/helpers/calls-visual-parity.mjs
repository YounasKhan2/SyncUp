import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {restoreAuthVisual} from './auth-visual-parity.mjs'
const contract=JSON.parse(fs.readFileSync(new URL('../fixtures/calls-visual-contract.json',import.meta.url),'utf8'))
export function restoreCallsVisual(file,source){
 source=restoreAuthVisual(file,source);const digest=contract.files[file];if(!digest)return source
 const before=execFileSync('git',['show',`${contract.base}:${file}`],{encoding:'utf8'}).replaceAll('\r\n','\n');if(source===before)return source
 assert.equal(createHash('sha256').update(source).digest('hex'),digest,`Only exact Phase 13 CSS allowed: ${file}`)
 return before
}
