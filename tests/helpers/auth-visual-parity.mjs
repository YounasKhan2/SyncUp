import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {restoreConsistencyVisual,consistencyVisualFiles} from './consistency-visual-parity.mjs'
const contract=JSON.parse(fs.readFileSync(new URL('../fixtures/auth-visual-contract.json',import.meta.url),'utf8'))
export const authVisualFiles=[...new Set([...Object.keys(contract.files),...consistencyVisualFiles])]
export function restoreAuthVisual(file,source){
 source=restoreConsistencyVisual(file,source);const digest=contract.files[file];if(!digest)return source
 const before=execFileSync('git',['show',`${contract.base}:${file}`],{encoding:'utf8'}).replaceAll('\r\n','\n');if(source===before)return source
 assert.equal(createHash('sha256').update(source).digest('hex'),digest,`Only exact Phase 14 CSS allowed: ${file}`)
 return before
}
