import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
// Infrastructure-dependent suites must use the .integration.test.* suffix.
const suites = readdirSync(new URL('../tests/', import.meta.url))
  .filter((name) => /\.test\.(?:mts|mjs)$/.test(name) && !/\.integration\.test\./.test(name))
  .sort()
if (!suites.length) throw new Error('No unit test suites discovered.')
console.info('Non-integration suites:\n' + suites.map((name) => `  tests/${name}`).join('\n'))
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...suites.map((name) => `tests/${name}`)], {
  cwd: root,
  stdio: 'inherit',
})
if (result.error) throw result.error
process.exitCode = result.status ?? 1
