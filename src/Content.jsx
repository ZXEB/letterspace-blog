import React from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

const safeUrl = (url) => typeof url === 'string' && /^(https?:\/\/|mailto:|\/|#)/i.test(url) && !url.startsWith('//') ? url : undefined

function LexicalNode({ node }) {
  if (!node || typeof node !== 'object') return null
  const children = node.children?.map((child, i) => <LexicalNode key={i} node={child}/>)
  if (node.type === 'text' || node.type === 'code-highlight') {
    let text = node.text || ''
    const format = Number(node.format) || 0
    if (format & 16) text = <code>{text}</code>
    if (format & 1) text = <strong>{text}</strong>
    if (format & 2) text = <em>{text}</em>
    if (format & 4) text = <s>{text}</s>
    if (format & 8) text = <u>{text}</u>
    if (format & 32) text = <sub>{text}</sub>
    if (format & 64) text = <sup>{text}</sup>
    return text
  }
  switch (node.type) {
    case 'root': return <>{children}</>
    case 'paragraph': return <p>{children || <br/>}</p>
    case 'heading': { const Tag = /^h[1-6]$/.test(node.tag) ? node.tag : 'h2'; return <Tag>{children}</Tag> }
    case 'quote': return <blockquote>{children}</blockquote>
    case 'list': return node.listType === 'number' ? <ol start={node.start || 1}>{children}</ol> : <ul>{children}</ul>
    case 'listitem': return <li>{typeof node.checked === 'boolean' && <input type="checkbox" checked={node.checked} readOnly aria-label="任务状态"/>}{children}</li>
    case 'link': case 'autolink': return <a href={safeUrl(node.url)} rel="noreferrer">{children}</a>
    case 'linebreak': return <br/>
    case 'horizontalrule': return <hr/>
    case 'code': return <pre><code>{children || node.code || node.text}</code></pre>
    case 'image': return <figure><img src={safeUrl(node.src)} alt={node.altText || node.alt || ''} loading="lazy"/>{node.caption && typeof node.caption === 'string' && <figcaption>{node.caption}</figcaption>}</figure>
    case 'table': return <div className="table-scroll"><table><tbody>{children}</tbody></table></div>
    case 'tablerow': return <tr>{children}</tr>
    case 'tablecell': return node.headerState ? <th colSpan={node.colSpan || 1}>{children}</th> : <td colSpan={node.colSpan || 1}>{children}</td>
    default: return <>{children || (typeof node.text === 'string' ? node.text : null)}</>
  }
}

export function Content({ document }) {
  const format = document?.content_format || document?.contentFormat
  const lexical = React.useMemo(() => {
    if (format !== 'lexical' || !document?.content) return null
    try { const parsed = typeof document.content === 'string' ? JSON.parse(document.content) : document.content; return parsed.root || null } catch { return null }
  }, [format, document?.content])
  const html = React.useMemo(() => DOMPurify.sanitize(marked.parse(typeof document?.text === 'string' ? document.text : '')), [document?.text])
  // Mix Space also saves Markdown text for rich documents. Use it as the full
  // fallback for editor-specific nodes, never render serialized JSON as prose.
  if (format === 'lexical' && !document?.text && lexical) return <div className="prose"><LexicalNode node={lexical}/></div>
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html || '<p>暂无正文。</p>' }}/>
}
