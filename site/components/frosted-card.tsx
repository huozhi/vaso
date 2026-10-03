'use client'

import { useEffect, useRef, useState } from 'react'
import { useSpring } from '@react-spring/web'
import { Vaso } from 'vaso'
import { useGlassContext, useGlassTuning } from '../contexts/glass-context'
import { GlassButton } from './glass-button'

const FROSTED_VIDEO_SPEED = 2
// The MP4 version of the GIF, so the playback speed can be changed
const VIDEO_URL = 'https://media1.giphy.com/media/EzUMaltmsbK3G1Y5Ow/giphy.mp4'

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

const ICONS = [
  { label: 'Back', path: 'M19 12H5M12 19l-7-7 7-7' },
  { label: 'Folder', path: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z' },
  { label: 'Trash', path: 'M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6' },
]

// Icons pop a little on hover and squish when pressed
const ICON_BUTTON =
  'p-3 rounded-full cursor-pointer transition-transform duration-150 ease-out hover:scale-110 active:scale-90'

export function FrostedCard() {
  const { settings } = useGlassContext()
  const tuning = useGlassTuning()
  const [frostedGlass, setFrostedGlass] = useState(true)
  // 0 = clear glass, 1 = frosted; animated between the two
  const [frost, setFrost] = useState(1)
  const [time, setTime] = useState<string | null>(null)
  const [liked, setLiked] = useState(false)
  const [playing, setPlaying] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Metadata can load before hydration attaches onLoadedMetadata, so also apply the rate on mount
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = FROSTED_VIDEO_SPEED
  }, [])

  useEffect(() => {
    setTime(formatTime(new Date()))
    const timer = setInterval(() => setTime(formatTime(new Date())), 10_000)
    return () => clearInterval(timer)
  }, [])

  useSpring({
    frost: frostedGlass ? 1 : 0,
    config: {
      tension: 170,
      friction: 26,
      duration: 220,
    },
    easing: 'easeInOutCubic',
    onChange: ({ value }) => {
      setFrost(value.frost)
    },
  })

  // Every glass in the card follows the toggle. Clear: crisp and strongly refracting. Frosted: blurred, brighter rim
  const glass = {
    depth: 2.4 - frost * 1.2 + tuning.depth,
    blur: Math.max(0, 0.3 + frost * 5.7 + tuning.blur),
    specular: 0.5 + frost * 0.4,
    dispersion: settings.dispersion * (1 - frost * 0.5),
  }
  // The frosted tint sits above the glass with the content, so it looks the same in every browser
  const tint = { backgroundColor: `rgba(255, 255, 255, ${frost * 0.18})` }

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <div className="relative w-full max-w-[420px] h-[300px] rounded-3xl overflow-hidden shadow-2xl select-none">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          src={VIDEO_URL}
          autoPlay
          muted
          loop
          playsInline
          // Loading media resets the rate, so apply it again once metadata is ready
          onLoadedMetadata={(e) => {
            e.currentTarget.playbackRate = FROSTED_VIDEO_SPEED
          }}
        />

        <div className="absolute inset-0 flex flex-col items-center justify-between pt-7 pb-8 text-white">
          {/* Clock */}
          <Vaso radius={Math.max(0, 24 + tuning.radius)} {...glass}>
            <div className="relative px-6 py-2" style={{ ...tint, borderRadius: Math.max(0, 24 + tuning.radius) }}>
              <div className="text-5xl font-semibold tabular-nums tracking-tight" suppressHydrationWarning>
                {time ?? '--:--'}
              </div>
            </div>
          </Vaso>

          <div className="flex flex-col items-center gap-4">
          {/* Icon toolbar */}
          <Vaso radius={24} {...glass} className="rounded-full">
            <div className="relative flex items-center gap-1 px-2 h-12 rounded-full" style={tint}>
              {ICONS.map((icon) => (
                <button key={icon.label} aria-label={icon.label} className={ICON_BUTTON}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={icon.path} />
                  </svg>
                </button>
              ))}
              <button
                aria-label="Like"
                aria-pressed={liked}
                onClick={() => setLiked(!liked)}
                className={ICON_BUTTON}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill={liked ? '#e3a75a' : 'none'} stroke={liked ? '#e3a75a' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z" />
                </svg>
              </button>
            </div>
          </Vaso>

          {/* Icon only, so swapping play and pause never changes its size */}
          <GlassButton
            variant="icon"
            frost={frost}
            className="glass-button-on-media"
            style={tint}
            aria-label={playing ? 'Pause video' : 'Play video'}
            onClick={() => {
              const video = videoRef.current
              if (!video) return
              if (video.paused) video.play()
              else video.pause()
              setPlaying(!video.paused)
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              {playing ? <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /> : <path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z" />}
            </svg>
          </GlassButton>
          </div>
        </div>
      </div>

      {/* Toggle Control */}
      <div className="flex items-center justify-center gap-4 w-64 rounded-xl">
        <span className="text-sm font-medium theme-controls-title mr-4">Frosted</span>
        <button
          onClick={() => setFrostedGlass(!frostedGlass)}
          role="switch"
          aria-checked={frostedGlass}
          aria-label="Frosted"
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
            frostedGlass ? 'bg-[#e3a75a]' : 'bg-[#bcbeb3]'
          }`}
        >
          <span className="absolute top-1/2 left-1/2 -translate-y-[50%] -translate-x-1/2 w-[56px] h-[36px]">
            <Vaso
              width={56}
              height={36}
              radius={20}
              depth={frostedGlass ? 2 : 0.5}
              dispersion={settings.dispersion}
              blur={0.3}
              className={`transform transition-transform translate-y-1/2 ${
                frostedGlass ? 'translate-x-4' : '-translate-x-4'
              }`}
            />
          </span>
        </button>
      </div>
    </div>
  )
}
