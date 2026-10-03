import { FloatingGlass, glassTarget } from './floating-glass'

export function SiteFooter() {
  return (
    // One floating glass for every link, jumping between them on hover
    <FloatingGlass component="footer" className="flex flex-wrap items-center justify-between gap-4 text-sm theme-text">
      <nav className="flex items-center gap-5">
        <a {...glassTarget} href="https://github.com/huozhi/vaso" className="inline-flex items-center gap-1.5 font-bold theme-code">
          gitHub
        </a>
        {'/'}
        <a {...glassTarget} href="https://x.com/huozhi" className="font-bold theme-code">
          huozhi
        </a>
      </nav>
    </FloatingGlass>
  )
}
