import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
const root = path.resolve('.git/design02/visual')
http.createServer((request, response) => {
  const match = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).match(/^\/(?:(legacy|tokens|tailwind)\/)?(workspace|conversation|account-updates|spaces|proof)\/(.*)$/)
  if (!match) { response.writeHead(404).end(); return }
  const dir = match[2] === 'proof' ? path.resolve('.git/design02/proof/dist') : path.join(match[1] ? path.resolve('.git/design02/'+(match[1]==='legacy'?'legacy':'variant-'+match[1])) : root, match[2], 'dist'), file = path.resolve(dir, match[3] || 'index.html')
  if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) { response.writeHead(404).end(); return }
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] ?? 'application/octet-stream')
  response.end(fs.readFileSync(file))
}).listen(5178, '127.0.0.1', () => console.log('Spaces dialog verification: http://127.0.0.1:5178'))
