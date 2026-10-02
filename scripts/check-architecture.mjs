import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const slash = (value) => value.split(path.sep).join('/')
function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    return entry.isDirectory() ? sources(full) : /\.[cm]?tsx?$/.test(entry.name) ? [full] : []
  }).sort()
}
const violations = []
const debt = new Set()
let edges = 0
for (const [directory, config] of [['client/src', 'client/tsconfig.app.json'], ['server', 'tsconfig.server.json']]) {
  const configPath = path.join(root, config)
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile)
  if (loaded.error) throw new Error(ts.flattenDiagnosticMessageText(loaded.error.messageText, '\n'))
  const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, path.dirname(configPath))
  if (parsed.errors.length) throw new Error(parsed.errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'))
  for (const file of sources(path.join(root, directory))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const origin = slash(path.relative(root, file))
    function visit(node) {
      let specifier
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier
      else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || ts.isIdentifier(node.expression) && node.expression.text === 'require')) specifier = node.arguments[0]
      else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) specifier = node.argument.literal
      if (specifier && ts.isStringLiteralLike(specifier)) {
        const resolved = ts.resolveModuleName(specifier.text, file, parsed.options, ts.sys).resolvedModule
        const featureApi = /^client\/src\/features\/[^/]+\/api\.ts$/.test(origin)
        if (featureApi && /^(?:react|react-dom)(?:\/|$)/.test(specifier.text)) {
          violations.push(`feature API must not import React: ${origin} -> ${specifier.text}`)
        }
        if (resolved && !resolved.isExternalLibraryImport) {
          edges += 1
          const target = slash(path.relative(root, resolved.resolvedFileName))
          if (/(?:^|\/)shared\//.test(origin) && /(?:^|\/)features\//.test(target)) {
            violations.push(`${origin} -> ${target}`)
          }
          const fromFeature = origin.match(/^client\/src\/features\/([^/]+)\//)?.[1]
          const toFeature = target.match(/^client\/src\/features\/([^/]+)\//)?.[1]
          if (/^client\/src\/features\/[^/]+\/api\.ts$/.test(target) && fromFeature !== toFeature) {
            violations.push(`private feature API must stay within its owner: ${origin} -> ${target}`)
          }
          if (featureApi && /\.tsx$/.test(target)) {
            violations.push(`feature API must not import UI components: ${origin} -> ${target}`)
          }
          if (fromFeature && toFeature && fromFeature !== toFeature && fromFeature !== 'workspace') {
            debt.add(`${origin} -> ${target}`)
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
}
console.info(`Checked ${edges} resolved internal import/export edges (including literal dynamic imports and type imports).`)
console.info('Known cross-feature dependencies (informational; no public-API allowlist yet):')
for (const edge of [...debt].sort()) console.info(`  ${edge}`)
console.info('Workspace composition is excluded from the debt listing, not from shared dependency enforcement.')
if (violations.length) {
  console.error('FAIL: architecture boundary violations:\n' + violations.join('\n'))
  process.exitCode = 1
} else console.info('PASS: no shared -> features dependencies; private feature APIs stay within their owner and do not import React/UI.')
