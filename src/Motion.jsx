import React from 'react'

const ease = 'cubic-bezier(.22, 1, .36, 1)'
const revealTargets = '.section-heading, .section-top, .writing-row, .small-note, .note-entry, .timeline-entry, .friend-entry, .project-entry, .writing-activity, .letter-cta, .article-header, .prose > *, .article-end, .empty-state, .filter-line, .search-form, .pagination'

export function CountUp({value, decimals = 0}) {
  const element = React.useRef(null)
  const previous = React.useRef(0)
  React.useLayoutEffect(() => {
    if (!Number.isFinite(value)) return
    const from = previous.current
    previous.current = value
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { element.current.textContent = value.toFixed(decimals); return }
    let frame = 0, start
    const tick = now => {
      start ??= now
      const progress = Math.min(1, (now - start) / 950)
      element.current.textContent = (from + (value - from) * (1 - Math.pow(1 - progress, 3))).toFixed(decimals)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, decimals])
  return <span ref={element} aria-label={Number.isFinite(value) ? String(value) : '载入中'}>{Number.isFinite(value) ? value.toFixed(decimals) : '—'}</span>
}

export function useReveal(container, route) {
  React.useLayoutEffect(() => {
    const root = container.current
    if (!root || !window.IntersectionObserver) return
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const seen = new WeakSet()
    const animations = new Set()
    const observer = new IntersectionObserver(entries => {
      const entering = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      entering.forEach(({target}, index) => {
        observer.unobserve(target)
        target.dataset.revealed = 'true'
        if (media.matches) return
        // Content stays readable until observed; there is no hidden/offscreen
        // state that can strand text when scripts or observers are interrupted.
        const animation = target.animate([
          {opacity: 0, transform: 'translate3d(0, 20px, 0)', filter: 'blur(4px)'},
          {opacity: 1, transform: 'translate3d(0, 0, 0)', filter: 'blur(0px)'},
        ], {duration: 680, delay: Math.min(index, 5) * 55, easing: ease, fill: 'backwards'})
        animations.add(animation)
        animation.finished.catch(() => {}).finally(() => animations.delete(animation))
      })
    }, {threshold: 0, rootMargin: '0px 0px -28px 0px'})
    const scan = () => root.querySelectorAll(revealTargets).forEach(element => {
      if (seen.has(element)) return
      seen.add(element)
      if (media.matches) element.dataset.revealed = 'true'
      else observer.observe(element)
    })
    const mutation = new MutationObserver(scan)
    mutation.observe(root, {childList: true, subtree: true})
    const reduce = () => { if (media.matches) { observer.disconnect(); animations.forEach(animation => animation.cancel()) } else scan() }
    media.addEventListener('change', reduce)
    scan()
    return () => { observer.disconnect(); mutation.disconnect(); media.removeEventListener('change', reduce); animations.forEach(animation => animation.cancel()) }
  }, [container, route])
}

export function useNavIndicator(navRef, dependency) {
  const hovered = React.useRef(null)
  const move = React.useCallback(element => {
    const nav = navRef.current
    if (!nav || !element) return
    nav.style.setProperty('--nav-x', `${element.offsetLeft}px`)
    nav.style.setProperty('--nav-y', `${element.offsetTop}px`)
    nav.style.setProperty('--nav-width', `${element.offsetWidth}px`)
    nav.style.setProperty('--nav-height', `${element.offsetHeight}px`)
    nav.dataset.indicator = 'ready'
  }, [navRef])
  const reset = React.useCallback(() => {
    hovered.current = null
    const active = navRef.current?.querySelector('a.active')
    if (active) move(active)
    else if (navRef.current) navRef.current.dataset.indicator = 'hidden'
  }, [move, navRef])
  React.useLayoutEffect(() => {
    reset()
    const observer = new ResizeObserver(() => move(hovered.current || navRef.current?.querySelector('a.active')))
    if (navRef.current) observer.observe(navRef.current)
    return () => observer.disconnect()
  }, [dependency, move, reset, navRef])
  return {
    onPointerOver: event => { const link = event.target.closest('a'); if (link) { hovered.current = link; move(link) } },
    onPointerLeave: reset,
    onFocusCapture: event => { const link = event.target.closest('a'); if (link) move(link) },
    onBlurCapture: event => { if (!event.currentTarget.contains(event.relatedTarget)) reset() },
  }
}

export function ReadingProgress({route}) {
  const bar = React.useRef(null)
  React.useEffect(() => {
    let frame = 0
    const update = () => {
      const article = document.querySelector('.reader-paper, .letter-paper:not(.featured-letter), .article-detail')
      const distance = article ? article.getBoundingClientRect().bottom + scrollY - innerHeight : 0
      const progress = distance > 0 ? Math.max(0, Math.min(1, scrollY / distance)) : 0
      if (bar.current) bar.current.style.transform = `scaleX(${progress})`
      frame = 0
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    const resize = new ResizeObserver(schedule)
    resize.observe(document.body)
    addEventListener('scroll', schedule, {passive: true})
    addEventListener('resize', schedule)
    update()
    return () => { cancelAnimationFrame(frame); resize.disconnect(); removeEventListener('scroll', schedule); removeEventListener('resize', schedule) }
  }, [route])
  return <div ref={bar} className="reading-progress" aria-hidden="true"/>
}
