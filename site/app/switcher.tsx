'use client'

import React, { useState } from 'react'
import { Vaso } from '../../src/index'
import clsx from 'clsx'

export interface SwitcherProps {
  /** Options for the switcher */
  options: {
    id: string
    label: string
    icon?: React.ReactNode
  }[]
  /** Currently active option ID */
  value?: string
  /** Callback when option changes */
  onChange?: (value: string) => void
  /** Custom styling */
  className?: string
}

export const Switcher: React.FC<SwitcherProps> = ({ options = [], value = options[0]?.id, onChange }) => {
  const [activeOption, setActiveOption] = useState(value)

  const handleOptionChange = (optionId: string) => {
    setActiveOption(optionId)
    onChange?.(optionId)
  }

  const activeIndex = options.findIndex((option) => option.id === activeOption)
  const isLeft = activeIndex === 0

  const isDarkTheme = activeOption === 'dark'

  return (
    <div
      className={clsx(
        'relative flex backdrop-blur-md rounded-full p-1.5 min-w-[120px] h-[40px] transition-all duration-300',
        'border-2 shadow-md',
        isDarkTheme ? 'bg-gray-900/80 border border-gray-700/50' : 'bg-white/100 border border-white/100'
      )}
    >
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => handleOptionChange(option.id)}
          className={clsx(
            'relative bg-transparent border-0 rounded-full cursor-pointer flex-1',
            'flex items-center justify-center text-sm font-medium',
            'transition-all duration-300 px-2 py-1',
            activeOption === option.id ? 'z-20' : 'z-10',
            isDarkTheme
              ? activeOption === option.id
                ? 'text-white'
                : 'text-gray-300 hover:text-gray-100'
              : activeOption === option.id
              ? 'text-gray-900'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          {activeOption !== option.id && <span className="whitespace-nowrap font-medium">{option.label}</span>}
        </button>
      ))}

      {/* Glass overlay using Vaso */}
      <Vaso
        radius={50}
        depth={1.4}
        px={4}
        py={4}
        className={clsx('vaso-switching', isLeft ? 'vaso-left' : 'vaso-right')}
      >
        <div className="flex items-center justify-center w-full h-full">
          {options.find((option) => option.id === activeOption)?.icon && (
            <span className={clsx('text-lg flex items-center', isDarkTheme ? 'text-white' : 'text-gray-900')}>
              {options.find((option) => option.id === activeOption)?.icon}
            </span>
          )}
        </div>
      </Vaso>
    </div>
  )
}
