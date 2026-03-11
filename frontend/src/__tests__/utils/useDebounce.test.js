import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '../../hooks/useDebounce'

describe('useDebounce', () => {
  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300))
    expect(result.current).toBe('hello')
  })

  it('debounces value updates', async () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    )

    rerender({ value: 'updated' })
    // Value should still be initial before timer fires
    expect(result.current).toBe('initial')

    // Fast-forward past the delay
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe('updated')

    vi.useRealTimers()
  })
})
