'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Vaso, VasoGroup } from 'vaso'
import { Ghost, Hint, placeGhost, useFrame, useIdle, useTried } from '../ui'

// Built only from the public API: a <VasoGroup> per set of glass that should merge, a <Vaso> per piece, and CSS
// transitions to move them. The group follows its members every frame, so the liquid necks come for free.

const MAX_MATCHES = 60
/** Debounce before glass moves after typing, and after deleting */
const TYPE_DELAY = 80
const DELETE_DELAY = 700
/** How long a highlight takes to shrink away before it's removed */
const LEAVE_MS = 450

// The demo searches by itself until someone takes over
const SCRIPT = ['glass', 'water', 'light']

type Mark = { key: string; x: number; y: number; w: number; h: number; phase: 'enter' | 'in' | 'leave'; order: number }

/** Every match of `query` in `article`, measured relative to `stage` */
function findMatches(article: HTMLElement, stage: HTMLElement, query: string) {
  const needle = query.trim().toLowerCase()
  const found: Omit<Mark, 'phase' | 'order'>[] = []
  if (!needle) return found
  const base = stage.getBoundingClientRect()
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT)
  let node: Node | null
  let n = 0
  while ((node = walker.nextNode()) && found.length < MAX_MATCHES) {
    const text = node.textContent!.toLowerCase()
    for (let at = text.indexOf(needle); at >= 0 && found.length < MAX_MATCHES; at = text.indexOf(needle, at + needle.length)) {
      const range = document.createRange()
      range.setStart(node, at)
      range.setEnd(node, at + needle.length)
      for (const rect of Array.from(range.getClientRects())) {
        found.push({
          key: `${n}:${at}:${Math.round(rect.top)}`,
          x: rect.left - base.left - 5,
          y: rect.top - base.top - 2,
          w: rect.width + 10,
          h: rect.height + 4,
        })
      }
    }
    n++
  }
  return found
}

export function LiquidSearch() {
  const stageRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const idle = useIdle(stageRef)
  const tried = useTried(stageRef)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [marks, setMarks] = useState<Mark[]>([])
  const applied = useRef('')
  const origin = useRef({ x: 0, y: 0 })
  const focused = useRef(false)
  const script = useRef('')

  // Matches stream out of the search field: new ones start there and travel to their word, gone ones shrink away
  const place = (q: string) => {
    const stage = stageRef.current
    const article = articleRef.current
    if (!stage || !article) return
    const found = findMatches(article, stage, q)
    const search = searchRef.current?.getBoundingClientRect()
    const base = stage.getBoundingClientRect()
    if (search) origin.current = { x: search.left - base.left + search.width / 2, y: search.top - base.top + search.height / 2 }
    setMarks((prev) => {
      const next: Mark[] = []
      const keep = new Set(found.map((f) => f.key))
      found.forEach((f, order) => {
        const had = prev.find((m) => m.key === f.key && m.phase !== 'leave')
        next.push({ ...f, phase: had ? 'in' : 'enter', order })
      })
      for (const m of prev) if (!keep.has(m.key) && m.phase !== 'leave') next.push({ ...m, phase: 'leave' })
      return next
    })
  }

  // Debounced: typing settles quickly, deleting waits, so backspacing doesn't drag the glass across the page
  useEffect(() => {
    const extending = query.toLowerCase().startsWith(applied.current.toLowerCase()) && query.length > applied.current.length
    const timer = setTimeout(() => {
      applied.current = query
      place(query)
    }, extending ? TYPE_DELAY : DELETE_DELAY)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const ro = new ResizeObserver(() => place(applied.current))
    ro.observe(stageRef.current!)
    return () => ro.disconnect()
  }, [])

  // One frame after entering at the search field, send each new highlight to its word; drop the ones that left
  useLayoutEffect(() => {
    if (marks.some((m) => m.phase === 'enter')) {
      const frame = requestAnimationFrame(() => setMarks((all) => all.map((m) => (m.phase === 'enter' ? { ...m, phase: 'in' } : m))))
      return () => cancelAnimationFrame(frame)
    }
    if (marks.some((m) => m.phase === 'leave')) {
      const timer = setTimeout(() => setMarks((all) => all.filter((m) => m.phase !== 'leave')), LEAVE_MS)
      return () => clearTimeout(timer)
    }
  }, [marks])

  const openSearch = () => {
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
  }
  const closeSearch = () => {
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  // Autoplay: open, type a word, let the highlights land, clear it, try the next word, close
  useFrame(stageRef, (t) => {
    if (!idle.auto() || focused.current || idle.state.current.reduced) {
      placeGhost(ghostRef.current, 0, 0, false, false)
      return
    }
    const cycle = t % 13
    const word = SCRIPT[Math.floor(t / 13) % SCRIPT.length]
    let q = ''
    if (cycle > 1.6 && cycle < 9.5) q = word.slice(0, Math.floor((cycle - 1.6) / 0.16))
    if (cycle >= 9.5 && cycle < 11) q = word.slice(0, Math.max(0, word.length - Math.floor((cycle - 9.5) / 0.08)))
    const isOpen = cycle > 1.1 && cycle < 12
    const key = `${isOpen}|${q}`
    if (key !== script.current) {
      script.current = key
      setOpen(isOpen)
      setQuery(q)
    }
    const search = searchRef.current?.getBoundingClientRect()
    const stage = stageRef.current?.getBoundingClientRect()
    if (search && stage) {
      const x = search.left - stage.left + 28
      const y = search.top - stage.top + 30
      placeGhost(ghostRef.current, x, y, cycle > 0.9 && cycle < 1.2, cycle > 0.2 && cycle < 1.5)
    }
  })

  return (
    <div ref={stageRef} className="lab-stage lab-merge">
      <Editorial ref={articleRef} />

      {/* Highlights: one glass per match, all in one group so neighbours melt together */}
      <VasoGroup className="lab-fill lab-passthrough" smooth={14} depth={0.9} blur={0} dispersion={false} specular={0.8}>
        {marks.map((m) => {
          const at = m.phase === 'enter' ? { x: origin.current.x - 8, y: origin.current.y - 8, w: 16, h: 16 } : m
          const size = m.phase === 'leave' ? { w: 0, h: 0 } : { w: at.w, h: at.h }
          const x = m.phase === 'leave' ? m.x + m.w / 2 : at.x
          const y = m.phase === 'leave' ? m.y + m.h / 2 : at.y
          return (
            <Vaso
              key={m.key}
              className="lab-mark"
              style={{
                position: 'absolute',
                width: size.w,
                height: size.h,
                transform: `translate(${x}px, ${y}px)`,
                transitionDelay: m.phase === 'in' ? `${Math.min(m.order, 24) * 30}ms` : '0ms',
              }}
            />
          )
        })}
      </VasoGroup>

      {/* The bar: a toolbar and a search button that trade places. Their widths transition in CSS; the group
          turns the overlap into one liquid shape */}
      <VasoGroup className="lab-fill lab-passthrough" smooth={34} depth={1.2} blur={0.3} dispersion={0.3} light="pointer">
        <div className="lab-bar-row" data-open={open || undefined}>
          <Vaso className="lab-toolbar" style={{ position: 'absolute' }}>
            {/* Content clips inside; clipping the <Vaso> itself would also cut off its rim and shadow */}
            <div className="lab-bar-content">
            <button className="lab-back" aria-label="Close search" onClick={closeSearch} tabIndex={open ? 0 : -1}>
              ‹
            </button>
            <button className="lab-url" onClick={openSearch} tabIndex={open ? -1 : 0} aria-label="Search the article">
              vaso.dev/lab
            </button>
            </div>
          </Vaso>
          <Vaso ref={searchRef} className="lab-search" style={{ position: 'absolute' }}>
            <div className="lab-bar-content">
            <button className="lab-search-icon" aria-label="Search" onClick={() => (open ? inputRef.current?.focus() : openSearch())}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="6.5" />
                <path d="M16 16l4 4" />
              </svg>
            </button>
            <input
              ref={inputRef}
              value={query}
              placeholder="Search"
              spellCheck={false}
              tabIndex={open ? 0 : -1}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                focused.current = true
                idle.touch()
              }}
              onBlur={() => (focused.current = false)}
              onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
            />
            <span className="lab-count">{query ? marks.filter((m) => m.phase !== 'leave').length : ''}</span>
            </div>
          </Vaso>
        </div>
      </VasoGroup>

      <Ghost ref={ghostRef} />
      <Hint done={tried} placement="top">Search the article</Hint>
    </div>
  )
}

const Editorial = ({ ref }: { ref: React.Ref<HTMLElement> }) => (
  <article ref={ref} className="lab-editorial">
    <header>
      <span>No. 07</span>
      <strong>The Surface Tension</strong>
      <span>Autumn 2026</span>
    </header>
    <h3>Water doesn't like edges, and neither should glass.</h3>
    <div className="lab-columns">
      <p>
        Bring two drops of water close and the surface between them thins, bends and gives way. The new glass
        behaves the same: a button peels off its bar, and melts back in.
      </p>
      <figure>
        <img src="/flower.jpg" alt="" draggable={false} />
      </figure>
      <p>
        Light bends where glass is curved and passes straight where it is flat. That is all a lens is: a little
        water, a little light, and an edge that refuses to be sharp.
      </p>
      <p>
        Under the glass is still the page itself — live, selectable text, bent by a few hundred lines of optics.
      </p>
    </div>
  </article>
)
