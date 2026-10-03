'use client'

import { useState } from 'react'
import { useSpring } from '@react-spring/web'
import clsx from 'clsx'
import { Vaso } from 'vaso'
import { useGlassContext } from '../contexts/glass-context'

type GlassButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'icon'
  size?: 'sm' | 'md'
  /** 0 = clear, 1 = frosted */
  frost?: number
}

const RADIUS = { sm: 12, md: 999 }

export function GlassButton({ variant = 'secondary', size = 'md', frost, className, children, ...props }: GlassButtonProps) {
  const { settings } = useGlassContext()
  const [pressed, setPressed] = useState(false)
  const [press, setPress] = useState(0)

  // Pressing bulges the glass: the refraction springs up and settles back on release
  useSpring({
    press: pressed ? 1 : 0,
    config: { tension: 420, friction: pressed ? 30 : 12 },
    onChange: ({ value }) => setPress(value.press),
  })

  return (
    <Vaso
      component="span"
      radius={RADIUS[size]}
      depth={0.6 + press * 1.6}
      blur={frost !== undefined ? 0.3 + frost * 5.7 : variant === 'primary' ? 1 : settings.blur}
      dispersion={settings.dispersion + press * 0.6}
      specular={0.6 + press * 0.3}
      className="inline-flex"
      style={{ transform: `scale(${1 + press * 0.04})` }}
    >
      <button
        {...props}
        onPointerDown={(e) => {
          setPressed(true)
          props.onPointerDown?.(e)
        }}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        className={clsx(
          'relative inline-flex items-center justify-center gap-2 font-medium cursor-pointer select-none',
          size === 'sm' ? 'h-7 px-2.5 text-xs rounded-[12px]' : 'h-10 text-sm rounded-full',
          size === 'md' && (variant === 'icon' ? 'w-10' : 'px-5'),
          `glass-button-${variant}`,
          className,
        )}
      >
        {children}
      </button>
    </Vaso>
  )
}

