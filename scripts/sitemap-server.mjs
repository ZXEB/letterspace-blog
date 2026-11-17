import http from 'node:http'

const origin = (process.env.SITE_ORIGIN || 'http://localhost:18080').replace(/\/$/, '')
const upstream = process.env.API_ORIGIN || 'http://mx-core:2333'
const httpCookieBridge = new URL(origin).protocol === 'http:'
export const escapeXml = value => String(value).replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;' })[c])
async function all(endpoint) {
  const items = []
  for (let page = 1; ; page++) {
    const response = await fetch(`${upstream}/api/v3/${endpoint}?page=${page}&size=100&_t=1`, { headers: { 'User-Agent': 'Mozilla/5.0 LetterspaceSitemap' }, signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw Error(`${endpoint}: ${response.status}`)
    const body = await response.json()
    const rows = Array.isArray(body.data) ? body.data : body.data?.data || []
    items.push(...rows)
    if (!rows.length || page >= (body.meta?.pagination?.total_pages || 1)) return items
  }
}
export async function buildSitemap() {
  // Use public paginated endpoints instead of the backend's hour-long aggregate
  // cache so publishing and unpublishing are reflected on the next request.
  const [posts, notes, pages] = await Promise.all(['posts','notes','pages'].map(all))
  const entries = ['/', '/posts', '/notes', '/timeline', '/friends', '/projects', '/about-site'].map(path => ({ path }))
  for (const p of posts) entries.push({ path: `/posts/${encodeURIComponent(p.category?.slug || 'journal')}/${encodeURIComponent(p.slug)}`, date: p.modified_at || p.created_at })
  for (const n of notes.filter(n => !n.has_password)) entries.push({ path: `/notes/${n.nid}`, date: n.modified_at || n.created_at })
  for (const p of pages) entries.push({ path: `/${encodeURIComponent(p.slug)}`, date: p.modified_at || p.created_at })
  const unique = [...new Map(entries.map(item => [item.path, item])).values()]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${unique.map(item => `  <url><loc>${escapeXml(origin + item.path)}</loc>${item.date && Number.isFinite(Date.parse(item.date)) ? `<lastmod>${new Date(item.date).toISOString()}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`
}

http.createServer(async (req, res) => {
  if (req.url?.startsWith('/api/')) {
    const headers = { ...req.headers }
    // Better Auth v13 emits __Secure- cookies in production even on the
    // configured HTTP/IP origin. Translate only this independent HTTP site's
    // cookies at the edge. Preserve HttpOnly, SameSite, signing and CSRF checks.
    // With an HTTPS SITE_ORIGIN this bridge is disabled automatically.
    if (httpCookieBridge && headers.cookie) headers.cookie = headers.cookie.split(/;\s*/).map(c => c.startsWith('better-auth.') ? '__Secure-' + c : c).join('; ')
    const proxy = http.request(new URL(req.url, upstream), { method: req.method, headers, timeout: 90000 }, response => {
      const outputHeaders = { ...response.headers }
      if (httpCookieBridge && outputHeaders['set-cookie']) outputHeaders['set-cookie'] = outputHeaders['set-cookie'].map(c => c.startsWith('__Secure-better-auth.') ? c.replace(/^__Secure-/, '').replace(/;\s*Secure(?=;|$)/ig, '') : c)
      res.writeHead(response.statusCode, outputHeaders)
      response.pipe(res)
    })
    proxy.on('timeout', () => proxy.destroy(new Error('Upstream timeout')))
    proxy.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('API unavailable') })
    req.on('aborted', () => proxy.destroy())
    req.pipe(proxy)
    return
  }
  if (req.url === '/health') { res.writeHead(200); res.end('ok'); return }
  if (req.url !== '/sitemap.xml') { res.writeHead(404); res.end(); return }
  try {
    const xml = await buildSitemap()
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' })
    res.end(xml)
  } catch (error) {
    console.error('Sitemap generation failed:', error.message)
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '30' })
    res.end('Sitemap temporarily unavailable')
  }
}).listen(8080, '0.0.0.0')
