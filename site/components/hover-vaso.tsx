'use client'

import { useState } from 'react'
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

  return (
    <div
      className="inline-block cursor-pointer"
      style={{ pointerEvents: 'auto' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Vaso
        component="span"
        px={2}
        py={4}
        borderRadius={6}
        scale={20}
        blur={isHovered ? 0 : blurAmount}
        contrast={1.1}
        {...props}
      >
        {children}
      </Vaso>
    </div>
  )
} 