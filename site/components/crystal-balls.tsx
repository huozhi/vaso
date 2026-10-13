'use client'

import { useEffect, useRef, useState } from 'react'
import { Vaso } from 'vaso'
import { useGlassTuning } from '../contexts/glass-context'

const BALLS = [
  { image: 'https://github.com/huozhi.png?size=256', label: 'Huozhi', left: 9, size: 82, height: 234, delay: 0, vx: -95 },
  { image: 'https://images.unsplash.com/photo-1693051177268-6ad61ebc92a2?w=400&h=400&fit=crop&q=82', label: 'Alpine lake', left: 24, size: 94, height: 272, delay: 0.07, vx: 75 },
  { image: 'https://images.unsplash.com/photo-1719531325944-4847e2d3e8a3?w=400&h=400&fit=crop&q=82', label: 'Forest', left: 38, size: 76, height: 214, delay: 0.14, vx: -85 },
  { image: 'https://images.unsplash.com/photo-1721833963573-0bf0454d6a97?w=400&h=400&fit=crop&q=82', label: 'Desert', left: 53, size: 88, height: 252, delay: 0.21, vx: 105 },
  { image: 'https://images.unsplash.com/photo-1757392294232-274ea574dc17?w=400&h=400&fit=crop&q=82', label: 'Ocean cliffs', left: 66, size: 68, height: 194, delay: 0.28, vx: -115 },
  { image: 'https://images.unsplash.com/photo-1512005654819-3e01846b1a16?w=400&h=400&fit=crop&q=82', label: 'Waterfall', left: 78, size: 72, height: 263, delay: 0.35, vx: 90 },
  { image: 'https://images.unsplash.com/photo-1682547095505-aefe40454fac?w=400&h=400&fit=crop&q=82', label: 'Aurora', left: 88, size: 64, height: 223, delay: 0.42, vx: -70 },
  { image: 'https://images.unsplash.com/photo-1475092432448-fe76c45a8d6d?w=400&h=400&fit=crop&q=82', label: 'Autumn stream', left: 46, size: 62, height: 285, delay: 0.49, vx: 65 },
] as const

const FLOOR_HEIGHT = 36

type Body = { x: number; y: number; vx: number; vy: number; angle: number; radius: number }
type PermissionedSensor = { requestPermission?: () => Promise<'granted' | 'denied'> }

export function CrystalBalls() {
  const tuning = useGlassTuning()
  const stageRef = useRef<HTMLDivElement>(null)
  const ballRefs = useRef<(HTMLDivElement | null)[]>([])
  const cornerRefs = useRef<(HTMLButtonElement | null)[]>([])
  const burstRef = useRef<() => void>(() => {})
  const enableMotionRef = useRef<() => Promise<void>>(async () => {})
  const [motionStatus, setMotionStatus] = useState<'unavailable' | 'ready' | 'enabled' | 'denied'>('unavailable')

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const bodies: Body[] = BALLS.map((ball) => ({ x: 0, y: 0, vx: 0, vy: 0, angle: 0, radius: ball.size / 2 }))
    let frame = 0
    let start = 0
    let previous = 0
    let tilt = 0
    let deviceGravity: { x: number; y: number } | null = null
    let drag: { index: number; pointerId: number; offsetX: number; offsetY: number; time: number } | null = null
    let audioContext: AudioContext | null = null
    let lastSound = 0
    const soundTimes = new Map<string, number>()

    const unlockAudio = () => {
      if (!window.AudioContext) return
      audioContext ??= new AudioContext()
      if (audioContext.state === 'suspended') void audioContext.resume()
    }
    const playCollision = (speed: number, key: string, tone: number) => {
      if (!audioContext || audioContext.state !== 'running' || speed < 140) return
      const stamp = performance.now()
      if (stamp - lastSound < 28 || stamp - (soundTimes.get(key) ?? -Infinity) < 90) return
      lastSound = stamp
      soundTimes.set(key, stamp)
      const now = audioContext.currentTime
      const volume = clamp(speed / 1200, 0.14, 1) * 0.055
      const frequency = 720 + (tone % 6) * 85
      ;[
        { ratio: 1, volume: 1, decay: 0.3 },
        { ratio: 2.32, volume: 0.32, decay: 0.19 },
        { ratio: 3.41, volume: 0.13, decay: 0.12 },
      ].forEach((part) => {
        const oscillator = audioContext!.createOscillator()
        const gain = audioContext!.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency * part.ratio, now)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(volume * part.volume, now + 0.004)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + part.decay)
        oscillator.connect(gain)
        gain.connect(audioContext!.destination)
        oscillator.start(now)
        oscillator.stop(now + part.decay + 0.02)
      })
    }

    const bounds = () => ({ width: stage.clientWidth, height: stage.clientHeight - FLOOR_HEIGHT })
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
    const pointerPosition = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect()
      const dx = event.clientX - (rect.left + rect.width / 2)
      const dy = event.clientY - (rect.top + rect.height / 2)
      const cosine = Math.cos(tilt)
      const sine = Math.sin(tilt)
      return {
        x: dx * cosine + dy * sine + stage.clientWidth / 2,
        y: stage.clientHeight / 2 - (-dx * sine + dy * cosine) - FLOOR_HEIGHT,
      }
    }
    const paint = () => {
      bodies.forEach((body, index) => {
        const ball = ballRefs.current[index]
        if (ball) {
          ball.style.transform = `translate3d(${body.x - body.radius}px, ${body.radius - body.y}px, 0) rotate(${body.angle}deg)`
          ball.style.visibility = 'visible'
        }
      })
    }

    const collide = (width: number, height: number, sound = true) => {
      for (let pass = 0; pass < 3; pass++) {
        bodies.forEach((body, index) => {
          if (drag?.index === index) return
          const r = body.radius
          if (body.x < r || body.x > width - r) {
            if (sound) playCollision(Math.abs(body.vx), `${index}-side`, index)
            body.x = clamp(body.x, r, width - r)
            body.vx = Math.abs(body.vx) < 40 ? 0 : body.vx * -0.72
          }
          if (body.y > height - r) {
            if (sound) playCollision(Math.abs(body.vy), `${index}-top`, index)
            body.y = height - r
            body.vy = Math.min(0, body.vy) * -0.62
          }
          if (body.y < r) {
            if (sound) playCollision(Math.abs(body.vy), `${index}-floor`, index)
            body.y = r
            body.vy = Math.abs(body.vy) < 70 ? 0 : Math.abs(body.vy) * 0.57
            body.vx *= 0.96
          }
        })
        for (let i = 0; i < bodies.length; i++) {
          for (let j = i + 1; j < bodies.length; j++) {
            const a = bodies[i]
            const b = bodies[j]
            const dx = b.x - a.x
            const dy = b.y - a.y
            const distance = Math.hypot(dx, dy) || 0.001
            const overlap = a.radius + b.radius - distance
            if (overlap <= 0) continue
            const nx = dx / distance
            const ny = dy / distance
            const aHeld = drag?.index === i
            const bHeld = drag?.index === j
            const aShare = aHeld ? 0 : bHeld ? 1 : 0.5
            const bShare = bHeld ? 0 : aHeld ? 1 : 0.5
            a.x -= nx * overlap * aShare
            a.y -= ny * overlap * aShare
            b.x += nx * overlap * bShare
            b.y += ny * overlap * bShare
            const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
            if (relative >= 0) continue
            if (sound) playCollision(-relative, `${i}-${j}`, i + j)
            const impulse = -(1 + 0.78) * relative / (aShare + bShare)
            a.vx -= impulse * nx * aShare
            a.vy -= impulse * ny * aShare
            b.vx += impulse * nx * bShare
            b.vy += impulse * ny * bShare
          }
        }
      }
      bodies.forEach((body) => {
        body.x = clamp(body.x, body.radius, width - body.radius)
        body.y = clamp(body.y, body.radius, height - body.radius)
      })
    }

    const tick = (now: number) => {
      if (!start) start = now
      const dt = previous ? Math.min((now - previous) / 1000, 0.032) : 1 / 60
      previous = now
      const elapsed = (now - start) / 1000
      const { width, height } = bounds()
      let moving = !!drag
      for (let step = 0; step < 2; step++) {
        bodies.forEach((body, index) => {
          if (drag?.index === index || elapsed < BALLS[index].delay) return
          if (Math.abs(body.vx) + Math.abs(body.vy) > 0.1 || body.y > body.radius + 0.1) moving = true
          body.vx += (deviceGravity?.x ?? Math.sin(tilt)) * 2500 * dt / 2
          body.vy += (deviceGravity?.y ?? -Math.cos(tilt)) * 2500 * dt / 2
          body.x += body.vx * dt / 2
          body.y += body.vy * dt / 2
          body.angle += (body.vx / body.radius) * dt * 22
          if (body.y <= body.radius + 0.5) {
            body.vx *= Math.exp(-2.8 * dt / 2)
            if (Math.abs(body.vx) < 5 && Math.abs(deviceGravity?.x ?? Math.sin(tilt)) < 0.002) body.vx = 0
          }
        })
        collide(width, height)
        if (bodies.some((body) => Math.abs(body.vx) + Math.abs(body.vy) > 0.1 || body.y > body.radius + 0.5)) moving = true
      }
      paint()
      if (moving || elapsed < BALLS[BALLS.length - 1].delay) frame = requestAnimationFrame(tick)
      else frame = 0
    }

    const ensureRunning = () => {
      if (!frame) {
        previous = 0
        frame = requestAnimationFrame(tick)
      }
    }
    const reset = () => {
      const { width } = bounds()
      bodies.forEach((body, index) => {
        const ball = BALLS[index]
        body.x = width * ball.left / 100
        body.y = body.radius + (reducedMotion ? 0 : ball.height)
        body.vx = reducedMotion ? 0 : ball.vx
        body.vy = 0
        body.angle = 0
      })
      start = 0
      previous = 0
      paint()
      if (!reducedMotion) ensureRunning()
    }
    burstRef.current = () => {
      bodies.forEach((body, index) => {
        body.vx += (index - (bodies.length - 1) / 2) * 115 + (index % 2 ? 65 : -65)
        body.vy = Math.max(0, body.vy) + 900 + (index % 3) * 115
      })
      start = performance.now() - BALLS[BALLS.length - 1].delay * 1000
      ensureRunning()
    }

    const screenVector = (x: number, y: number) => {
      const angle = (screen.orientation?.angle ?? (window as Window & { orientation?: number }).orientation ?? 0) * Math.PI / 180
      return { x: x * Math.cos(angle) - y * Math.sin(angle), y: x * Math.sin(angle) + y * Math.cos(angle) }
    }
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta == null || event.gamma == null) return
      const vector = screenVector(Math.sin(event.gamma * Math.PI / 180), Math.sin(event.beta * Math.PI / 180))
      deviceGravity = { x: clamp(vector.x, -1, 1), y: -clamp(vector.y, -1, 1) }
      ensureRunning()
    }
    const onMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.acceleration
      if (acceleration?.x == null || acceleration.y == null) return
      const vector = screenVector(acceleration.x, acceleration.y)
      if (Math.hypot(vector.x, vector.y) < 4) return
      bodies.forEach((body) => {
        body.vx += clamp(vector.x * 12, -180, 180)
        body.vy -= clamp(vector.y * 12, -180, 180)
      })
      ensureRunning()
    }
    const supported = 'DeviceOrientationEvent' in window && 'DeviceMotionEvent' in window
    if (supported) setMotionStatus('ready')
    enableMotionRef.current = async () => {
      if (!supported) return
      try {
        const orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & PermissionedSensor
        const motion = window.DeviceMotionEvent as typeof DeviceMotionEvent & PermissionedSensor
        // Both requests must start in the same user gesture on iOS.
        const permissions = await Promise.all([
          orientation.requestPermission?.() ?? Promise.resolve('granted'),
          motion.requestPermission?.() ?? Promise.resolve('granted'),
        ])
        if (permissions.some((permission) => permission !== 'granted')) {
          setMotionStatus('denied')
          return
        }
        window.addEventListener('deviceorientation', onOrientation)
        window.addEventListener('devicemotion', onMotion)
        setMotionStatus('enabled')
      } catch {
        setMotionStatus('denied')
      }
    }

    const pointers = ballRefs.current.map((element, index) => {
      if (!element) return () => {}
      const down = (event: PointerEvent) => {
        if (drag) return
        const pointer = pointerPosition(event)
        const body = bodies[index]
        drag = {
          index, pointerId: event.pointerId,
          offsetX: body.x - pointer.x,
          offsetY: body.y - pointer.y,
          time: performance.now(),
        }
        element.setPointerCapture(event.pointerId)
        element.style.zIndex = '5'
        body.vx = 0
        body.vy = 0
        ensureRunning()
      }
      const move = (event: PointerEvent) => {
        if (drag?.index !== index || drag.pointerId !== event.pointerId) return
        const pointer = pointerPosition(event)
        const { width, height } = bounds()
        const body = bodies[index]
        const now = performance.now()
        const dt = Math.max(0.008, (now - drag.time) / 1000)
        const nextX = clamp(pointer.x + drag.offsetX, body.radius, width - body.radius)
        const nextY = clamp(pointer.y + drag.offsetY, body.radius, height - body.radius)
        body.vx = clamp((nextX - body.x) / dt, -1300, 1300)
        body.vy = clamp((nextY - body.y) / dt, -1300, 1300)
        body.x = nextX
        body.y = nextY
        drag.time = now
        collide(width, height)
        paint()
      }
      const up = (event: PointerEvent) => {
        if (drag?.index !== index || drag.pointerId !== event.pointerId) return
        if (performance.now() - drag.time > 90) {
          bodies[index].vx = 0
          bodies[index].vy = 0
        }
        drag = null
        element.style.zIndex = ''
        if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
        ensureRunning()
      }
      element.addEventListener('pointerdown', down)
      element.addEventListener('pointermove', move)
      element.addEventListener('pointerup', up)
      element.addEventListener('pointercancel', up)
      return () => {
        element.removeEventListener('pointerdown', down)
        element.removeEventListener('pointermove', move)
        element.removeEventListener('pointerup', up)
        element.removeEventListener('pointercancel', up)
      }
    })
    const corners = cornerRefs.current.map((element, index) => {
      if (!element) return () => {}
      let lift: { pointerId: number; startY: number; startTilt: number } | null = null
      const down = (event: PointerEvent) => {
        lift = { pointerId: event.pointerId, startY: event.clientY, startTilt: tilt }
        element.setPointerCapture(event.pointerId)
      }
      const move = (event: PointerEvent) => {
        if (lift?.pointerId !== event.pointerId) return
        const direction = index === 0 ? -1 : 1
        const degrees = clamp(lift.startTilt * 180 / Math.PI + (event.clientY - lift.startY) * direction * 0.22, -28, 28)
        tilt = degrees * Math.PI / 180
        stage.style.transform = `rotate(${degrees}deg)`
        ensureRunning()
      }
      const up = (event: PointerEvent) => {
        if (lift?.pointerId !== event.pointerId) return
        lift = null
        if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
      }
      const keydown = (event: KeyboardEvent) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown' && event.key !== 'Home') return
        event.preventDefault()
        const direction = index === 0 ? -1 : 1
        const degrees = event.key === 'Home' ? 0 : clamp(tilt * 180 / Math.PI + (event.key === 'ArrowDown' ? 4 : -4) * direction, -28, 28)
        tilt = degrees * Math.PI / 180
        stage.style.transform = `rotate(${degrees}deg)`
        ensureRunning()
      }
      element.addEventListener('pointerdown', down)
      element.addEventListener('pointermove', move)
      element.addEventListener('pointerup', up)
      element.addEventListener('pointercancel', up)
      element.addEventListener('keydown', keydown)
      return () => {
        element.removeEventListener('pointerdown', down)
        element.removeEventListener('pointermove', move)
        element.removeEventListener('pointerup', up)
        element.removeEventListener('pointercancel', up)
        element.removeEventListener('keydown', keydown)
      }
    })
    const resize = new ResizeObserver(() => {
      const { width, height } = bounds()
      collide(width, height, false)
      paint()
    })
    stage.addEventListener('pointerdown', unlockAudio)
    stage.addEventListener('keydown', unlockAudio)
    resize.observe(stage)
    reset()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      stage.removeEventListener('pointerdown', unlockAudio)
      stage.removeEventListener('keydown', unlockAudio)
      window.removeEventListener('deviceorientation', onOrientation)
      window.removeEventListener('devicemotion', onMotion)
      enableMotionRef.current = async () => {}
      if (audioContext) void audioContext.close()
      pointers.forEach((cleanup) => cleanup())
      corners.forEach((cleanup) => cleanup())
    }
  }, [])

  return (
    <div className="crystal-demo w-full">
      <div className="crystal-stage-wrap">
      <div ref={stageRef} className="crystal-stage" aria-label="Draggable crystal balls on a tilting table">
        <button ref={(node) => { cornerRefs.current[0] = node }} type="button" className="crystal-corner crystal-corner-left" aria-label="Lift left table corner; use up and down arrow keys to tilt" />
        <button ref={(node) => { cornerRefs.current[1] = node }} type="button" className="crystal-corner crystal-corner-right" aria-label="Lift right table corner; use up and down arrow keys to tilt" />
        {BALLS.map((ball, index) => (
          <div className="crystal-ball" key={ball.label} ref={(node) => { ballRefs.current[index] = node }} style={{ width: ball.size, height: ball.size }}>
            <img src={ball.image} alt={ball.label} draggable={false} />
            <Vaso
              radius={ball.size / 2}
              depth={5.5 + tuning.depth}
              blur={Math.max(0, 0.1 + tuning.blur)}
              dispersion={0.9 + tuning.dispersion}
              specular={0.9}
              style={{ position: 'absolute', inset: 0, borderRadius: '50%' }}
            />
          </div>
        ))}
        <Vaso
          className="crystal-floor"
          radius={18}
          depth={1.8 + tuning.depth}
          blur={Math.max(0, 0.2 + tuning.blur)}
          dispersion={0.35 + tuning.dispersion}
          specular={0.25}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: FLOOR_HEIGHT }}
        />
        <button className="crystal-launch theme-label" type="button" onClick={() => burstRef.current()} aria-label="弹飞全部小球">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 18V5m0 0-5 5m5-5 5 5" />
          </svg>
        </button>
        {motionStatus !== 'unavailable' && <button className="crystal-motion theme-label" type="button" onClick={() => void enableMotionRef.current()} disabled={motionStatus === 'enabled'}>
          {motionStatus === 'enabled' ? 'Motion enabled' : motionStatus === 'denied' ? 'Enable motion again' : 'Enable motion'}
        </button>}
      </div>
      </div>
    </div>
  )
}
