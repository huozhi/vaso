'use client'

import { useEffect, useRef, useState } from 'react'
import { Shape, shapeBounds, unionBounds } from '../engine'
import { GlassLayer, RenderFn } from '../glass-layer'
import { Ghost, Hint, placeGhost, Spring, useIdle, useTried } from '../ui'

const MAX_MATCHES = 60
/** Debounce before glass moves after typing, and after deleting */
const TYPE_DELAY = 140
const DELETE_DELAY = 700
const BAR_H = 56

type Highlight = {
  key: string
  x: Spring
  y: Spring
  w: Spring
  h: Spring
  /** Seconds before it leaves the search field, so matches stream out one after another */
  delay: number
  born: number
  dying: boolean
}

// The demo searches by itself until someone takes over
const SCRIPT = ['glass', 'water', 'light']

export function LiquidSearch() {
  const stageRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const idle = useIdle(stageRef)
  const tried = useTried(stageRef)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const state = useRef({
    open: new Spring(0, 170, 17),
    highlights: new Map<string, Highlight>(),
    targets: [] as { key: string; x: number; y: number; w: number; h: number }[],
    origin: { x: 0, y: 0 },
    focused: false,
    last: 0,
    highlightLast: 0,
    now: 0,
    script: { step: -1, query: '', open: false },
  })

  // Find every match in the article and measure where it sits on the stage
  const measure = (q: string) => {
    const article = articleRef.current
    const stage = stageRef.current
    if (!article || !stage) return
    const targets: typeof state.current.targets = []
    const needle = q.trim().toLowerCase()
    if (needle) {
      const base = stage.getBoundingClientRect()
      const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT)
      let node: Node | null
      let n = 0
      while ((node = walker.nextNode()) && targets.length < MAX_MATCHES) {
        const text = node.textContent!.toLowerCase()
        let at = text.indexOf(needle)
        while (at >= 0 && targets.length < MAX_MATCHES) {
          const range = document.createRange()
          range.setStart(node, at)
          range.setEnd(node, at + needle.length)
          for (const rect of Array.from(range.getClientRects())) {
            targets.push({
              key: `${n}:${at}:${Math.round(rect.top)}`,
              x: rect.left - base.left + rect.width / 2,
              y: rect.top - base.top + rect.height / 2,
              w: rect.width + 10,
              h: rect.height + 4,
            })
          }
          at = text.indexOf(needle, at + needle.length)
        }
        n++
      }
    }
    state.current.targets = targets
    setCount(targets.length)
  }

  // Debounced: typing settles quickly, deleting waits. While someone backspaces, the glass stays on the
  // last matches instead of chasing every shorter, broader query
  const applied = useRef('')
  useEffect(() => {
    const extending = query.toLowerCase().startsWith(applied.current.toLowerCase()) && query.length > applied.current.length
    const timer = setTimeout(() => {
      applied.current = query
      measure(query)
    }, extending ? TYPE_DELAY : DELETE_DELAY)
    return () => clearTimeout(timer)
  }, [query])
  useEffect(() => {
    const ro = new ResizeObserver(() => measure(applied.current))
    ro.observe(stageRef.current!)
    return () => ro.disconnect()
  }, [])

  const openSearch = () => {
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
  }
  const closeSearch = () => {
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  const render: RenderFn = (t, { width: W, height: H }) => {
    const s = state.current
    const dt = Math.min(0.05, t - (s.last || t))
    s.last = t
    s.now = t

    // Autoplay: open, type a word, let the highlights land, clear it, try the next word, close
    const auto = idle.auto() && !s.focused && !idle.state.current.reduced
    const narrow = W < 640
    // Toolbar plus the search button beside it, centered together and kept inside the stage
    const tw = Math.min(360, narrow ? W - 32 - 16 - BAR_H : W * 0.5)
    const startX = (W - (tw + 16 + BAR_H)) / 2
    const cx = startX + tw / 2
    const y = H - 52
    const searchClosed = { x: startX + tw + 16 + BAR_H / 2, r: BAR_H / 2 }
    if (auto) {
      const cycle = t % 13
      let q = ''
      let isOpen = cycle > 1.1 && cycle < 12
      const word = SCRIPT[Math.floor(t / 13) % SCRIPT.length]
      if (cycle > 1.6 && cycle < 9.5) q = word.slice(0, Math.floor((cycle - 1.6) / 0.16))
      if (cycle >= 9.5 && cycle < 11) q = word.slice(0, Math.max(0, word.length - Math.floor((cycle - 9.5) / 0.08)))
      const key = `${isOpen}|${q}`
      if (key !== `${s.script.open}|${s.script.query}`) {
        s.script = { step: 0, query: q, open: isOpen }
        setOpen(isOpen)
        setQuery(q)
      }
      const ghostOn = cycle > 0.2 && cycle < 1.5
      placeGhost(ghostRef.current, searchClosed.x + 6, y + 4, cycle > 0.9 && cycle < 1.2, ghostOn)
    } else {
      placeGhost(ghostRef.current, 0, 0, false, false)
    }

    // Closed: a toolbar with a search button beside it. Open: the toolbar folds into a back button and the
    // search button stretches into a field. The smooth union makes the hand-off liquid
    s.open.target = open ? 1 : 0
    s.open.step(dt)
    const o = Math.min(Math.max(s.open.value, -0.1), 1.1)
    const left = cx - tw / 2
    const backW = BAR_H
    const toolbar: Shape = {
      kind: 'rect',
      x: left + (tw / 2) * (1 - o) + (backW / 2) * o,
      y,
      w: Math.max(BAR_H, tw * (1 - o) + backW * o),
      h: BAR_H,
      r: BAR_H / 2,
    }
    const fieldLeft = left + backW + 12
    const fieldRight = searchClosed.x + searchClosed.r
    const searchW = BAR_H + (fieldRight - fieldLeft - BAR_H) * o
    const search: Shape = { kind: 'rect', x: fieldRight - searchW / 2, y, w: searchW, h: BAR_H, r: BAR_H / 2 }
    s.origin = { x: search.x, y }

    const commit = () => {
      const tb = toolbarRef.current
      if (tb) {
        tb.style.transform = `translate(${left}px, ${y - BAR_H / 2}px)`
        tb.style.width = `${tw}px`
        tb.style.setProperty('--open', String(Math.min(Math.max(o, 0), 1)))
      }
      const sr = searchRef.current
      if (sr) {
        sr.style.transform = `translate(${search.x - searchW / 2}px, ${y - BAR_H / 2}px)`
        sr.style.width = `${searchW}px`
        sr.style.setProperty('--open', String(Math.min(Math.max(o, 0), 1)))
      }
    }

    return {
      shapes: [toolbar, search],
      k: 34,
      bounds: unionBounds([shapeBounds(toolbar), shapeBounds(search)]),
      bezel: 20,
      strength: 20,
      dispersion: 0.18,
      light: { x: W * 0.2, y: -H * 0.4 },
      look: { tint: 0.12, rim: 0.85, glow: 0.4, shadow: 0.24 },
      commit,
    }
  }

  // Highlights: each match gets a small lens that streams out of the search field to its word
  const renderHighlights: RenderFn = (t) => {
    const s = state.current
    const dt = Math.min(0.05, t - (s.highlightLast || t))
    s.highlightLast = t
    const live = new Set<string>()
    s.targets.forEach((target, i) => {
      live.add(target.key)
      let h = s.highlights.get(target.key)
      if (!h) {
        const spring = (v: number) => new Spring(v, 150, 15)
        h = {
          key: target.key,
          x: spring(s.origin.x),
          y: spring(s.origin.y),
          w: spring(16),
          h: spring(16),
          delay: Math.min(i, 24) * 0.03,
          born: t,
          dying: false,
        }
        s.highlights.set(target.key, h)
      }
      h.dying = false
      if (t - h.born >= h.delay) {
        h.x.target = target.x
        h.y.target = target.y
        h.w.target = target.w
        h.h.target = target.h
      }
    })
    const shapes: Shape[] = []
    for (const h of s.highlights.values()) {
      if (!live.has(h.key)) {
        // A match that's gone shrinks away where it stood
        h.dying = true
        h.w.target = 0
        h.h.target = 0
      }
      for (const sp of [h.x, h.y, h.w, h.h]) sp.step(dt)
      if (h.dying && h.w.value < 2) {
        s.highlights.delete(h.key)
        continue
      }
      if (t - h.born < h.delay) continue
      const w = Math.max(0, h.w.value)
      const hh = Math.max(0, h.h.value)
      shapes.push({ kind: 'rect', x: h.x.value, y: h.y.value, w, h: hh, r: Math.min(w, hh) / 2 })
    }
    if (!shapes.length) return { shapes: [], bounds: [0, 0, 0, 0], bezel: 8, strength: 0, mapKey: 'empty', specKey: 'empty' }
    return {
      shapes,
      k: 14,
      bounds: unionBounds(shapes.map(shapeBounds)),
      bezel: 9,
      strength: 9,
      light: { x: 0, y: -400 },
      look: { tint: 0.18, rim: 1, glow: 0.35, shadow: 0.3, sheen: 0.25 },
    }
  }

  return (
    <div ref={stageRef} className="lab-stage lab-merge">
      <Editorial ref={articleRef} />
      <GlassLayer render={renderHighlights} className="lab-fill" prism={false} />
      <GlassLayer render={render} className="lab-fill">
        <div ref={toolbarRef} className="lab-toolbar">
          <button className="lab-back" aria-label="Close search" onClick={closeSearch} tabIndex={open ? 0 : -1}>
            ‹
          </button>
          <button className="lab-url" onClick={openSearch} tabIndex={open ? -1 : 0} aria-label="Search the article">
            vaso.dev/lab
          </button>
        </div>
        <div ref={searchRef} className="lab-search">
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
              state.current.focused = true
              idle.touch()
            }}
            onBlur={() => (state.current.focused = false)}
            onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
          />
          <span className="lab-count">{query ? count : ''}</span>
        </div>
      </GlassLayer>
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
