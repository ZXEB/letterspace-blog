export const postUrl = (post) => `/posts/${encodeURIComponent(post.category?.slug || 'journal')}/${encodeURIComponent(post.slug || post.id)}`
export const noteUrl = (note) => `/notes/${note.nid || note.id}`

export async function api(path) {
  const response = await fetch(`/api/v3/${path}${path.includes('?') ? '&' : '?'}_t=1`, { credentials: 'omit', cache: 'no-store' })
  if (!response.ok) throw new Error(`API ${response.status}`)
  const body = await response.json()
  return body.data ?? body
}

export async function getPage(endpoint, page = 1, size = 10, query = {}) {
  const params = new URLSearchParams({ ...query, page, size, _t: 1 })
  const response = await fetch(`/api/v3/${endpoint}?${params}`, { credentials: 'omit', cache: 'no-store' })
  if (!response.ok) throw new Error(`API ${response.status}`)
  const body = await response.json()
  // List and search endpoints in v13 use different pagination envelopes.
  const data = body.data ?? body
  const items = Array.isArray(data) ? data : data.data || []
  const raw = body.meta?.pagination || data.pagination
  const pagination = raw ? {
    page: raw.page ?? raw.current_page ?? page,
    total_pages: raw.total_pages ?? raw.total_page ?? 1,
    total: raw.total ?? items.length,
  } : { page, total_pages: 1, total: items.length }
  return { items, pagination }
}

export async function getAll(endpoint, query = {}) {
  const items = []
  for (let page = 1; ; page++) {
    const result = await getPage(endpoint, page, 100, query)
    items.push(...result.items)
    if (page >= result.pagination.total_pages || !result.items.length) return items
  }
}

export const getList = async (endpoint, size = 8) => (await getPage(endpoint, 1, size)).items
