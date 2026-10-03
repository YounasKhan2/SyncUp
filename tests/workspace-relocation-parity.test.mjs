import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import ts from 'typescript'

const baseline = JSON.parse(fs.readFileSync(new URL('./fixtures/workspace-presentation-baseline.json', import.meta.url)))
const root = new URL('../', import.meta.url)
const oldTargets = new Map(Object.entries(baseline.files).map(([old, value]) => [value.relocatedPath.replace(/\.tsx?$/u, ''), old.replace(/\.tsx?$/u, '')]))

test('Workspace relocation preserves complete source and dependency identity, including root effects, JSX, props, handlers, types and hook transitions', () => {
  for (const [oldPath, { relocatedPath, canonicalDigest }] of Object.entries(baseline.files)) {
    const currentPath = fs.existsSync(new URL(relocatedPath, root)) ? relocatedPath : oldPath
    const text = fs.readFileSync(new URL(currentPath, root), 'utf8').replace(/\r\n/gu, '\n')
    const tree = ts.createSourceFile(currentPath, text, ts.ScriptTarget.Latest, true)
    const edits = tree.statements.filter(ts.isImportDeclaration).map(n => n.moduleSpecifier).filter(n => n.text.startsWith('.')).map(n => {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(currentPath), n.text))
      return [n.getStart(tree) + 1, n.end - 1, oldTargets.get(target) ?? target]
    })
    const canonical = edits.sort((a, b) => b[0] - a[0]).reduce((value, [start, end, target]) => value.slice(0, start) + target + value.slice(end), text)
    assert.equal(createHash('sha256').update(canonical).digest('hex'), canonicalDigest, currentPath)
    if (currentPath !== oldPath) assert.equal(fs.existsSync(new URL(oldPath, root)), false, `no compatibility copy: ${oldPath}`)
  }
})
