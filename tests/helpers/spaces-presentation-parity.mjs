import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import { restoreSpacesDialogs } from './spaces-dialog-parity.mjs'

export const root = new URL('../../', import.meta.url)
export const read = file => fs.readFileSync(new URL(file, root), 'utf8').replace(/\r\n/gu, '\n')
export const hash = text => createHash('sha256').update(text).digest('hex')
export const parse = (file, text = read(file)) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
export function headerRegion(tree) {
  let result
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === 'header'
      && node.openingElement.attributes.properties.some(a => a.name?.getText(tree) === 'className' && a.initializer?.text === 'space-channel-header')) result = node
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === 'SpaceChannelHeader') result = node
    ts.forEachChild(node, visit)
  }
  visit(tree)
  if (!result) throw new Error('Channel header missing')
  return result
}
export function canonical(file, text, files) {
  if (file.endsWith('/SpacesPage.tsx')) text = restoreSpacesDialogs(text)
  const tree = parse(file, text), edits = []
  const targets = new Map(Object.entries(files).map(([old, value]) => [value.relocatedPath.replace(/\.tsx?$/u, ''), old.replace(/\.tsx?$/u, '')]))
  for (const node of tree.statements.filter(ts.isImportDeclaration)) {
    const specifier = node.moduleSpecifier
    if (file.endsWith('/SpacesPage.tsx') && specifier.text === './components/SpaceChannelHeader') {
      if (node.getText(tree) !== "import { SpaceChannelHeader } from './components/SpaceChannelHeader'") throw new Error('Unexpected header import')
      edits.push([node.getStart(tree), node.end + (text[node.end] === '\n' ? 1 : 0), ''])
    } else if (file.endsWith('/SpacesPage.tsx') && specifier.text === 'lucide-react') {
      // Mic's only original use belongs to the approved header region.
      const original = node.getText(tree)
      edits.push([node.getStart(tree), node.end, original.replace(', Mic,', ',')])
    } else if (specifier.text.startsWith('.')) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier.text))
      edits.push([specifier.getStart(tree) + 1, specifier.end - 1, targets.get(target) ?? target])
    }
  }
  if (file.endsWith('/SpacesPage.tsx')) {
    const region = headerRegion(tree)
    edits.push([region.getStart(tree), region.end, 'APPROVED_CHANNEL_HEADER'])
  }
  return edits.sort((a, b) => b[0] - a[0]).reduce((value, [start, end, replacement]) => value.slice(0, start) + replacement + value.slice(end), text)
}
