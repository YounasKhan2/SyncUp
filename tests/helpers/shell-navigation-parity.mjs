import fs from 'node:fs'
import assert from 'node:assert/strict'
const fixture=JSON.parse(fs.readFileSync(new URL('../fixtures/shell-navigation-baseline.json',import.meta.url),'utf8'))
// Historical phase guards accept only this exact, independently tested redesign.
export function restoreShellNavigation(file,source){const record=fixture.files[file];if(!record||source===record.before)return source;assert.equal(source,record.after,`Only exact Phase 06 shell presentation allowed: ${file}`);return record.before}
