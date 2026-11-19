import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, ChevronDown, FileText, Menu, Moon, Rss, Search, Sun } from 'lucide-react'
import { api, postUrl, noteUrl, getPage, getAll, getList } from './api'
import { Content } from './Content'
import { NoteArchive, NotePaper, Timeline } from './JournalViews'
import PostArchive from './PostArchive'
import PostReader from './PostReader'
import { searchPublicContent } from './search'
import { CountUp, ReadingProgress, useNavIndicator, useReveal } from './Motion'
import './styles.css'
import './motion.css'
import './interior.css'

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

function Header({ owner, compact }) {
  const [open, setOpen] = React.useState(false)
  const navRef = React.useRef(null)
  const location = useLocation()
  const indicatorEvents = useNavIndicator(navRef, `${location.pathname}/${open}`)
  React.useEffect(() => setOpen(false), [location.pathname])
  const nav = [['/', '首页'], ['/posts', '文稿'], ['/notes', '手记'], ['/timeline', '时光'], ['/friends', '友链'], ['/projects', '项目']]
  return <header className={compact ? 'site-header interior-header' : 'site-header'}>
    <div className="header-inner">
      <Link to="/" className="brand" aria-label="返回首页"><img src={owner?.avatar || '/favicon.svg'} alt=""/><span>{owner?.name || '纸间'}</span></Link>
      <nav ref={navRef} id="site-navigation" aria-label="主导航" className={open ? 'main-nav is-open' : 'main-nav'} {...indicatorEvents}>
        <span className="nav-indicator" aria-hidden="true"/>
        {nav.map(([path, label]) => <NavLink key={path} to={path} end={path === '/'}>{path === '/posts' && location.pathname.startsWith('/posts') && <FileText size={13} aria-hidden="true"/>}{label}</NavLink>)}
        <NavLink to="/search" className="nav-search" aria-label="搜索"><Search size={16}/><span>搜索</span></NavLink>
      </nav>
      <div className="header-actions">
        <ThemeToggle/>
        <a className="icon-button" href="/feed" title="RSS 订阅" aria-label="RSS 订阅"><Rss size={15}/></a>
        <button className="icon-button mobile-menu" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="site-navigation" aria-label={open ? '关闭菜单' : '打开菜单'}><Menu size={15} aria-hidden="true"/></button>
      </div>
    </div>
  </header>
}

function Footer({ owner }) {
  return <footer className="site-footer"><div className="footer-main"><div><Link to="/" className="footer-brand">{owner?.name || '知行间'}</Link><p>{owner?.description || '把日子写成一封信。'}</p></div><nav aria-label="页脚导航"><Link to="/about">关于</Link><Link to="/about-site">关于本站</Link><Link to="/friends">友链</Link><a href="/feed">RSS 订阅</a><a href="/proxy/qaqdmin#/dashboard">博客管理 ↗</a></nav></div><div className="footer-bottom"><span>© {new Date().getFullYear()} {owner?.name || '知行间'}</span><span>Powered by <a href="https://github.com/mx-space/core">Mix Space</a> · made with a little quiet</span></div></footer>
}

function PageLayout({ children, owner, variant }) {
  const location = useLocation()
  const content = React.useRef(null)
  const route = location.pathname + location.search
  useReveal(content, route)
  const shell = location.pathname === '/' ? 'home-page' : 'inner-page'
  const keepLayout = variant === 'posts' || variant === 'timeline'
  return <>
    <ReadingProgress route={route}/>
    <Header owner={owner} compact={Boolean(variant)}/>
    <main ref={content} className={`page-shell ${shell}${variant ? ` ${variant}-page-shell` : ''}`}>
      <div key={keepLayout ? location.pathname : route} className="route-content">{children}</div>
    </main>
    <Footer owner={owner}/>
  </>
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
  return <PostArchive/>
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
  return <PostReader key={post.id} post={post}/>
}

function NotesPage() {
  const [params] = useSearchParams()
  const page = currentPage(params)
  const state = useResource(() => getPage('notes', page, 10), page)
  if (state.loading || state.error) return <Loading error={state.error}/>
  if (!state.data?.items.length) return <div className="empty-state">这里还没有公开的手记。</div>
  return <><NoteArchive notes={state.data.items} page={page}/><Pagination pagination={state.data.pagination}/></>
}

function NoteDetail() {
  const { id, year, month, day, slug } = useParams()
  const route = year ? `notes/${year}/${month}/${day}/${encodeURIComponent(slug)}` : `notes/nid/${encodeURIComponent(id)}`
  const state = useResource(() => api(route), route)
  useSeo(state.data?.title, state.data?.text, state.data ? noteUrl(state.data) : undefined)
  if (state.loading || state.error || !state.data) return <><Link to="/notes" className="back-link"><ArrowLeft size={14}/> 返回手记</Link><Loading error={state.error || (!state.loading && !state.data)}/></>
  return <NotePaper note={state.data}/>
}

function TimelinePage() {
  const [params, setParams] = useSearchParams()
  const page = currentPage(params)
  const posts = useResource(() => getAll('posts'))
  const notes = useResource(() => getAll('notes'))
  if (posts.loading || notes.loading || posts.error || notes.error) return <Loading error={posts.error || notes.error}/>
  const entries = [
    ...posts.data.map(post => ({ ...post, kind: '博文', to: postUrl(post), label: post.category?.name })),
    ...notes.data.map(note => ({ ...note, kind: '手记', to: noteUrl(note), label: [note.mood, note.weather].filter(Boolean).join(' · ') })),
  ].filter(item => item.is_published !== false && Number.isFinite(Date.parse(item.created_at)))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  const compact = params.get('view') === 'compact'
  const setCompact = value => {
    const next = new URLSearchParams(params)
    if (value) next.set('view', 'compact')
    else next.delete('view')
    setParams(next, { preventScrollReset: true })
  }
  return <><Timeline entries={entries} page={page} compact={compact} setCompact={setCompact}/><Pagination pagination={{page, total_pages: Math.ceil(entries.length / 20), total: entries.length}}/></>
}

function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [input, setInput] = React.useState(params.get('q') || '')
  const query = params.get('q') || ''
  const page = currentPage(params)
  React.useEffect(() => setInput(query), [query])
  const state = useResource(async () => {
    if (!query.trim()) return {items: [], pagination: null}
    return searchPublicContent(query, page, 10)
  }, query + '/' + page)
  return <>
    <div className="search-bar">
      <Link to="/posts" aria-label="返回文稿"><ArrowLeft size={16}/></Link>
      <form className="search-form" role="search" onSubmit={event => { event.preventDefault(); setParams(input.trim() ? { q: input.trim() } : {}) }}>
        <input type="search" value={input} onChange={event => setInput(event.target.value)} placeholder="搜索文章、手记和页面…" aria-label="搜索文章和手记"/>
        <button type="submit" aria-label="搜索"><Search size={16}/></button>
      </form>
    </div>
    {!query ? <p className="search-hint">输入关键词搜索</p> : <>
      <p className="search-caption">「{query}」的搜索结果 · {state.data?.pagination?.total ?? '…'} 条</p>
      {state.loading ? <Loading/> : state.error ? <Loading error/> : !state.data?.items.length ? <div className="empty-state">没有找到相关内容。</div> :
        <div className="search-results">{state.data.items.map(item => <article key={`${item.kind}-${item.id}`}>
          <Link to={item.to}>{item.title || item.kind}</Link>
          <p>{item.searchSnippet}</p>
          <div className="row-meta"><span>{item.kind}</span><i/><time dateTime={item.created_at || undefined}>{date(item.created_at)}</time></div>
        </article>)}</div>}
      <Pagination pagination={state.data?.pagination}/>
    </>}
  </>
}

function FriendCard({ friend, index }) {
  const [imageError, setImageError] = React.useState(false)
  return <a className="friend-card" href={friend.url} target="_blank" rel="noreferrer">
    <span className="friend-avatar" style={{ '--avatar-hue': (index * 63 + 104) % 360 }} aria-hidden="true">
      {friend.avatar && !imageError ? <img src={friend.avatar} alt="" loading="lazy" onError={() => setImageError(true)}/> : (Array.from(friend.name || '')[0] || '友').toUpperCase()}
    </span>
    <span><strong>{friend.name}</strong>{friend.description && <span className="friend-description">{friend.description}</span>}</span>
  </a>
}

function FriendsPage() {
  const state = useResource(() => getAll('friends'))
  const friends = (state.data || []).filter(friend => !friend.hide)
  const active = friends.filter(friend => !friend.state)
  const offline = friends.filter(friend => friend.state)
  return <>
    <header className="friends-heading"><h1>朋友们</h1><p>海内存知己，天涯若比邻</p></header>
    {state.loading || state.error ? <Loading error={state.error}/> : !friends.length ? <div className="empty-state">还没有添加朋友。</div> : <>
      <div className="friend-cards">{active.map((friend, index) => <FriendCard key={friend.id} friend={friend} index={index}/>)}</div>
      {offline.length > 0 && <details className="offline-friends"><summary>暂时无法访问的站点 <ChevronDown size={15}/></summary><div className="friend-cards">{offline.map((friend, index) => <FriendCard key={friend.id} friend={friend} index={index}/>)}</div></details>}
    </>}
  </>
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
  React.useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0, behavior: 'instant' })
    document.title = ({ '/':'纸间 | 一座安静的个人博客', '/posts':'文稿列表 | 纸间', '/notes':'手记 | 纸间', '/timeline':'时间线 | 纸间', '/friends':'朋友们 | 纸间', '/projects':'项目 | 纸间', '/search':'搜索 | 纸间', '/about':'关于 | 纸间' })[location.pathname] || '纸间 | 一座安静的个人博客'
  }, [location.pathname])
  React.useEffect(() => {
    document.querySelector('link[rel="canonical"]').href = window.location.origin + location.pathname
    document.querySelector('meta[name="description"]').content = '把日子写成一封信，记录生活、技术与寻常日子。'
  }, [location.pathname])
  const page = (view, variant) => <PageLayout owner={owner} variant={variant}>{view}</PageLayout>
  return <Routes>
    <Route path="/" element={page(<Home owner={owner}/>)}/>
    <Route path="/posts" element={page(<PostsPage/>, 'posts')}/>
    <Route path="/posts/:category/:slug" element={page(<PostDetail/>, 'reading')}/>
    <Route path="/posts/:slug" element={page(<PostDetail/>, 'reading')}/>
    <Route path="/notes" element={page(<NotesPage/>, 'notes')}/>
    <Route path="/notes/:id" element={page(<NoteDetail/>, 'notes')}/>
    <Route path="/notes/:year/:month/:day/:slug" element={page(<NoteDetail/>, 'notes')}/>
    <Route path="/timeline" element={page(<TimelinePage/>, 'timeline')}/>
    <Route path="/search" element={page(<SearchPage/>, 'search')}/>
    <Route path="/friends" element={page(<FriendsPage/>, 'friends')}/>
    <Route path="/projects" element={page(<ProjectsPage/>)}/>
    <Route path="/about" element={page(<AboutPage owner={owner}/>)}/>
    <Route path="/about-site" element={page(<AboutSitePage/>)}/>
    <Route path="/:slug" element={page(<CustomPage/>)}/>
    <Route path="*" element={page(<NotFound/>)}/>
  </Routes>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><App/></BrowserRouter></React.StrictMode>)
