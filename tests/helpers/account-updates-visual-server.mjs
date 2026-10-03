import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
const root = path.resolve('.git/account-updates-visual')
http.createServer((request, response) => {
  const match = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).match(/^\/(base|head)\/(.*)$/)
  if (!match) { response.writeHead(404).end(); return }
  const dir = path.join(root, match[1], 'dist'), file = path.resolve(dir, match[2] || 'index.html')
  if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) { response.writeHead(404).end(); return }
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] ?? 'application/octet-stream')
  response.end(fs.readFileSync(file))
}).listen(5176, '127.0.0.1', () => console.log('Spaces dialog verification: http://127.0.0.1:5176'))
