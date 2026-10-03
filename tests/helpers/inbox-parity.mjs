import fs from 'node:fs'
import assert from 'node:assert/strict'
const fixture=JSON.parse(fs.readFileSync(new URL('../fixtures/inbox-baseline.json',import.meta.url),'utf8'))
// Historical guards admit only the exact Phase 07 presentation independently
// checked by inbox-presentation/behavior tests, never a general scope exception.
export function restoreInbox(file,source){source=source.replaceAll('\r\n','\n');const record=fixture.files[file];if(!record||source===record.before)return source;assert.equal(source,record.after,`Only exact Phase 07 Inbox presentation allowed: ${file}`);return record.before}
