// Local server: `npm run dev` then open http://localhost:3000 (rooms kept in memory).
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import handler from './api/room.js'

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
  res.setHeader('Content-Type', 'text/html').end(await readFile(new URL('./public/index.html', import.meta.url)))
}).listen(3000, () => console.log('http://localhost:3000'))
