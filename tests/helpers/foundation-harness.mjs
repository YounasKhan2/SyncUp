import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

export const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

// Execute production bodies with explicit boundaries; never load a real DB, network, or worker.
export function load(path, mocks = {}, globals = {}, expression) {
  const input = expression ?? source(path)
  const output = ts.transpileModule(input, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  }, fileName: path }).outputText
  const exports = {}
  const context = vm.createContext({ exports, module: { exports }, console, Date, Error,
    setTimeout, clearTimeout, queueMicrotask, structuredClone, File, DOMException,
    ...globals, require(name) {
      if (!(name in mocks)) throw new Error(`Unmocked import: ${name}`)
      return mocks[name]
    } })
  vm.runInContext(output, context, { filename: path })
  return exports
}

// Private functions remain private in production. AST extraction avoids copying their logic.
export function functionBody(path, name, globals) {
  const text = source(path)
  const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(tree)
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name && node.initializer) {
      const initializer = node.initializer
      const value = ts.isCallExpression(initializer) ? initializer.arguments[0] : initializer
      found = `const ${name} = ${value.getText(tree)}`
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  if (!found) throw new Error(`Missing production function ${name}`)
  return load(path, {}, globals, `${found}\nexports.subject = ${name}`).subject
}

// Only the successful request/transaction API used by these stores is modeled.
// This does not simulate browser quota, upgrade contention, isolation, or failures.
export function memoryIndexedDB() {
  const databases = new Map()
  return { databases, open(name) {
    const request = {}
    queueMicrotask(() => {
      const fresh = !databases.has(name)
      const stores = databases.get(name) ?? new Map()
      databases.set(name, stores)
      request.result = {
        objectStoreNames: { contains: (key) => stores.has(key) }, close() {},
        createObjectStore(key, { keyPath }) {
          stores.set(key, { keyPath, rows: new Map() })
          return { createIndex() {} }
        },
        transaction(key) {
          const tx = {}
          const data = stores.get(key)
          const run = (operation) => {
            const req = {}
            queueMicrotask(() => {
              req.result = structuredClone(operation())
              req.onsuccess?.()
              setTimeout(() => tx.oncomplete?.(), 0)
            })
            return req
          }
          const store = { transaction: tx,
            put: (row) => run(() => { data.rows.set(row[data.keyPath], structuredClone(row)); return row[data.keyPath] }),
            get: (id) => run(() => data.rows.get(id)),
            getAll: () => run(() => [...data.rows.values()]),
            delete: (id) => run(() => data.rows.delete(id)),
            index: (field) => ({ get: (id) => run(() => [...data.rows.values()].find((row) => row[field] === id)) }),
          }
          tx.objectStore = () => store
          return tx
        },
      }
      if (fresh) request.onupgradeneeded?.()
      request.onsuccess?.()
    })
    return request
  } }
}

export const warning = 'CHARACTERIZED CURRENT BEHAVIOR — CORRECTION REQUIRES SEPARATE APPROVAL'
export const plain = (value) => JSON.parse(JSON.stringify(value))

export function routeBody(path, method, route, globals) {
  const tree = ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true)
  let body
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === method && node.arguments[0]?.text === route) {
      body = node.arguments.at(-1).getText(tree)
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  if (!body) throw new Error(`Missing route ${method} ${route}`)
  return load(path, {}, globals, `exports.subject = ${body}`).subject
}
