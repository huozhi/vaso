'use client'

import React, { useEffect } from 'react'
import { useState } from 'react'
import { useSpring } from '@react-spring/web'
import { Vaso, VasoProps } from "../../src"

type HoverCodeGlassProps = VasoProps<HTMLSpanElement>

export function HoverCodeGlass({ 
  children, 
  ...props 
}: HoverCodeGlassProps) {
  const [isTouching, setIsTouching] = useState(true)
  const [isHovered, setIsHovered] = useState(isTouching ? true : false)
  const [currentBlur, setCurrentBlur] = useState(isTouching ? 0 : 4)

  useEffect(() => {
    const isTouchingDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    setIsTouching(isTouchingDevice)    
    setIsHovered(isTouchingDevice ? true : false)
    setCurrentBlur(isTouchingDevice ? 0 : 4)
  }, [])

  useSpring({
    blur: isHovered ? 0 : 4,
    config: {
      tension: 170,
      friction: 26,
      duration: 120,
    },
    easing: 'easeInOutCubic',
    onChange: ({ value }) => {
      setCurrentBlur(value.blur)
    }
  })

  return (
    <Vaso
      component='span'
      className="inline-block cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ pointerEvents: 'auto', cursor: 'pointer', }}
      px={2}
      py={4}
      depth={0}
      radius={6}
      blur={currentBlur}
      {...props}
    >
      {children}
    </Vaso>
  )
} 