import { FloatingGlass, glassTarget } from './floating-glass'

export function SiteFooter() {
  return (
    // One floating glass for every link, jumping between them on hover
    <FloatingGlass component="footer" className="flex flex-wrap items-center justify-between gap-4 text-sm theme-text">
      <nav className="flex items-center gap-5">
        <a {...glassTarget} href="https://github.com/huozhi/vaso" className="inline-flex items-center gap-1.5 font-bold theme-code">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 .9a11.1 11.1 0 00-3.51 21.63c.55.1.76-.24.76-.53v-2.05c-3.1.67-3.76-1.32-3.76-1.32-.5-1.28-1.23-1.62-1.23-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 1.7 2.62 1.21 3.26.92.1-.72.39-1.21.71-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.15a10.6 10.6 0 015.55 0c2.11-1.45 3.05-1.15 3.05-1.15.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3 0 4.29-2.62 5.23-5.11 5.51.4.35.76 1.03.76 2.08V22c0 .29.2.64.77.53A11.1 11.1 0 0012 .9z" />
          </svg>
          gitHub
        </a>
        {'/'}
        <a {...glassTarget} href="https://x.com/huozhi" className="inline-flex items-center gap-1.5 font-bold theme-code">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.9 2H22l-6.78 7.75L23.2 22h-6.25l-4.9-7.44L5.54 22H2.4l7.25-8.29L1.8 2h6.4l4.43 6.97L18.9 2zm-1.1 18h1.73L7.27 3.9H5.4L17.8 20z" />
          </svg>
          huozhi
        </a>
      </nav>
    </FloatingGlass>
  )
}
