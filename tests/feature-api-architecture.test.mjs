import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Run the actual checker against isolated tiny source trees. Ancestor node_modules
// resolves the installed TypeScript; production files are never mutated.
const testsRoot = fileURLToPath(new URL('.', import.meta.url))
function check(overrides) {
  const fixture = mkdtempSync(path.join(testsRoot, '.feature-api-guard-'))
  const files = {
    'scripts/check-architecture.mjs': readFileSync(new URL('../scripts/check-architecture.mjs', import.meta.url), 'utf8'),
    'client/tsconfig.app.json': JSON.stringify({ compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx' }, include: ['src'] }),
    'tsconfig.server.json': JSON.stringify({ include: ['server'] }),
    'server/empty.ts': 'export {}',
    'client/src/shared/api.ts': 'export function api() {}',
    'client/src/features/account/api.ts': "export { api as listSessions } from '../../shared/api'",
    'client/src/features/account/AccountPanel.tsx': "import { listSessions } from './api'; export const panel = listSessions",
    ...overrides,
  }
  try {
    for (const [name, content] of Object.entries(files)) {
      const file = path.join(fixture, name)
      mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, content)
    }
    try { return { status: 0, output: execFileSync(process.execPath, [path.join(fixture, 'scripts/check-architecture.mjs')], { encoding: 'utf8', stdio: 'pipe' }) } }
    catch (error) { return { status: error.status, output: `${error.stdout}${error.stderr}` } }
  } finally {
    // Validate the resolved recursive cleanup target stays in this test workspace.
    const resolved = path.resolve(fixture)
    if (path.dirname(resolved) !== path.resolve(testsRoot) || !path.basename(resolved).startsWith('.feature-api-guard-')) throw new Error('Unsafe fixture cleanup target')
    rmSync(resolved, { recursive: true, force: true })
  }
}

test('Architecture allows consumer -> own API -> shared transport', () => {
  assert.equal(check({}).status, 0)
})

test('Architecture rejects private API import/re-export/import-type/dynamic import from another feature including Workspace', () => {
  for (const statement of [
    "import { listSessions } from '../account/api'",
    "export { listSessions } from '../account/api'",
    "type API = typeof import('../account/api')",
    "const api = import('../account/api')",
  ]) {
    const result = check({ 'client/src/features/workspace/consumer.ts': statement })
    assert.equal(result.status, 1)
    assert.match(result.output, /private feature API must stay within its owner/)
  }
})

test('Architecture rejects React or UI dependencies from a feature API', () => {
  for (const statement of ["import { useState } from 'react'", "export { panel } from './AccountPanel'"]) {
    const result = check({ 'client/src/features/account/api.ts': statement })
    assert.equal(result.status, 1)
    assert.match(result.output, /feature API must not import (React|UI components)/)
  }
})

test('Architecture still rejects shared -> feature dependencies', () => {
  const result = check({ 'client/src/shared/api.ts': "export { panel } from '../features/account/AccountPanel'" })
  assert.equal(result.status, 1)
  assert.match(result.output, /client\/src\/shared\/api.ts -> client\/src\/features\/account\/AccountPanel.tsx/)
})
