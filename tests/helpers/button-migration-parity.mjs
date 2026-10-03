import fs from 'node:fs'
import assert from 'node:assert/strict'
const baseline = JSON.parse(fs.readFileSync(new URL('../fixtures/button-migration-baseline.json', import.meta.url), 'utf8'))
export function restoreButtonMigration(file, source) {
  const record = baseline.files[file]
  if (!record || source === record.before) return source
  assert.equal(source, record.after, `Only the exact characterized Phase 03 migration is allowed: ${file}`)
  return record.before
}
