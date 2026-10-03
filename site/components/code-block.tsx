'use client'

import { useRef, useState } from 'react'
import { FloatingGlass, glassTarget } from './floating-glass'

// Just enough highlighting for short JSX snippets: comments, strings, keywords, tags, props and numbers
const TOKEN =
  /(\/\/.*)|('[^']*'|"[^"]*")|\b(import|from|export|function|return|const)\b|(<\/?[A-Za-z][\w.]*|\/?>)|\b([a-z][a-zA-Z]*)(?==)|\b(\d+(?:\.\d+)?)\b/g
const TOKEN_CLASSES = ['code-comment', 'code-string', 'code-keyword', 'code-tag', 'code-prop', 'code-number']

function highlight(code: string) {
  const parts: React.ReactNode[] = []
  let last = 0
  for (const match of code.matchAll(TOKEN)) {
    if (match.index > last) parts.push(code.slice(last, match.index))
    const group = match.slice(1).findIndex((value) => value !== undefined)
    parts.push(
      <span key={match.index} className={TOKEN_CLASSES[group]}>
        {match[0]}
      </span>,
    )
    last = match.index + match[0].length
  }
  parts.push(code.slice(last))
  return parts
}

export function CodeBlock({ code, filename }: { code: string; filename?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="relative rounded-xl overflow-hidden code-block">
      <div className="flex items-center justify-between px-4 h-10 text-xs code-block-bar">
        <span>{filename}</span>
        <FloatingGlass>
          {/* Fixed width, so swapping to "Copied" doesn't move it */}
          <button {...glassTarget} onClick={copy} aria-label="Copy code" className="w-[6ch] font-bold cursor-pointer theme-code">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </FloatingGlass>
      </div>
      <pre className="px-4 py-3 text-[13px] leading-relaxed overflow-x-auto">
        <code>{highlight(code)}</code>
      </pre>
    </div>
  )
}
