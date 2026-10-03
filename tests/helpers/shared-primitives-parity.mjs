import fs from 'node:fs'
import assert from 'node:assert/strict'
const fixture=JSON.parse(fs.readFileSync(new URL('../fixtures/shared-primitives-baseline.json',import.meta.url),'utf8'))
export function restoreSharedPrimitives(file,source){const record=fixture.files[file];if(!record||source===record.before)return source;assert.equal(source,record.after,`Only exact Phase 05 Dialog migration allowed: ${file}`);return record.before}
