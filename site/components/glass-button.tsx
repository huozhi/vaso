'use client'

import { useState } from 'react'
import { useSpring } from '@react-spring/web'
import clsx from 'clsx'
import { Vaso } from 'vaso'
import { useGlassContext, useGlassTuning } from '../contexts/glass-context'

type GlassButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** 0 = clear, 1 = frosted */
  frost?: number
}

// A round glass icon button that bulges when pressed
export function GlassButton({ frost = 0, className, children, ...props }: GlassButtonProps) {
  const { settings } = useGlassContext()
  const tuning = useGlassTuning()
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
      radius={999}
      depth={0.6 + press * 1.6 + tuning.depth}
      blur={Math.max(0, 0.3 + frost * 5.7 + tuning.blur)}
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
          'relative inline-flex items-center justify-center w-10 h-10 rounded-full cursor-pointer select-none glass-button',
          className,
        )}
      >
        {children}
      </button>
    </Vaso>
  )
}
