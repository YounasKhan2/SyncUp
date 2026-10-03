import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
const root = path.resolve('.git/design04')
http.createServer((request, response) => {
  const match = new URL(request.url, 'http://localhost').pathname.match(/^\/(base|head)\/(workspace|conversation|custom)\/(.*)$/)
  if (!match) return response.writeHead(404).end()
  const dir = path.join(root, match[1], match[2], 'dist'), file = path.resolve(dir, match[3] || 'index.html')
  if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) return response.writeHead(404).end()
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(file)] ?? 'application/octet-stream')
  response.end(fs.readFileSync(file))
}).listen(5180, '127.0.0.1', () => console.log('Avatar verification http://127.0.0.1:5180'))
