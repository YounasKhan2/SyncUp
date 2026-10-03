import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'

const root = path.resolve('.git/spaces-visual-correction')
http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const match = pathname.match(/^\/(base|head)\/(.*)$/)
  if (!match) { response.writeHead(404).end(); return }
  const dir = path.join(root, match[1], 'dist')
  const file = path.resolve(dir, match[2] || 'index.html')
  if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) { response.writeHead(404).end(); return }
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] ?? 'application/octet-stream')
  response.end(fs.readFileSync(file))
}).listen(5174, '127.0.0.1', () => console.log('Immutable base/HEAD visual builds: http://127.0.0.1:5174'))
