import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Eye, Link2, List, Sparkles } from 'lucide-react'
import { Content, plainContent } from './Content'
import { postTagName } from './posts'
import './post-reader.css'

const dateFormat = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

function useOutline(body) {
  const [headings, setHeadings] = React.useState([])
  const [active, setActive] = React.useState('')
  const [progress, setProgress] = React.useState(0)

  React.useLayoutEffect(() => {
    const content = body.current
    const elements = [...content.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(element => element.textContent.trim())
    const reserved = new Set([...document.querySelectorAll('[id]')].filter(element => !elements.includes(element)).map(element => element.id))
    const items = elements.map((element, index) => {
      let id = element.id || `section-${index + 1}`
      while (reserved.has(id)) id += '-heading'
      reserved.add(id)
      element.id = id
      return { id, label: element.textContent.trim(), level: Number(element.tagName.slice(1)) }
    })
    const firstLevel = Math.min(...items.map(item => item.level))
    setHeadings(items.map(item => ({ ...item, indent: Math.min(2, item.level - firstLevel) })))

    const findAnchor = () => elements.find(element => `#${encodeURIComponent(element.id)}` === window.location.hash)
    let frame = 0
    const measure = () => {
      frame = 0
      const rect = content.getBoundingClientRect()
      const travel = rect.height - window.innerHeight + 96
      const fraction = travel > 0 ? -rect.top / travel : Number(rect.bottom <= window.innerHeight)
      setProgress(Math.round(Math.min(1, Math.max(0, fraction)) * 100))
      const bottomLimit = document.documentElement.scrollHeight - window.innerHeight - window.scrollY <= 2
      const anchor = bottomLimit ? findAnchor() : null
      const anchorTop = anchor?.getBoundingClientRect().top
      const current = anchorTop >= 0 && anchorTop < window.innerHeight ? anchor
        : elements.findLast(element => element.getBoundingClientRect().top <= (bottomLimit ? window.innerHeight - 96 : 118)) || elements[0]
      setActive(current?.id || '')
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }
    const observer = new ResizeObserver(schedule)
    observer.observe(content)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('hashchange', schedule)

    const target = findAnchor()
    if (target) target.scrollIntoView({ behavior: 'instant' })
    measure()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('hashchange', schedule)
    }
  }, [body])

  return { headings, active, progress }
}

function OutlineLinks({ headings, active, onSelect }) {
  return <ul className="reader-outline-links">{headings.map(({ id, label, indent }) => (
    <li key={id} style={{ '--heading-indent': indent }}><a href={`#${encodeURIComponent(id)}`} onClick={onSelect} aria-current={active === id ? 'location' : undefined}>{label}</a></li>
  ))}</ul>
}

export default function PostReader({ post }) {
  const body = React.useRef(null)
  const copyInput = React.useRef(null)
  const mobileOutline = React.useRef(null)
  const { headings, active, progress } = useOutline(body)
  const [copyStatus, setCopyStatus] = React.useState('')
  const [copyUrl, setCopyUrl] = React.useState('')
  const written = new Date(post.created_at || NaN)
  const category = post.category?.name || '随笔'
  const categoryId = post.category?.id ?? post.category_id
  const summary = React.useMemo(() => plainContent(post.summary), [post.summary])
  const excerpt = React.useMemo(() => {
    if (summary) return ''
    const paragraphs = []
    for (const block of (post.text || '').split(/\n\s*\n/)) {
      if (/^\s{0,3}#{1,6}\s/.test(block)) continue
      const text = plainContent(block)
      if (text) paragraphs.push(text)
      if (text.length >= 160 || paragraphs.length === 3) break
    }
    const text = paragraphs.join(' ')
    return text.length > 160 ? `${text.slice(0, 160).trimEnd()}…` : text
  }, [summary, post.text])
  const intro = summary || excerpt
  const tags = [...new Set((post.tags || []).map(postTagName).filter(Boolean))]

  React.useEffect(() => {
    if (!copyUrl) return
    copyInput.current.focus({ preventScroll: true })
    copyInput.current.select()
  }, [copyUrl])

  async function share() {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopyStatus('已复制链接')
    } catch {
      setCopyUrl(url)
      setCopyStatus('请选择并复制链接')
      copyInput.current?.select()
    }
  }

  return <div className="reader-layout">
    <article className="reader-paper">
      <header className="reader-heading">
        <h1>{post.title}</h1>
        <div className="reader-meta">
          {Number.isFinite(written.getTime()) && <time dateTime={post.created_at}>{dateFormat.format(written)}</time>}
          {categoryId ? <Link to={`/posts?${new URLSearchParams({ category: categoryId })}`}>{category}</Link> : <span>{category}</span>}
          <span>{post.read_count || 0} 阅读</span>
          <span>{post.like_count || 0} 喜欢</span>
          <Eye size={12} aria-hidden="true"/>
        </div>
      </header>
      {intro && <section className="reader-summary" aria-label={summary ? '文章摘要' : '正文摘录'}>
        <span><Sparkles size={15} aria-hidden="true"/>{summary ? '文章摘要' : '正文摘录'}</span>
        <p>{intro}</p>
      </section>}
      {headings.length > 0 && <details className="reader-mobile-outline" ref={mobileOutline}>
        <summary aria-label="文章目录" title="文章目录"><List size={16} aria-hidden="true"/></summary>
        <OutlineLinks headings={headings} active={active} onSelect={() => { mobileOutline.current.open = false }}/>
      </details>}
      <div className="reader-content" ref={body}><Content document={post}/></div>
      <footer className="reader-end">
        {tags.length > 0 && <div className="reader-tags">{tags.map(tag => <Link key={tag} to={`/posts?${new URLSearchParams({ tag })}`}>#{tag}</Link>)}</div>}
        <Link className="back-link" to="/posts"><ArrowLeft size={15}/> 返回文稿</Link>
        <button className="reader-share" onClick={share}><Link2 size={15}/> 复制链接</button>
        <span className="reader-copy-status" role="status">{copyStatus}</span>
        {copyUrl && <input ref={copyInput} className="reader-copy-url" readOnly value={copyUrl} aria-label="文章链接" onFocus={event => event.target.select()}/>}
      </footer>
    </article>
    <aside className="reader-sidebar">
      {headings.length > 0 && <nav aria-label="文章目录"><OutlineLinks headings={headings} active={active}/></nav>}
      <div className="reader-progress" aria-label={`阅读进度 ${progress}%`}><span aria-hidden="true" style={{ '--reader-progress': `${progress}%` }}/>{progress}%</div>
    </aside>
  </div>
}
