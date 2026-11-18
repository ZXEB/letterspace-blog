import { getAll, noteUrl, postUrl } from './api.js'

const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase()
const plainText = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

// Backups deliberately omit Mix Space's search index. Search the public lists
// so a restored site remains searchable before the backend rebuilds its index.
export async function searchPublicContent(query, page = 1, size = 10) {
  const needle = normalize(query.trim())
  if (!needle) return { items: [], pagination: null }
  const [posts, notes, pages] = await Promise.all(['posts', 'notes', 'pages'].map(type => getAll(type)))
  const results = [
    ...posts.filter(item => item.is_published !== false).map(item => ({ ...item, kind: '文章', to: postUrl(item) })),
    ...notes.filter(item => item.is_published !== false && !item.has_password).map(item => ({ ...item, kind: '手记', to: noteUrl(item) })),
    ...pages.filter(item => item.slug).map(item => ({ ...item, kind: '页面', to: '/' + encodeURIComponent(item.slug) })),
  ].filter(item => normalize([item.title, item.subtitle, item.summary, item.text, ...(item.tags || []).map(tag => typeof tag === 'string' ? tag : tag?.name)].join(' ')).includes(needle))
    .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0))
  const total = results.length
  return {
    items: results.slice((page - 1) * size, page * size).map(item => ({ ...item, searchSnippet: plainText(item.summary || item.text).slice(0, 160) })),
    pagination: { page, total_pages: Math.max(1, Math.ceil(total / size)), total },
  }
}
