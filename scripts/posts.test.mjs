import { test } from 'node:test'
import assert from 'node:assert/strict'
import { archiveTags, makeArchive } from '../src/posts.js'

const posts = [
  { id: 'new', created_at: '2026-11-18', modified_at: null, tags: ['日常'], category: { id: 'life' } },
  { id: 'pin', created_at: '2025-01-01', pin_at: '2025-01-01', pin_order: 1, tags: ['日常', '日常'], category: { id: 'life' } },
  { id: 'old', created_at: '2024-01-01', modified_at: '2026-11-19', tags: [{ name: '技术' }], category: { id: 'tech' } },
  { id: 'hidden', is_published: false, created_at: '2026-11-19', tags: [], category: { id: 'tech' } },
]

test('keeps pinned posts first and sorts public posts across the entire archive', () => {
  const ids = options => makeArchive(posts, options).items.map(item => item.id)
  assert.deepEqual(ids({ sort: 'latest' }), ['pin', 'new', 'old'])
  assert.deepEqual(ids({ sort: 'oldest' }), ['pin', 'old', 'new'])
  assert.deepEqual(ids({ sort: 'updated' }), ['pin', 'old', 'new'])
})

test('filters, counts tags once per post, and paginates after sorting', () => {
  assert.deepEqual(archiveTags(posts), [{ name: '日常', count: 2 }, { name: '技术', count: 1 }])
  assert.deepEqual(makeArchive(posts, { category: 'life', tag: '日常' }).items.map(item => item.id), ['pin', 'new'])
  const second = makeArchive(posts, { size: 2, page: 2 })
  assert.deepEqual(second.items.map(item => item.id), ['old'])
  assert.deepEqual(second.pagination, { page: 2, total_pages: 2, total: 3 })
  assert.equal(makeArchive(posts, { tag: '不存在', page: 9 }).pagination.page, 1)
})
