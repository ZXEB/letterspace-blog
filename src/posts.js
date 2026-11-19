const timestamp = value => {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const postTagName = tag => typeof tag === 'string' ? tag : tag?.name || ''

export function archiveTags(posts) {
  const counts = new Map()
  for (const post of posts) {
    for (const tag of new Set((post.tags || []).map(postTagName).filter(Boolean))) {
      counts.set(tag, (counts.get(tag) || 0) + 1)
    }
  }
  return [...counts].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
}

export function makeArchive(posts, { category = '', tag = '', sort = 'latest', page = 1, size = 10 } = {}) {
  const filtered = posts.filter(post => post.is_published !== false
    && (!category || String(post.category?.id ?? post.category_id ?? '') === category)
    && (!tag || (post.tags || []).some(item => postTagName(item) === tag)))

  filtered.sort((a, b) => {
    const pinnedA = Boolean(a.pin_at), pinnedB = Boolean(b.pin_at)
    if (pinnedA !== pinnedB) return pinnedA ? -1 : 1
    if (pinnedA && pinnedB) {
      const order = (a.pin_order ?? Number.MAX_SAFE_INTEGER) - (b.pin_order ?? Number.MAX_SAFE_INTEGER)
      if (order) return order
    }
    const field = post => sort === 'updated' ? timestamp(post.modified_at || post.created_at) : timestamp(post.created_at)
    const byDate = (field(a) - field(b)) * (sort === 'oldest' ? 1 : -1)
    return byDate || timestamp(b.created_at) - timestamp(a.created_at) || String(a.id).localeCompare(String(b.id))
  })

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / size))
  const current = Math.min(Math.max(1, page), totalPages)
  return { items: filtered.slice((current - 1) * size, current * size), pagination: { page: current, total_pages: totalPages, total } }
}
