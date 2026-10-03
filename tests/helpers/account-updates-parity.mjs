import fs from 'node:fs'
import { createHash } from 'node:crypto'
const root = new URL('../../', import.meta.url)
export const read = path => fs.readFileSync(new URL(path, root), 'utf8').replace(/\r\n/g, '\n')
export const baseline = () => JSON.parse(read('tests/fixtures/account-updates-baseline.json'))
export const hash = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex')
export function restoreAccountUpdates(path, text) {
  text = text.replace(/\r\n/g, '\n')
  const original = baseline().files[path]
  if (!original) return text
  for (const region of original.extractions) {
    if (!fs.existsSync(new URL(region.file, root))) continue
    if (hash(read(region.file)) !== region.componentDigest) throw new Error(`Unexpected child source: ${region.file}`)
    if (!text.includes(region.replacement) || !text.includes(region.import)) throw new Error(`Missing approved region: ${path}`)
    text = text.replace(region.replacement, region.original).replace(region.import + '\n', region.originalImport ? region.originalImport + '\n' : '')
  }
  for (const region of original.importReplacements ?? []) {
    if (!text.includes(region.replacement)) throw new Error('Missing approved import: ' + path)
    text = text.replace(region.replacement, region.original)
  }
  return text
}
