'use client'

import { FloatingGlass, glassTarget } from './floating-glass'

export function SiteFooter() {
  return (
    // One floating glass for every link, jumping between them on hover
    <FloatingGlass component="footer" className="flex flex-wrap items-center justify-between gap-4 text-sm theme-text">
      <p>
        Made by{' '}
        <a {...glassTarget} href="https://x.com/huozhi" className="font-bold theme-code">
          huozhi
        </a>
      </p>
      <nav className="flex items-center gap-5">
        <a {...glassTarget} href="https://github.com/huozhi/vaso" className="inline-flex items-center gap-1.5 font-bold theme-code">
          <GitHubIcon size={14} />
          GitHub
        </a>
        <a {...glassTarget} href="https://x.com/huozhi" className="font-bold theme-code">
          X
        </a>
      </nav>
    </FloatingGlass>
  )
}

function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 00-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 015.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0012 .5z" />
    </svg>
  )
}
