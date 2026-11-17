import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, ChevronDown, Clock3, Github, Heart, Link2, MapPin, Menu, Moon, Rss, Search, Sun, X } from 'lucide-react'
import { api, postUrl, noteUrl, getPage, getAll, getList } from './api'
import { Content } from './Content'
import { CountUp, ReadingProgress, useNavIndicator, useReveal } from './Motion'
import './styles.css'
import './motion.css'

const date = (value) => value ? new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value)) : '刚刚'
const days = Math.max(0, Math.floor((Date.now() - new Date('2026-01-01').getTime()) / 86400000))

function useOwner() {
  const [owner, setOwner] = React.useState(null)
  React.useEffect(() => { api('owner').then(setOwner).catch(() => {}) }, [])
  return owner
}

function useSiteStats() {
  const state = useResource(() => api('aggregate/site_info'))
  return state
}

function useSeo(title, description, path) {
  React.useEffect(() => {
    if (title) document.title = `${title} | 纸间`
    if (description) document.querySelector('meta[name="description"]').content = description.slice(0, 160)
    if (path) document.querySelector('link[rel="canonical"]').href = `${location.origin}${path}`
  }, [title, description, path])
}

function Pagination({ pagination }) {
  const [params] = useSearchParams()
  if (!pagination || pagination.total_pages <= 1) return null
  const link = (page) => { const next = new URLSearchParams(params); next.set('page', String(page)); return `?${next}` }
  return <nav className="pagination" aria-label="分页">{pagination.page > 1 ? <Link to={link(pagination.page - 1)}>← 上一页</Link> : <span/>}<span>第 {pagination.page} / {pagination.total_pages} 页 · 共 {pagination.total} 条</span>{pagination.page < pagination.total_pages ? <Link to={link(pagination.page + 1)}>下一页 →</Link> : <span/>}</nav>
}
const currentPage = (params) => Math.max(1, Number.parseInt(params.get('page'), 10) || 1)

function ThemeToggle() {
  const [theme, setTheme] = React.useState(() => localStorage.getItem('letterspace-theme') || 'system')
  const transition = React.useRef(null)
  React.useLayoutEffect(() => {
    const apply = () => document.documentElement.dataset.theme = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme
    apply()
    if (theme !== 'system') return
    const media = matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
  const cycle = (event) => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    const commit = () => { localStorage.setItem('letterspace-theme', next); setTheme(next) }
    transition.current?.skipTransition()
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { commit(); return }
    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    document.documentElement.classList.add('theme-changing')
    const view = document.startViewTransition(() => flushSync(commit))
    transition.current = view
    view.ready.then(() => document.documentElement.animate({clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]}, {duration: 620, easing: 'cubic-bezier(.22, 1, .36, 1)', pseudoElement: '::view-transition-new(root)'})).catch(() => {})
    view.finished.catch(() => {}).finally(() => { if (transition.current === view) { document.documentElement.classList.remove('theme-changing'); transition.current = null } })
  }
  const Icon = theme === 'dark' ? Moon : theme === 'system' ? Sun : Sun
  return <button className="icon-button theme-toggle" title={`主题：${theme === 'system' ? '跟随系统' : theme === 'dark' ? '深色' : '浅色'}`} aria-label="切换主题" onClick={cycle}><span key={theme} className="theme-icon"><Icon size={16}/></span></button>
}

function Header({ owner }) {
  const [open, setOpen] = React.useState(false)
  const navRef = React.useRef(null)
  const location = useLocation()
  const indicatorEvents = useNavIndicator(navRef, `${location.pathname}/${open}`)
  React.useEffect(() => setOpen(false), [location.pathname])
  const nav = [['/', '首页'], ['/posts', '文章'], ['/notes', '手记'], ['/timeline', '时间线'], ['/friends', '友链'], ['/projects', '项目']]
  return <header className="site-header"><div className="header-inner"><Link to="/" className="brand"><span className="brand-mark">{owner?.name?.slice(0, 1) || '纸'}</span><span>{owner?.name || '纸间'}</span></Link><nav ref={navRef} id="site-navigation" aria-label="主导航" className={open ? 'main-nav is-open' : 'main-nav'} {...indicatorEvents}><span className="nav-indicator" aria-hidden="true"/>{nav.map(([path, label]) => <NavLink key={path} to={path} end={path === '/'}>{label}</NavLink>)}<NavLink to="/search" className="nav-search" aria-label="搜索"><Search size={16}/><span>搜索</span></NavLink></nav><div className="header-actions"><ThemeToggle/><a className="icon-button" href="/feed" title="RSS 订阅" aria-label="RSS 订阅"><Rss size={15}/></a><button className="icon-button mobile-menu" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="site-navigation" aria-label={open ? '关闭菜单' : '打开菜单'}><span className={open ? 'menu-glyph is-open' : 'menu-glyph'} aria-hidden="true"><i/><i/><i/></span></button></div></div></header>
}

function Footer({ owner }) {
  return <footer className="site-footer"><div className="footer-main"><div><Link to="/" className="footer-brand">{owner?.name || '知行间'}</Link><p>{owner?.description || '把日子写成一封信。'}</p></div><nav aria-label="页脚导航"><Link to="/about">关于</Link><Link to="/about-site">关于本站</Link><Link to="/friends">友链</Link><a href="/feed">RSS 订阅</a><a href="/proxy/qaqdmin#/dashboard">博客管理 ↗</a></nav></div><div className="footer-bottom"><span>© {new Date().getFullYear()} {owner?.name || '知行间'}</span><span>Powered by <a href="https://github.com/mx-space/core">Mix Space</a> · made with a little quiet</span></div></footer>
}

function PageLayout({ children, owner }) {
  const location = useLocation()
  const content = React.useRef(null)
  const route = location.pathname + location.search
  useReveal(content, route)
  return <><ReadingProgress route={route}/><Header owner={owner}/><main ref={content} className={`page-shell${location.pathname === '/' ? ' home-page' : ' inner-page'}`}><div key={route} className="route-content">{children}</div></main><Footer owner={owner}/></>
}

function useResource(loader, dependency = '') {
  const [state, setState] = React.useState({ data: null, loading: true, error: false })
  React.useEffect(() => {
    let active = true
    setState({ data: null, loading: true, error: false })
    loader().then((data) => active && setState({ data, loading: false, error: false })).catch(() => active && setState({ data: null, loading: false, error: true }))
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependency])
  return state
}

function Loading({ error = false }) { return <div className="status-message" role="status">{!error && <span className="loading-dots" aria-hidden="true"><i/><i/><i/></span>}{error ? '内容暂时无法载入。请确认 Mix Space 服务已经启动。' : '稍候片刻，月出文自明。'}</div> }
function SectionHeading({ eyebrow, title, description }) { return <div className="section-heading"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div> }

function PostRow({ post, index }) {
  const category = post.category?.name || post.category?.slug || '随笔'
  return <article className="writing-row"><span className="row-index">{String(index).padStart(2, '0')}</span><div className="row-copy"><Link className="row-title" to={postUrl(post)}>{post.title || '无题'}</Link><div className="row-meta"><span>文章</span><i/> <span>{category}</span><i/> <time>{date(post.created_at)}</time></div>{post.summary && <p className="row-summary">{post.summary}</p>}</div><ArrowUpRight className="row-arrow" size={17}/></article>
}

function PostList({ posts, loading, error, all = false }) {
  if (loading) return <div className="writing-skeleton" role="status" aria-label="正在载入文章">{Array.from({length:5}, (_,i)=><div className="skeleton-row" key={i} aria-hidden="true" style={{'--step':i}}><span/><div><i/><i/></div></div>)}</div>
  if (error) return <Loading error/>
  if (!posts?.length) return <div className="empty-state">这里还没有文章。<a href="/proxy/qaqdmin#/dashboard">进入博客后台开始写作 ↗</a></div>
  return <div className="writing-list">{(all ? posts : posts.slice(0, 5)).map((post, i) => <PostRow post={post} index={i + 1} key={post.id}/>)}</div>
}

function WritingActivity() {
  const state = useResource(() => getAll('posts'))
  const posts = state.data || []
  const year = new Date().getFullYear()
  const months = Array.from({length: 12}, (_, month) => ({month, count: posts.filter(p => new Date(p.created_at).getFullYear() === year && new Date(p.created_at).getMonth() === month).length}))
  return <section className="writing-activity"><span className="eyebrow">A YEAR IN WORDS</span><h2>笔耕不辍</h2><div className="month-line">{months.map(({month,count}) => <Link key={month} style={{'--step':month}} to="/timeline" title={year + '年' + (month+1) + '月 · ' + count + '篇文章'} className={count ? 'month active' : 'month'}><i style={{width: Math.min(12, 4 + Math.sqrt(count) * 2), height: Math.min(12, 4 + Math.sqrt(count) * 2)}}/><span>{month+1}月</span></Link>)}</div>{posts[0] && <Link className="activity-latest" to={postUrl(posts[0])}>近作 · {posts[0].title}</Link>}<Link className="text-link" to="/timeline">本年 {months.reduce((sum,m) => sum+m.count,0)} 篇 · 翻阅完整时间线 <ArrowRight size={14}/></Link></section>
}

function Home({ owner }) {
  const posts = useResource(() => getList('posts', 5))
  const notes = useResource(() => getList('notes', 3))
  const statsState = useSiteStats()
  return <>
    <section className="home-intro"><div className="intro-copy"><img className="owner-avatar" src={owner?.avatar || '/favicon.svg'} alt="站点主人头像"/><h1><span className="hero-line">你好，我是 {owner?.name || '纸间'}。</span><span className="hero-line hero-line-second">把日子写成一封信。</span></h1><p>{owner?.introduce || '记录生活、技术，以及那些不急着抵达的日常。'}</p></div><div className="intro-note"><p>「当世界渐渐安静下来，文字便有了自己的声音。」</p></div><div className="intro-stats"><div><strong><CountUp value={statsState.data?.post_count}/> 篇</strong></div><span>·</span><div><strong><CountUp value={statsState.data ? (statsState.data.total_word_count || 0) / 10000 : null} decimals={1}/> 万字</strong></div><span>·</span><div><strong><CountUp value={statsState.data?.first_publish_date ? Math.max(1, Math.floor((Date.now()-new Date(statsState.data.first_publish_date))/86400000)) : null}/> 天</strong></div></div><Link className="intro-down" to="#recent" onClick={e => { e.preventDefault(); document.getElementById('recent')?.scrollIntoView({behavior:'smooth'}) }} aria-label="阅读近期笔墨"><ArrowDown size={16}/></Link></section>
    <div className="home-columns" id="recent"><section className="content-section"><div className="section-top"><div><span className="eyebrow">RECENT WRITING</span><h2>近期笔墨</h2></div><Link className="quiet-link" to="/posts">全部文章 <ArrowRight size={14}/></Link></div><PostList posts={posts.data} loading={posts.loading} error={posts.error}/></section><aside className="notes-preview"><div className="section-top"><div><span className="eyebrow">SMALL LETTERS</span><h2>几封手记</h2></div><Link className="quiet-link" to="/notes">更多 <ArrowRight size={14}/></Link></div>{notes.loading || notes.error ? <Loading error={notes.error}/> : notes.data?.map(note => <article className="small-note" key={note.id}><span className="letter-quote">“</span><div><Link className="row-title" to={noteUrl(note)}>{note.title || '日常手记'}</Link><p>{note.text?.slice(0, 100) || '留下一些日常片段。'}</p><time>{date(note.created_at)}</time></div></article>)}</aside></div>
    <WritingActivity/>
    <section className="letter-cta"><span className="eyebrow">SLOW DOWN, WRITE A LINE</span><p>初冬暖阳，<br/>欢迎来信。</p><Link className="quiet-link" to="/about">认识这个空间 <ArrowUpRight size={14}/></Link><a className="quiet-link" href="/feed"><Rss size={14}/> 订阅通信</a></section>
  </>
}

function PostsPage() {
  const [params, setParams] = useSearchParams()
  const page = currentPage(params)
  const active = params.get('category') || 'all'
  const state = useResource(() => getPage('posts', page, 10, active === 'all' ? {} : { categoryIds: active }), page + '/' + active)
  const categories = useResource(() => api('categories'))
  const select = (id) => setParams(id === 'all' ? {} : { category: id })
  return <><SectionHeading eyebrow="ESSAYS & JOURNAL" title="文章" description="一些认真写下来的想法，和走过的日常。"/><div className="filter-line"><button className={active === 'all' ? 'filter-button active' : 'filter-button'} onClick={() => select('all')}>全部文章</button>{categories.data?.map(c => <button key={c.id} className={active === c.id ? 'filter-button active' : 'filter-button'} onClick={() => select(c.id)}>{c.name} <span>{c.count}</span></button>)}</div><PostList posts={state.data?.items} loading={state.loading} error={state.error} all/><Pagination pagination={state.data?.pagination}/><a className="rss-page-link" href="/feed">订阅 RSS <Rss size={14}/></a></>
}

function PostDetail() {
  const { category, slug } = useParams()
  const state = useResource(async () => {
    if (category) return api(`posts/${encodeURIComponent(category)}/${encodeURIComponent(slug)}`)
    if (/^\d+$/.test(slug)) return api(`posts/${slug}`)
    const route = await api(`posts/get-url/${encodeURIComponent(slug)}`)
    return api(`posts${route.path}`)
  }, `${category || ''}/${slug}`)
  const post = state.data
  useSeo(post?.title, post?.summary || post?.text, post ? postUrl(post) : undefined)
  if (state.loading || state.error || !post) return <><Link to="/posts" className="back-link"><ArrowLeft size={14}/> 返回文章列表</Link><Loading error={state.error || (!state.loading && !post)}/></>
  return <article className="article-detail"><Link to="/posts" className="back-link"><ArrowLeft size={14}/> 全部文章</Link><header className="article-header"><span className="eyebrow">{post.category?.name || '随笔'} · {date(post.created_at)}</span><h1>{post.title}</h1>{post.summary && <p>{post.summary}</p>}<div className="article-stats"><span><BookOpen size={14}/> {post.read_count || 0} 次阅读</span><span><Heart size={14}/> {post.like_count || 0}</span></div></header><Content document={post}/><div className="article-end"><span>这封信就写到这里。</span><Link to="/posts" className="quiet-link">继续阅读 <ArrowRight size={14}/></Link></div></article>
}

function NotesPage() {
  const [params] = useSearchParams()
  const page = currentPage(params)
  const state = useResource(() => getPage('notes', page, 10), page)
  return <><SectionHeading eyebrow="SMALL LETTERS" title="手记" description="不必写成文章的那些念头，也值得留下。"/>{state.loading || state.error ? <Loading error={state.error}/> : !state.data?.items.length ? <div className="empty-state">这里还没有公开的手记。</div> : <div className="note-list">{state.data.items.map(note => <article className="note-entry" key={note.id}><div className="note-date"><span>{new Date(note.created_at).getDate()}</span><span>{new Intl.DateTimeFormat('zh-CN',{month:'long',year:'numeric'}).format(new Date(note.created_at))}</span></div><div className="note-body">{(note.mood || note.weather) && <div className="note-atmosphere">{note.mood && <span>{note.mood}</span>}{note.weather && <span>{note.weather}</span>}{note.location && <span><MapPin size={12}/>{note.location}</span>}</div>}<Link to={`/notes/${note.nid || note.id}`} className="row-title">{note.title || date(note.created_at)}</Link><p>{note.text?.slice(0, 280) || '留下一些日常片段。'}</p><time>{date(note.created_at)}</time></div></article>)}</div>}<Pagination pagination={state.data?.pagination}/></>
}

function NoteDetail() {
  const { id, year, month, day, slug } = useParams()
  const route = year ? `notes/${year}/${month}/${day}/${encodeURIComponent(slug)}` : `notes/nid/${encodeURIComponent(id)}`
  const state = useResource(() => api(route), route)
  useSeo(state.data?.title, state.data?.text, state.data ? noteUrl(state.data) : undefined)
  if (state.loading || state.error || !state.data) return <><Link to="/notes" className="back-link"><ArrowLeft size={14}/> 返回手记</Link><Loading error={state.error || (!state.loading && !state.data)}/></>
  const note = state.data
  return <article className="article-detail"><Link to="/notes" className="back-link"><ArrowLeft size={14}/> 全部手记</Link><header className="article-header"><span className="eyebrow">A SMALL LETTER · {date(note.created_at)}</span><h1>{note.title || date(note.created_at)}</h1></header><Content document={note}/><div className="article-end"><span>谢谢你读到这里。</span><Link to="/notes" className="quiet-link">其他手记 <ArrowRight size={14}/></Link></div></article>
}

function TimelinePage() {
  const [params] = useSearchParams()
  const page = currentPage(params)
  const posts = useResource(() => getAll('posts'))
  const notes = useResource(() => getAll('notes'))
  const entries = [...(posts.data || []).map(p => ({ ...p, kind: '文章', to: postUrl(p), body: p.summary || p.text })), ...(notes.data || []).map(n => ({ ...n, kind: '手记', to: `/notes/${n.nid || n.id}`, body: n.text }))].sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
  return <><SectionHeading eyebrow="A LIFE IN NOTES" title="时间线" description="写过的文章和手记，都在这里相遇。"/><div className="timeline-toolbar"><span>{entries.length} 条记录</span><span><CalendarDays size={14}/> 按时间排序</span></div>{posts.loading || notes.loading || posts.error || notes.error ? <Loading error={posts.error || notes.error}/> : <div className="timeline-list">{entries.slice((page - 1) * 20, page * 20).map(item => <article className="timeline-entry" key={`${item.kind}-${item.id}`}><time>{date(item.created_at)}</time><div className="timeline-dot"/><div><span className="eyebrow">{item.kind}</span><Link to={item.to} className="row-title">{item.title || '日常片段'}</Link><p>{item.body?.slice(0, 160)}</p></div></article>)}</div>}<Pagination pagination={{page, total_pages: Math.ceil(entries.length / 20), total: entries.length}}/></>
}

function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [input, setInput] = React.useState(params.get('q') || '')
  const query = params.get('q') || ''
  const page = currentPage(params)
  React.useEffect(() => setInput(query), [query])
  const state = useResource(async () => {
    if (!query.trim()) return {items: [], pagination: null}
    const result = await getPage('search', page, 10, { keyword: query.trim() })
    return {...result, items: result.items.map(item => ({...item, kind: item.type === 'note' ? '手记' : item.type === 'page' ? '页面' : '文章', to: item.type === 'note' ? noteUrl(item) : item.type === 'page' ? '/' + encodeURIComponent(item.slug) : postUrl(item)}))}
  }, query + '/' + page)
  return <><SectionHeading eyebrow="FIND YOUR WORDS" title="搜索" description="在这个小小的空间里，找一段文字。"/><form className="search-form" onSubmit={e => { e.preventDefault(); setParams(input.trim() ? {q:input.trim()} : {}) }}><Search size={17}/><input value={input} onChange={e => setInput(e.target.value)} placeholder="搜索文章、手记和页面…" aria-label="搜索文章和手记"/><button type="submit">搜索</button></form>{query && <p className="search-caption">「{query}」的搜索结果 · {state.data?.pagination?.total ?? '…'} 条</p>}{state.loading ? <Loading/> : state.error ? <Loading error/> : query && !state.data?.items.length ? <div className="empty-state">没有找到相关内容。</div> : <div className="writing-list">{state.data?.items.map((item,i)=><article className="writing-row" key={item.kind + '-' + item.id}><span className="row-index">{String((page - 1) * 10 + i+1).padStart(2,'0')}</span><div className="row-copy"><Link to={item.to} className="row-title">{item.title||item.kind}</Link><div className="row-meta"><span>{item.kind}</span><i/><time>{date(item.created_at)}</time></div><p className="row-summary">{item.highlight?.snippet || item.summary || item.text?.slice(0,120)}</p></div><ArrowUpRight className="row-arrow" size={17}/></article>)}</div>}<Pagination pagination={state.data?.pagination}/></>
}

function FriendsPage() {
  const state = useResource(() => getAll('friends'))
  return <><SectionHeading eyebrow="PEOPLE I ADMIRE" title="朋友们" description="喜欢的人和他们认真经营的小小空间。"/>{state.loading || state.error ? <Loading error={state.error}/> : !state.data?.length ? <div className="empty-state">还没有添加朋友。<a href="/proxy/qaqdmin#/friends">从管理后台添加友链 ↗</a></div> : <div className="friend-list">{state.data.filter(f => !f.hide).map(friend=><a className="friend-entry" href={friend.url} target="_blank" rel="noreferrer" key={friend.id}><img src={friend.avatar||'/favicon.svg'} alt="" loading="lazy"/><div><strong>{friend.name}</strong><p>{friend.description||'一位认真生活和写作的朋友。'}</p></div><ArrowUpRight size={16}/></a>)}</div>}</>
}

function ProjectsPage() {
  const state = useResource(() => getAll('projects'))
  return <><SectionHeading eyebrow="THINGS I MAKE" title="项目" description="做过的一些小玩意，和正在路上的想法。"/>{state.loading || state.error ? <Loading error={state.error}/> : !state.data?.length ? <div className="empty-state">项目正在整理中。<a href="/proxy/qaqdmin#/projects">从管理后台添加项目 ↗</a></div> : <div className="project-list">{state.data.map(project=><a className="project-entry" key={project.id} href={project.url||project.link||'#'} target="_blank" rel="noreferrer"><span className="eyebrow">{project.type||'PROJECT'}</span><h2>{project.name||project.title}</h2><p>{project.description||project.intro}</p><ArrowUpRight size={17}/></a>)}</div>}</>
}

function AboutPage({ owner }) {
  const state = useResource(() => api('pages/slug/about'))
  return <><SectionHeading eyebrow="A FEW WORDS ABOUT ME" title="你好，很高兴认识你。" description={`我是 ${owner?.name || '这座空间的主人'}。`} /><div className="about-prose">{state.loading || state.error ? <Loading error={state.error}/> : <Content document={state.data}/>}</div></>
}

function AboutSitePage() {
  return <><SectionHeading eyebrow="ABOUT THIS SPACE" title="关于本站" description="一个写作、生活与互联网相遇的小角落。"/><div className="about-prose"><p>这里使用 Mix Space 管理内容，并将文字优先放在安静、舒展的阅读界面里。</p><p>文章、手记、时间线和朋友们的站点，都会从自己的博客后台同步展示。</p><p>这个空间属于它的作者，也留给每一位愿意停下来读一会儿的人。</p><a className="text-link" href="https://github.com/mx-space/core" target="_blank" rel="noreferrer">关于 Mix Space <ArrowUpRight size={15}/></a></div></>
}

function CustomPage() {
  const {slug} = useParams()
  const state = useResource(() => api('pages/slug/' + encodeURIComponent(slug)), slug)
  useSeo(state.data?.title, state.data?.subtitle || state.data?.text, '/' + encodeURIComponent(slug))
  if (state.loading) return <Loading/>
  if (state.error || !state.data) return <NotFound/>
  return <article className="article-detail"><SectionHeading eyebrow="A PAGE IN THIS SPACE" title={state.data.title} description={state.data.subtitle}/><Content document={state.data}/></article>
}
function NotFound() { return <><SectionHeading eyebrow="404" title="这封信还没有抵达" description="页面不存在，或尚未公开。"/><Link className="text-link" to="/">返回首页 <ArrowRight size={14}/></Link></> }

function App() {
  const owner = useOwner()
  const location = useLocation()
  React.useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); document.title = ({ '/':'纸间 | 一座安静的个人博客', '/posts':'文章 | 纸间', '/notes':'手记 | 纸间', '/timeline':'时间线 | 纸间', '/friends':'朋友们 | 纸间', '/projects':'项目 | 纸间', '/search':'搜索 | 纸间', '/about':'关于 | 纸间' })[location.pathname] || '纸间 | 一座安静的个人博客' }, [location.pathname])
  React.useEffect(() => {
    document.querySelector('link[rel="canonical"]').href = window.location.origin + location.pathname
    document.querySelector('meta[name="description"]').content = '把日子写成一封信，记录生活、技术与寻常日子。'
  }, [location.pathname])
  const page = (Component, props) => <PageLayout owner={owner}><Component {...props}/></PageLayout>
  return <Routes><Route path="/" element={page(Home,{owner})}/><Route path="/posts" element={page(PostsPage)}/><Route path="/posts/:category/:slug" element={page(PostDetail)}/><Route path="/posts/:slug" element={page(PostDetail)}/><Route path="/notes" element={page(NotesPage)}/><Route path="/notes/:id" element={page(NoteDetail)}/><Route path="/notes/:year/:month/:day/:slug" element={page(NoteDetail)}/><Route path="/timeline" element={page(TimelinePage)}/><Route path="/search" element={page(SearchPage)}/><Route path="/friends" element={page(FriendsPage)}/><Route path="/projects" element={page(ProjectsPage)}/><Route path="/about" element={page(AboutPage,{owner})}/><Route path="/about-site" element={page(AboutSitePage)}/><Route path="/:slug" element={page(CustomPage)}/><Route path="*" element={page(NotFound)}/></Routes>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><App/></BrowserRouter></React.StrictMode>)
