'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * Hook that debounces a callback by the given delay.
 * Returns a stable function that when called, resets the timer.
 * After `delay` ms of no calls, the callback fires.
 *
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds (default 1500)
 * @returns An object with `schedule` to trigger and `cancel` to clear
 */
export function useDebounce<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number = 1500
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const schedule = useCallback(
    (...args: unknown[]) => {
      cancel()
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args)
        timerRef.current = null
      }, delay)
    },
    [delay, cancel]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => cancel()
  }, [cancel])

  return { schedule, cancel }
}
