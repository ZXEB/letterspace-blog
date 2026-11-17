import http from 'node:http'
import https from 'node:https'
import net from 'node:net'

// Optional per-process interface binding bypasses a broken local proxy route.
// It never edits system proxy settings or the remote server.
export const localAddress = process.env.BLOG_LOCAL_ADDRESS || undefined
export function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const client = target.protocol === 'https:' ? https : http
    const req = client.request(target, { localAddress, method: options.method || 'GET', headers: { 'User-Agent': 'Mozilla/5.0 LetterspaceAcceptance', ...options.headers }, timeout: 20000 }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8')
        resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, headers: { get: key => res.headers[key.toLowerCase()], getSetCookie: () => res.headers['set-cookie'] || [] }, text: async () => body, json: async () => JSON.parse(body) })
      })
    })
    req.on('timeout', () => req.destroy(new Error('Request timeout')))
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

export async function startBrowserProxy() {
  if (!localAddress) return { options: {}, close: async () => {} }
  const sockets = new Set()
  const server = http.createServer((req, res) => {
    const url = new URL(req.url)
    const upstream = (url.protocol === 'https:' ? https : http).request(url, { localAddress: ['localhost', '127.0.0.1'].includes(url.hostname) ? undefined : localAddress, method: req.method, headers: req.headers }, response => {
      res.writeHead(response.statusCode, response.headers)
      response.pipe(res)
    })
    upstream.on('error', e => { res.writeHead(502); res.end(e.message) })
    req.pipe(upstream)
  })
  server.on('connect', (req, client, head) => {
    const target = new URL('http://' + req.url)
    const upstream = net.connect({ host: target.hostname, port: target.port || 443, localAddress }, () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head.length) upstream.write(head)
      upstream.pipe(client); client.pipe(upstream)
    })
    upstream.on('error', () => client.destroy())
    client.on('close', () => upstream.destroy())
  })
  server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return { options: { proxy: { server: `http://127.0.0.1:${server.address().port}` } }, close: async () => { for (const s of sockets) s.destroy(); await new Promise(resolve => server.close(resolve)) } }
}
