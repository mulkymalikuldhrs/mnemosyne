import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn utility function', () => {
  it('should merge class names as strings', () => {
    const result = cn('px-2', 'py-1')
    expect(result).toBe('px-2 py-1')
  })

  it('should handle empty inputs', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('should handle conditional classes with undefined/null', () => {
    const result = cn('base', undefined, null, 'extra')
    expect(result).toBe('base extra')
  })

  it('should handle boolean conditional classes', () => {
    const isActive = true
    const isDisabled = false
    const result = cn('base', isActive && 'active', isDisabled && 'disabled')
    expect(result).toBe('base active')
  })

  it('should merge conflicting Tailwind classes (tailwind-merge)', () => {
    // tailwind-merge should resolve px-4 overriding px-2
    const result = cn('px-2', 'px-4')
    expect(result).toBe('px-4')
  })

  it('should merge conflicting padding classes', () => {
    const result = cn('p-2', 'p-4')
    expect(result).toBe('p-4')
  })

  it('should handle array of class names', () => {
    const result = cn(['px-2', 'py-1'], 'bg-red-500')
    expect(result).toBe('px-2 py-1 bg-red-500')
  })

  it('should merge conflicting margin classes', () => {
    const result = cn('m-2', 'm-4')
    expect(result).toBe('m-4')
  })

  it('should handle objects with boolean values (clsx)', () => {
    const result = cn({ 'font-bold': true, 'font-normal': false })
    expect(result).toBe('font-bold')
  })

  it('should resolve conflicting text color classes', () => {
    const result = cn('text-red-500', 'text-blue-500')
    expect(result).toBe('text-blue-500')
  })

  it('should handle mixed input types', () => {
    const result = cn(
      'base-class',
      ['array-class'],
      { 'object-class': true, 'hidden-class': false },
      undefined,
      'final-class'
    )
    expect(result).toBe('base-class array-class object-class final-class')
  })
})
