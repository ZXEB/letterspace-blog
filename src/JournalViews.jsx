import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Clock3, Search } from 'lucide-react'
import { Content, plainContent } from './Content'
import { noteUrl } from './api'

const fullDate = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
const monthLabels = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
const englishMonth = new Intl.DateTimeFormat('en', { month: 'short' })

function groupBy(items, key) {
  const groups = new Map()
  for (const item of items) {
    const value = key(item)
    if (!groups.has(value)) groups.set(value, [])
    groups.get(value).push(item)
  }
  return [...groups]
}

function noteMeta(note) {
  const published = new Date(note.created_at || NaN)
  return <div className="letter-meta">
    {note.weather && <span>{note.weather}</span>}
    {note.mood && <span>{note.mood}</span>}
    {note.location && <span>{note.location}</span>}
    {Number.isFinite(published.getTime()) && <time dateTime={note.created_at}><Clock3 size={12} aria-hidden="true"/>{fullDate.format(published)}</time>}
  </div>
}

export function NotePaper({ note, preview = false }) {
  const paragraphs = preview && !note.has_password
    ? (note.text || '').split(/\n\s*\n/).slice(0, 5).map(text => plainContent(text).slice(0, 560)).filter(Boolean)
    : []

  return <article className={`letter-paper${preview ? ' featured-letter' : ''}`}>
    <header className="letter-heading">
      {preview && noteMeta(note)}
      <h1>{preview ? <Link to={noteUrl(note)}>{note.title || '手记'}</Link> : note.title || '手记'}</h1>
      {!preview && <div className="letter-details">{noteMeta(note)}<span>{note.read_count || 0} 阅读 · {note.like_count || 0} 喜欢</span></div>}
    </header>
    {note.has_password && !note.text ? <p className="letter-private">这篇手记需要密码。</p> : preview ? (
      <div className="prose letter-preview">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    ) : <Content document={note}/>}
    <footer className="letter-footer">
      {preview ? <><span>手记{note.nid ? ` №${note.nid}` : ''}</span><Link to={noteUrl(note)}>阅读全文 →</Link></> : <Link to="/notes"><ArrowLeft size={14}/> 返回手记</Link>}
    </footer>
  </article>
}

export function NoteArchive({ notes, page }) {
  const featured = page === 1 ? notes[0] : null
  const older = featured ? notes.slice(1) : notes
  const groups = groupBy(older, note => new Date(note.created_at).getFullYear())
  return <>
    {featured && <NotePaper note={featured} preview/>}
    {featured && older.length > 0 && <p className="letter-divider">更早的手记</p>}
    {groups.map(([year, entries]) => <section className="letter-year" key={year}>
      <header><h2>{Number.isFinite(year) ? year : '未注明年份'}</h2><span>{entries.length} 篇手记</span></header>
      {entries.map(note => {
        const written = new Date(note.created_at || NaN)
        const excerpt = note.has_password ? '' : plainContent(note.text).slice(0, 220)
        return <article className="letter-entry" key={note.id}>
          {Number.isFinite(written.getTime()) && <time dateTime={note.created_at}><strong>{String(written.getDate()).padStart(2, '0')}</strong><span>{monthLabels[written.getMonth()]}</span></time>}
          <div className="letter-card">
            {noteMeta(note)}
            <h3><Link to={noteUrl(note)}>{note.title || '日常手记'}</Link></h3>
            {excerpt && <p>{excerpt}</p>}
            <div className="letter-footer"><span>{note.nid ? `№${note.nid}` : ''}</span><Link to={noteUrl(note)}>阅读全文 →</Link></div>
          </div>
        </article>
      })}
    </section>)}
  </>
}

export function Timeline({ entries, page, compact, setCompact }) {
  const date = new Date()
  const year = date.getFullYear()
  const firstDay = new Date(year, 0, 1)
  const firstDayNextYear = new Date(year + 1, 0, 1)
  const midnight = new Date(year, date.getMonth(), date.getDate())
  const nextMidnight = new Date(year, date.getMonth(), date.getDate() + 1)
  const day = Math.round((midnight - firstDay) / 86400000) + 1
  const yearProgress = Math.floor(100 * (date - firstDay) / (firstDayNextYear - firstDay))
  const todayProgress = (100 * (date - midnight) / (nextMidnight - midnight)).toFixed(2)
  const years = groupBy(entries.slice((page - 1) * 20, page * 20), item => new Date(item.created_at).getFullYear())
  const counts = new Map(groupBy(entries, item => new Date(item.created_at).getFullYear()).map(([key, values]) => [key, values.length]))

  return <div className={compact ? 'chronology chronology-compact' : 'chronology'}>
    <header className="chronology-header">
      <div className="chronology-toolbar">
        <h1>时间线</h1>
        <div className="chronology-views">
          <button onClick={() => setCompact(false)} aria-pressed={!compact}>舒展</button>
          <button onClick={() => setCompact(true)} aria-pressed={compact}>紧凑</button>
          <Link to="/search"><Search size={14}/> 搜索</Link>
        </div>
      </div>
      <div className="chronology-count"><strong>{entries.length}</strong><span>篇</span></div>
      <dl className="chronology-stats">
        <div><dt>今年第几天</dt><dd>{day}</dd></div>
        <div><dt>年度进度</dt><dd>{yearProgress}<small>%</small></dd></div>
        <div><dt>今日进度</dt><dd>{todayProgress}<small>%</small></dd></div>
      </dl>
    </header>
    {years.map(([entryYear, items]) => <section className="chronology-year" key={entryYear}>
      <h2>{entryYear} <span>{counts.get(entryYear)} 篇</span></h2>
      {groupBy(items, item => new Date(item.created_at).getMonth()).map(([month, grouped]) => <section className="chronology-month" key={month}>
        <h3>{monthLabels[month]} · {englishMonth.format(new Date(entryYear, month, 1))}</h3>
        <ul>{grouped.map(item => <li key={`${item.kind}-${item.id}`}>
          <time dateTime={item.created_at}>{String(new Date(item.created_at).getDate()).padStart(2, '0')}</time>
          <Link to={item.to}>{item.title || '日常片段'}</Link>
          <span>{item.label ? `${item.label} · ` : ''}{item.kind}</span>
        </li>)}</ul>
      </section>)}
    </section>)}
    {!years.length && <p className="empty-state">这一页没有记录。</p>}
  </div>
}
