import React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, Eye, Feather, Hash, Heart, Search } from 'lucide-react'
import { api, getAll, postUrl } from './api'
import { plainContent } from './Content'
import { archiveTags, makeArchive } from './posts'
import './post-archive.css'

const dateFormat = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

function postDate(value, pinned) {
  const when = new Date(value)
  if (!Number.isFinite(when.getTime())) return ''
  const days = Math.floor((Date.now() - when.getTime()) / 86400000)
  if (!pinned && days >= 0 && days < 30) return days === 0 ? '今天' : `${days} 天前`
  return dateFormat.format(when)
}

function useArchivePosts(excludeAI, enabled = true) {
  const [state, setState] = React.useState({ data: null, loading: enabled, error: false })
  React.useEffect(() => {
    if (!enabled) return
    let active = true
    setState({ data: null, loading: true, error: false })
    getAll('posts', { truncate: 500, ...(excludeAI ? { excludeAiWritten: 'true' } : {}) })
      .then(data => active && setState({ data, loading: false, error: false }))
      .catch(() => active && setState({ data: null, loading: false, error: true }))
    return () => { active = false }
  }, [excludeAI, enabled])
  return state
}

function PostCard({ post, onCategory }) {
  const pinned = Boolean(post.pin_at)
  const text = plainContent(post.summary || post.text)
  const category = post.category?.name || '随笔'
  return <article className={pinned ? 'archive-card is-pinned' : 'archive-card'}>
    {pinned && <span className="archive-pin">置顶</span>}
    <Link className="archive-title" to={postUrl(post)}>{post.title || '无题'}</Link>
    {text && <p className="archive-excerpt">{text}</p>}
    <div className="archive-meta">
      <div><time dateTime={post.created_at || undefined}>{postDate(post.created_at, pinned)}</time><span aria-hidden="true">·</span><button type="button" onClick={() => onCategory(String(post.category?.id ?? post.category_id ?? ''))}>{category}</button></div>
      <div className="archive-stats">
        {Number(post.read_count) > 0 && <span aria-label={`${post.read_count} 次阅读`}><Eye size={13} aria-hidden="true"/>{post.read_count}</span>}
        {Number(post.like_count) > 0 && <span aria-label={`${post.like_count} 次喜欢`}><Heart size={13} aria-hidden="true"/>{post.like_count}</span>}
      </div>
    </div>
  </article>
}

function ArchiveSidebar({ categories, tags, category, tag, update }) {
  const navigate = useNavigate()
  const [query, setQuery] = React.useState('')
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const search = event => {
    event.preventDefault()
    const value = query.trim()
    navigate(value ? `/search?${new URLSearchParams({ q: value })}` : '/search')
  }
  return <aside className="archive-sidebar" aria-label="文章筛选">
    <div className="archive-mobile-tools">
      <Link to="/search"><Search size={14}/> 搜索</Link>
      <button type="button" aria-expanded={filtersOpen} aria-controls="archive-filters" onClick={() => setFiltersOpen(!filtersOpen)}><Hash size={14}/> {tag || (category ? '标签与分类' : '全部标签')}</button>
    </div>
    <form className="archive-search" onSubmit={search} role="search">
      <button type="submit" aria-label="搜索"><Search size={16}/></button>
      <input aria-label="搜索文章、手记和页面" placeholder="搜索" value={query} onChange={event => setQuery(event.target.value)}/>
    </form>
    <div id="archive-filters" className={filtersOpen ? 'archive-filters is-open' : 'archive-filters'}>
      <div className="archive-filter-section">
        {tags.length ? <div className="archive-chips">{tags.map(item => <button key={item.name} type="button" className={tag === item.name ? 'archive-chip active' : 'archive-chip'} aria-pressed={tag === item.name} onClick={() => update({ tag: tag === item.name ? '' : item.name })}>{item.name} <span>({item.count})</span></button>)}</div> : <p className="archive-filter-empty">暂无标签</p>}
        <button type="button" className="archive-clear" onClick={() => update({ tag: '' })}>全部标签</button>
      </div>
      <details className="archive-filter-section archive-categories" open={category ? true : undefined}>
        <summary>分类 <ChevronDown size={13}/></summary>
        <div className="archive-chips"><button type="button" className={!category ? 'archive-chip active' : 'archive-chip'} aria-pressed={!category} onClick={() => update({ category: '' })}>全部</button>{categories.map(item => <button key={item.id} type="button" className={category === String(item.id) ? 'archive-chip active' : 'archive-chip'} aria-pressed={category === String(item.id)} onClick={() => update({ category: String(item.id) })}>{item.name} <span>({item.count ?? 0})</span></button>)}</div>
      </details>
    </div>
  </aside>
}

function ArchivePagination({ pagination, params }) {
  if (pagination.total_pages <= 1) return null
  const link = page => { const next = new URLSearchParams(params); next.set('page', String(page)); return `?${next}` }
  return <nav className="archive-pagination" aria-label="文章分页">
    {pagination.page > 1 ? <Link to={link(pagination.page - 1)}>← 上一页</Link> : <span className="archive-page-disabled">← 上一页</span>}
    {pagination.page < pagination.total_pages ? <Link to={link(pagination.page + 1)}>下一页 →</Link> : <span className="archive-page-disabled">下一页 →</span>}
    <span className="archive-page-count">第 {pagination.page} 页，共 {pagination.total_pages} 页</span>
  </nav>
}

export default function PostArchive() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || ''
  const tag = params.get('tag') || ''
  const sort = ['latest', 'oldest', 'updated'].includes(params.get('sort')) ? params.get('sort') : 'latest'
  const excludeAI = params.get('no_ai') === '1'
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1)
  const allPosts = useArchivePosts(false)
  const humanPosts = useArchivePosts(true, excludeAI)
  const [categories, setCategories] = React.useState([])
  React.useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [page])
  React.useEffect(() => { let active = true; api('categories').then(data => active && setCategories(Array.isArray(data) ? data : [])).catch(() => {}); return () => { active = false } }, [])

  const update = changes => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) value ? next.set(key, value) : next.delete(key)
    next.delete('page')
    setParams(next, { preventScrollReset: true })
  }
  const selected = excludeAI ? humanPosts : allPosts
  const loading = selected.loading || (!selected.data && !selected.error)
  const archive = React.useMemo(() => makeArchive(selected.data || [], { category, tag, sort, page }), [selected.data, category, tag, sort, page])
  const tags = React.useMemo(() => archiveTags(allPosts.data || []), [allPosts.data])
  const pinned = archive.items.filter(post => post.pin_at)
  const regular = archive.items.filter(post => !post.pin_at)

  return <div className="archive-grid">
    <header className="archive-heading"><span>BLOG</span><h1>文章</h1></header>
    {!loading && !selected.error && <>
      {pinned.length > 0 && <div className="archive-pinned">{pinned.map(post => <PostCard key={post.id} post={post} onCategory={value => update({ category: value })}/>)}</div>}
      <div className="archive-toolbar"><span aria-live="polite">共 {archive.pagination.total} 篇</span><div className="archive-toolbar-actions"><button type="button" className={excludeAI ? 'archive-ai active' : 'archive-ai'} aria-pressed={excludeAI} onClick={() => update({ no_ai: excludeAI ? '' : '1' })}><Feather size={13}/> 无 AI 写作</button><div className="archive-sort" aria-label="文章排序">{[['latest', '最新'], ['oldest', '最早'], ['updated', '最近更新']].map(([value, label]) => <button key={value} type="button" className={sort === value ? 'active' : ''} aria-pressed={sort === value} onClick={() => update({ sort: value === 'latest' ? '' : value })}>{label}</button>)}</div></div></div>
    </>}
    <ArchiveSidebar categories={categories} tags={tags} category={category} tag={tag} update={update}/>
    <div className="archive-content">
      {loading ? <div className="archive-status" role="status">正在载入文章…</div> : selected.error ? <div className="archive-status" role="status">文章暂时无法载入，请稍后再试。</div> : <>
        {regular.length ? <div className="archive-list">{regular.map(post => <PostCard key={post.id} post={post} onCategory={value => update({ category: value })}/>)}</div> : !archive.items.length && <div className="archive-status">没有符合条件的文章。</div>}
        <ArchivePagination pagination={archive.pagination} params={params}/>
      </>}
    </div>
  </div>
}
