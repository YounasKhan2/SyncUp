import baseline from '../../client/vite.config.ts'
import { fileURLToPath } from 'node:url'

// Serve root-level frozen fixtures with diagnostics installed before their modules.
// Run from the repository root: node node_modules/vite/bin/vite.js --config tests/helpers/final-preview.config.ts --host 127.0.0.1 --port 5174 --strictPort
export default {
  ...baseline,
  plugins: [...(baseline.plugins ?? []), {
    name: 'final-validation-observer',
    transformIndexHtml() {
      return [{ tag: 'script', attrs: { src: '/@fs/' + fileURLToPath(new URL('../fixtures/final-observer.js', import.meta.url)) }, injectTo: 'head-prepend' as const }]
    },
  }],
}
