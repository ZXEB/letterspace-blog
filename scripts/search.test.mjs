import { test } from 'node:test'
import assert from 'node:assert/strict'
import { searchPublicContent } from '../src/search.js'

test('searches public posts, notes and pages without the backend search index', async () => {
  const posts = Array.from({ length: 105 }, (_, i) => ({ id: String(i), slug: `post-${i}`, title: `测试文章 ${i}`, text: '可搜索的正文', category: { slug: 'daily' }, is_published: true, created_at: `2026-01-${String(i % 28 + 1).padStart(2, '0')}` }))
  posts.push({ id: 'hidden', title: '测试私密文章', is_published: false })
  const notes = [{ id: 'n1', nid: 17, text: '测试手记', is_published: true }, { id: 'n2', text: '测试密码手记', has_password: true }]
  const pages = [{ id: 'p1', slug: 'about me', title: '测试页面' }]
  const oldFetch = globalThis.fetch
  globalThis.fetch = async url => {
    const parsed = new URL(url, 'https://example.test')
    const items = { posts, notes, pages }[parsed.pathname.split('/').at(-1)]
    assert.ok(items, 'search uses only public content endpoints')
    const size = Number(parsed.searchParams.get('size')), page = Number(parsed.searchParams.get('page'))
    return { ok: true, json: async () => ({ data: items.slice((page - 1) * size, page * size), meta: { pagination: { page, total_pages: Math.ceil(items.length / size), total: items.length } } }) }
  }
  try {
    const first = await searchPublicContent('测试', 1, 10)
    assert.equal(first.pagination.total, 107)
    assert.equal(first.pagination.total_pages, 11)
    assert.equal(first.items.length, 10)
    const last = await searchPublicContent('测试', 11, 10)
    assert.equal(last.items.length, 7)
    const all = [...first.items, ...last.items]
    assert.ok(all.every(item => item.id !== 'hidden' && item.id !== 'n2'))
    const note = await searchPublicContent('测试手记')
    assert.equal(note.items[0].to, '/notes/17')
    const page = await searchPublicContent('测试页面')
    assert.equal(page.items[0].to, '/about%20me')
    assert.equal((await searchPublicContent('不存在')).pagination.total, 0)
  } finally { globalThis.fetch = oldFetch }
})
