// Local server: `npm run dev` then open http://localhost:3000 (tables stored in memory).
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import handler from './api/room.js'

const PUBLIC = new URL('./public/', import.meta.url)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain' }

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname === '/api/room') {
    let body = ''
    for await (const chunk of req) body += chunk
    req.query = Object.fromEntries(url.searchParams)
    req.body = body ? JSON.parse(body) : {}
    res.status = code => ((res.statusCode = code), res)
    res.json = data => res.setHeader('Content-Type', 'application/json').end(JSON.stringify(data))
    return handler(req, res)
  }
  const path = url.pathname === '/' ? '/index.html' : url.pathname
  const fileUrl = new URL('./public' + path, import.meta.url)
  try {
    if (!fileUrl.pathname.startsWith(PUBLIC.pathname)) throw new Error('outside public')
    const file = await readFile(fileUrl)
    res.setHeader('Content-Type', TYPES[extname(path)] || 'application/octet-stream').end(file)
  } catch {
    res.statusCode = 404
    res.end('Not found')
  }
}).listen(3000, () => console.log('http://localhost:3000'))
