import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import ts from 'typescript'

export const root = new URL('../../', import.meta.url)
export const read = file => fs.readFileSync(new URL(file, root), 'utf8').replace(/\r\n/gu, '\n')
export const hash = text => createHash('sha256').update(text).digest('hex')
export const parse = (file, text = read(file)) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
export function searchRegion(tree) {
  let region
  function visit(node) {
    if (ts.isJsxExpression(node) && node.expression && ts.isBinaryExpression(node.expression)
      && node.expression.left.getText(tree) === 'messageSearchOpen') region = node
    ts.forEachChild(node, visit)
  }
  visit(tree)
  if (!region) throw new Error('Conversation search conditional missing')
  return region
}
export function canonical(file, text, files) {
  const tree = parse(file, text)
  const targets = new Map(Object.entries(files).map(([old, value]) => [value.relocatedPath.replace(/\.tsx?$/u, ''), old.replace(/\.tsx?$/u, '')]))
  const edits = []
  for (const node of tree.statements.filter(ts.isImportDeclaration)) {
    const specifier = node.moduleSpecifier
    if (file.endsWith('/Conversation.tsx') && (specifier.text === 'lucide-react' || specifier.text.endsWith('/ConversationSearchBar'))) {
      // Only the original Search/X icons or their exact replacement may be omitted.
      const bindings = node.importClause?.namedBindings?.elements?.map(n => n.getText(tree))
      const expected = specifier.text === 'lucide-react' ? ['Search', 'X'] : ['ConversationSearchBar']
      if (JSON.stringify(bindings) !== JSON.stringify(expected)) throw new Error('Unexpected search import contract')
      let end = node.end
      if (text[end] === '\n') end++
      edits.push([node.getStart(tree), end, ''])
    } else if (specifier.text.startsWith('.')) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier.text))
      edits.push([specifier.getStart(tree) + 1, specifier.end - 1, targets.get(target) ?? target])
    }
  }
  if (file.endsWith('/Conversation.tsx')) {
    const node = searchRegion(tree)
    edits.push([node.getStart(tree), node.end, '{APPROVED_SEARCH_PRESENTATION_REGION}'])
  }
  return edits.sort((a, b) => b[0] - a[0]).reduce((value, [start, end, replacement]) => value.slice(0, start) + replacement + value.slice(end), text)
}
