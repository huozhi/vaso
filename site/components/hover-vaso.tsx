'use client'

import { useState } from 'react'
import { useSpring } from '@react-spring/web'
import { Vaso } from "../../src"

interface HoverCodeGlassProps {
  children: React.ReactNode
  blurAmount?: number
  [key: string]: any
}

export function HoverCodeGlass({ 
  children, 
  blurAmount = 4,
  ...props 
}: HoverCodeGlassProps) {
  const [isHovered, setIsHovered] = useState(false)
  const springs = useSpring({
    blur: isHovered ? 0 : blurAmount,
    config: {
      tension: 120,
      friction: 14,
    },
  })
  const blur = springs.blur.to(val => val).get()

  return (
    <Vaso
      component='span'
      className="inline-block cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ pointerEvents: 'auto' }}
      px={2}
      py={4}
      scale={0}
      borderRadius={6}
      blur={blur}
      {...props}
    >
      {children}
    </Vaso>
  )
} 