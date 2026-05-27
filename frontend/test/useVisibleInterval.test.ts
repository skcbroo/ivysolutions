import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useVisibleInterval } from '../src/hooks/useVisibleInterval'

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useVisibleInterval', () => {
  it('dispara o callback imediatamente e depois a cada intervalo', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      setVisibility('visible')
      const cb = vi.fn()
      renderHook(() => useVisibleInterval(cb, 1_000))
      expect(cb).toHaveBeenCalledTimes(1)

      act(() => {
        vi.advanceTimersByTime(1_000)
      })
      expect(cb).toHaveBeenCalledTimes(2)

      act(() => {
        vi.advanceTimersByTime(3_000)
      })
      expect(cb).toHaveBeenCalledTimes(5)
    } finally {
      vi.useRealTimers()
    }
  })

  it('pausa em hidden e retoma em visible', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      setVisibility('visible')
      const cb = vi.fn()
      renderHook(() => useVisibleInterval(cb, 1_000))
      expect(cb).toHaveBeenCalledTimes(1)

      act(() => {
        setVisibility('hidden')
      })
      act(() => {
        vi.advanceTimersByTime(5_000)
      })
      expect(cb).toHaveBeenCalledTimes(1)

      act(() => {
        setVisibility('visible')
      })
      expect(cb).toHaveBeenCalledTimes(2)

      act(() => {
        vi.advanceTimersByTime(1_000)
      })
      expect(cb).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('limpa o interval no unmount', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      setVisibility('visible')
      const cb = vi.fn()
      const { unmount } = renderHook(() => useVisibleInterval(cb, 500))
      expect(cb).toHaveBeenCalledTimes(1)
      unmount()
      act(() => {
        vi.advanceTimersByTime(5_000)
      })
      expect(cb).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
