'use client'

import { useEffect, useRef } from 'react'
import { sdRoundRect } from '../engine'
import { Vaso } from 'vaso'
import { GlassLayer, RenderFn } from '../glass-layer'
import { PHOTOS } from '../photos'
import { Hint, useIdle, useTried } from '../ui'

type Item =
  | { kind: 'photo'; src: string; caption: string }
  | { kind: 'card'; tone: 'light' | 'dark'; title: string; body: string }

const FEED: Item[] = [
  { kind: 'photo', src: PHOTOS.desert, caption: 'Dunes at noon' },
  { kind: 'card', tone: 'dark', title: 'Night mode', body: 'Dark page, light ink.' },
  { kind: 'photo', src: PHOTOS.alpine, caption: 'Alpine lake' },
  { kind: 'photo', src: PHOTOS.forest, caption: 'Under the canopy' },
  { kind: 'card', tone: 'light', title: 'Paper white', body: 'Bright page, dark ink.' },
  { kind: 'photo', src: PHOTOS.aurora, caption: 'Aurora' },
  { kind: 'photo', src: PHOTOS.waterfall, caption: 'Waterfall' },
  { kind: 'card', tone: 'dark', title: 'Hysteresis', body: 'No flicker on busy photos.' },
  { kind: 'photo', src: PHOTOS.cliffs, caption: 'Ocean cliffs' },
]

const PHOTO_H = 250
const CARD_H = 170
const ROWS = 16
const NAV_TOP = 12
const NAV_H = 52
const TAB_BOTTOM = 16
const TAB_H = 60
/** Room around each bar for its shadow */
const MARGIN = 14
const THUMB_W = 18
const THUMB_H = 72
const heightOf = (item: Item) => (item.kind === 'photo' ? PHOTO_H : CARD_H)
const TOTAL = FEED.reduce((sum, item) => sum + heightOf(item), 0)

/** Row-by-row luminance of each feed item: photos are measured once they load, cards are known */
function useLuminance() {
  const rows = useRef<number[][]>(
    FEED.map((item) => new Array(ROWS).fill(item.kind === 'card' ? (item.tone === 'light' ? 0.94 : 0.07) : 0.5)),
  )
  useEffect(() => {
    FEED.forEach((item, index) => {
      if (item.kind !== 'photo') return
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = 24
          canvas.height = ROWS
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!
          // Match object-fit: cover for a wide, short tile
          const aspect = 360 / PHOTO_H
          const sh = Math.min(img.height, img.width / aspect)
          ctx.drawImage(img, 0, (img.height - sh) / 2, img.width, sh, 0, 0, 24, ROWS)
          const data = ctx.getImageData(0, 0, 24, ROWS).data
          const lin = (v: number) => {
            v /= 255
            return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
          }
          for (let y = 0; y < ROWS; y++) {
            let sum = 0
            for (let x = 0; x < 24; x++) {
              const o = (y * 24 + x) * 4
              const L = 0.2126 * lin(data[o]) + 0.7152 * lin(data[o + 1]) + 0.0722 * lin(data[o + 2])
              // Perceived lightness, 0-1
              sum += L <= 0.008856 ? L * 9.033 : 1.16 * Math.cbrt(L) - 0.16
            }
            rows.current[index][y] = sum / 24
          }
        } catch {
          // Cross-origin images without CORS can't be read; keep the neutral guess
        }
      }
      img.src = item.src
    })
  }, [])
  return rows
}

function luminanceAt(rows: number[][], from: number, to: number) {
  let sum = 0
  let weight = 0
  let y = 0
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < FEED.length; i++) {
      const h = heightOf(FEED[i])
      const top = y
      y += h
      if (y < from || top > to) continue
      for (let r = 0; r < ROWS; r++) {
        const r0 = top + (r / ROWS) * h
        const r1 = top + ((r + 1) / ROWS) * h
        const overlap = Math.min(r1, to) - Math.max(r0, from)
        if (overlap > 0) {
          sum += rows[i][r] * overlap
          weight += overlap
        }
      }
    }
  }
  return weight ? sum / weight : 0.5
}

export function AdaptiveInk() {
  const stageRef = useRef<HTMLDivElement>(null)
  const phoneRef = useRef<HTMLDivElement>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const tabRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const idle = useIdle(phoneRef, 2500)
  const tried = useTried(phoneRef)
  const rows = useLuminance()
  const state = useRef({
    offset: 0,
    velocity: 0,
    last: 0,
    drag: null as null | { y: number; offset: number; t: number },
    ink: [0, 0, 0], // 0 = dark ink on light glass, 1 = light ink on dark glass
    mix: [0, 0, 0],
    shownInk: ['', '', ''],
    track: { top: 0, length: 1 },
  })

  useEffect(() => {
    const phone = phoneRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      state.current.velocity = 0
      state.current.offset += e.deltaY
    }
    phone.addEventListener('wheel', onWheel, { passive: false })
    return () => phone.removeEventListener('wheel', onWheel)
  }, [])

  // Scrolling and luminance sampling run on their own loop; the two glass layers just read the result
  useEffect(() => {
    let raf = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const s = state.current
      const t = now / 1000
      const dt = Math.min(0.05, t - (s.last || t))
      s.last = t
      const phone = phoneRef.current
      if (!phone) return
      const H = phone.clientHeight
      if (!s.drag) {
        if (idle.auto() && !idle.state.current.reduced) s.velocity += (38 - s.velocity) * Math.min(1, dt * 2)
        else s.velocity *= Math.pow(0.04, dt)
        s.offset += s.velocity * dt
      }
      const offset = ((s.offset % TOTAL) + TOTAL) % TOTAL
      if (feedRef.current) feedRef.current.style.transform = `translateY(${-offset}px)`

      // Scroll bar: the thumb travels between the two bars
      const trackTop = NAV_TOP + NAV_H + 10
      const trackLength = H - TAB_BOTTOM - TAB_H - 10 - trackTop - THUMB_H
      s.track = { top: trackTop, length: trackLength }
      const thumbY = trackTop + (offset / TOTAL) * trackLength
      if (thumbRef.current) thumbRef.current.style.transform = `translateY(${thumbY}px)`

      const spans = [
        [NAV_TOP, NAV_TOP + NAV_H],
        [H - TAB_BOTTOM - TAB_H, H - TAB_BOTTOM],
        [thumbY, thumbY + THUMB_H],
      ]
      spans.forEach(([from, to], i) => {
        const L = luminanceAt(rows.current, offset + from, offset + to)
        // Separate thresholds in each direction keep a busy backdrop from flickering the ink
        if (s.ink[i] === 0 && L < 0.42) s.ink[i] = 1
        else if (s.ink[i] === 1 && L > 0.6) s.ink[i] = 0
        s.mix[i] += (s.ink[i] - s.mix[i]) * Math.min(1, dt * 8)
        // Only touch the DOM when the ink actually flips
        const ink = s.ink[i] ? 'light' : 'dark'
        if (ink === s.shownInk[i]) return
        s.shownInk[i] = ink
        ;[navRef, tabRef, thumbRef][i].current?.setAttribute('data-ink', ink)
      })
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // A capsule filling its layer, inset by the shadow margin
  const barRender = (i: number): RenderFn => (_, { width: W, height: H }) => {
    const mix = state.current.mix[i]
    const hw = W / 2 - MARGIN
    const hh = H / 2 - MARGIN
    const shade = Math.round(255 - mix * 238)
    return {
      sdf: (x, y) => sdRoundRect(x, y, W / 2, H / 2, hw, hh, hh),
      bounds: [MARGIN, MARGIN, W - MARGIN, H - MARGIN],
      bezel: 16,
      strength: 14,
      dispersion: 0.2,
      frost: 0.8,
      light: { x: W * 0.2, y: -200 },
      look: { tint: 0.22 + 0.1 * mix, tintColor: [shade, shade, shade + 3 * mix], rim: 0.8, glow: 0.3, shadow: 0.2 },
      mapKey: `${W}x${H}`,
      specKey: mix.toFixed(2),
    }
  }

  // Dragging the thumb scrolls the feed directly
  const grabThumb = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const s = state.current
    const startY = e.clientY
    const startOffset = ((s.offset % TOTAL) + TOTAL) % TOTAL
    s.drag = { y: e.clientY, offset: s.offset, t: performance.now() }
    s.velocity = 0
    const onMove = (ev: PointerEvent) => {
      s.offset = startOffset + ((ev.clientY - startY) / s.track.length) * TOTAL
    }
    const onUp = () => {
      s.drag = null
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
  }

  return (
    <div ref={stageRef} className="lab-stage lab-adaptive">
      <div
        ref={phoneRef}
        className="lab-phone"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          state.current.drag = { y: e.clientY, offset: state.current.offset, t: performance.now() }
          state.current.velocity = 0
        }}
        onPointerMove={(e) => {
          const d = state.current.drag
          if (!d || e.target !== e.currentTarget && thumbRef.current?.contains(e.target as Node)) return
          const now = performance.now()
          const next = d.offset - (e.clientY - d.y)
          state.current.velocity = ((next - state.current.offset) / Math.max(1, now - d.t)) * 1000
          d.t = now
          state.current.offset = next
        }}
        onPointerUp={() => (state.current.drag = null)}
      >
        <div ref={feedRef} className="lab-feed">
          {[0, 1].map((copy) =>
            FEED.map((item, i) =>
              item.kind === 'photo' ? (
                <figure key={`${copy}-${i}`} style={{ height: PHOTO_H }}>
                  <img src={item.src} alt="" crossOrigin="anonymous" draggable={false} />
                  <figcaption>{item.caption}</figcaption>
                </figure>
              ) : (
                <div key={`${copy}-${i}`} className={`lab-card lab-card-${item.tone}`} style={{ height: CARD_H }}>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              ),
            ),
          )}
        </div>
        <GlassLayer
          render={barRender(0)}
          className="lab-bar-layer"
          prism={false}
          style={{ top: NAV_TOP - MARGIN, left: 12 - MARGIN, right: 12 - MARGIN, height: NAV_H + MARGIN * 2 }}
        >
          <div ref={navRef} className="lab-bar lab-nav" style={{ inset: MARGIN }}>
            <span>‹</span>
            <strong>Library</strong>
            <span>⋯</span>
          </div>
        </GlassLayer>
        <GlassLayer
          render={barRender(1)}
          className="lab-bar-layer"
          prism={false}
          style={{ bottom: TAB_BOTTOM - MARGIN, left: '50%', width: 260 + MARGIN * 2, marginLeft: -(130 + MARGIN), height: TAB_H + MARGIN * 2 }}
        >
          <div ref={tabRef} className="lab-bar lab-tabs" style={{ inset: MARGIN }}>
            {['M3 11l9-8 9 8v10H3z', 'M4 4h16v16H4z', 'M12 3a9 9 0 110 18 9 9 0 010-18z', 'M4 7h16M4 12h16M4 17h16'].map((d) => (
              <svg key={d} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                <path d={d} />
              </svg>
            ))}
          </div>
        </GlassLayer>
        {/* The scroll bar is a plain <Vaso>: the thumb refracts the feed and flips its tint like the bars */}
        <div ref={thumbRef} className="lab-thumb" data-ink="dark" onPointerDown={grabThumb}>
          <Vaso radius={10} depth={1.6} blur={0.2} dispersion={0.4} specular={0.9}>
            <div className="lab-thumb-fill" style={{ width: THUMB_W, height: THUMB_H }} />
          </Vaso>
        </div>
      </div>
      <Hint done={tried} placement="right">Scroll the feed</Hint>
    </div>
  )
}
