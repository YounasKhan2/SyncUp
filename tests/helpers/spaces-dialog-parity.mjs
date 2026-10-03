import fs from 'node:fs'
import { createHash } from 'node:crypto'

const root = new URL('../../', import.meta.url)
export const dialogBaseline = () => JSON.parse(fs.readFileSync(new URL('tests/fixtures/spaces-dialog-baseline.json', root), 'utf8'))
export const digest = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex')
// Reverse only explicitly frozen JSX replacements/imports. Every byte outside
// them, and every extracted child's source, remains subject to original hashes.
export function restoreSpacesDialogs(text) {
  text = text.replace(/\r\n/g, '\n')
  for (const region of dialogBaseline().extractions) {
    const file = new URL(region.file, root)
    if (!fs.existsSync(file)) continue
    if (digest(fs.readFileSync(file, 'utf8')) !== region.componentDigest) throw new Error(`Dialog source differs: ${region.file}`)
    if (!text.includes(region.replacement) || !text.includes(region.import)) throw new Error(`Approved dialog boundary missing: ${region.name}`)
    text = text.replace(region.replacement, region.original).replace(region.import + '\n', '')
  }
  return text
}
