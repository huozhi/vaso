'use client'

import { Switcher } from './switcher'

export function ThemeSwitch({ theme, setTheme }: { theme: string; setTheme: (theme: string) => void }) {
  return (
    <div className="flex flex-col gap-3 items-start">
      <div className="flex justify-start">
        <Switcher
          xOption={{
            id: 'light',
            label: 'Light',
            icon:
              theme === 'light' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              ) : null,
          }}
          yOption={{
            id: 'dark',
            label: 'Dark',
            icon:
              theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="currentColor"
                  />
                </svg>
              ) : null,
          }}
          value={theme}
          onChange={setTheme}
        />
      </div>
    </div>
  )
}
