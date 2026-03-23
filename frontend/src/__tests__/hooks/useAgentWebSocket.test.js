import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useAgentWebSocket from '../../hooks/useAgentWebSocket'

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1
  static CLOSED = 3

  constructor(url) {
    this.url = url
    this.readyState = MockWebSocket.OPEN
    this.onopen = null
    this.onmessage = null
    this.onerror = null
    this.onclose = null
    this._sent = []
    MockWebSocket._instances.push(this)
    // Simulate async open
    setTimeout(() => this.onopen?.(), 0)
  }

  send(data) {
    this._sent.push(data)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code: 1000 })
  }

  // Test helpers
  _triggerMessage(data) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }

  _triggerClose(code) {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code })
  }

  _triggerError() {
    this.onerror?.()
  }
}
MockWebSocket._instances = []

describe('useAgentWebSocket', () => {
  beforeEach(() => {
    MockWebSocket._instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
    sessionStorage.setItem('token', 'test-jwt-token')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it('starts with disconnected status', () => {
    const onMessage = vi.fn()
    const { result } = renderHook(() => useAgentWebSocket(1, onMessage))
    expect(result.current.status).toBe('disconnected')
  })

  it('connect does nothing when taskId is null', () => {
    const onMessage = vi.fn()
    const { result } = renderHook(() => useAgentWebSocket(null, onMessage))
    act(() => result.current.connect())
    expect(MockWebSocket._instances).toHaveLength(0)
  })

  it('connect sets error when no token', () => {
    sessionStorage.clear()
    const onMessage = vi.fn()
    const { result } = renderHook(() => useAgentWebSocket(1, onMessage))
    act(() => result.current.connect())
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('No auth token')
  })

  it('connect creates WebSocket and becomes connected', async () => {
    const onMessage = vi.fn()
    const { result } = renderHook(() => useAgentWebSocket(1, onMessage))

    act(() => result.current.connect())
    expect(result.current.status).toBe('connecting')

    // Wait for async onopen
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
    expect(result.current.status).toBe('connected')
    expect(MockWebSocket._instances).toHaveLength(1)
    expect(MockWebSocket._instances[0].url).toContain('task_id=1')
    expect(MockWebSocket._instances[0].url).toContain('token=test-jwt-token')
  })

  it('onMessage callback receives parsed JSON', async () => {
    const onMessage = vi.fn()
    const { result } = renderHook(() => useAgentWebSocket(1, onMessage))

    act(() => result.current.connect())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    act(() => {
      MockWebSocket._instances[0]._triggerMessage({ type: 'assistant_message', content: 'hi' })
    })
    expect(onMessage).toHaveBeenCalledWith({ type: 'assistant_message', content: 'hi' })
  })

  it('close code 4001 sets auth error without retry', async () => {
    const onMessage = vi.fn()
    const { result } = renderHook(() => useAgentWebSocket(1, onMessage))

    act(() => result.current.connect())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    act(() => {
      MockWebSocket._instances[0]._triggerClose(4001)
    })
    expect(result.current.error).toBe('Authentication failed')
    expect(result.current.status).toBe('error')
    // No retry — still 1 instance
    expect(MockWebSocket._instances).toHaveLength(1)
  })

  it('close code 4004 sets task not found error', async () => {
    const onMessage = vi.fn()
    const { result } = renderHook(() => useAgentWebSocket(1, onMessage))

    act(() => result.current.connect())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    act(() => {
      MockWebSocket._instances[0]._triggerClose(4004)
    })
    expect(result.current.error).toBe('Task not found or access denied')
  })

  it('close code 4000 sets no agent error', async () => {
    const onMessage = vi.fn()
    const { result } = renderHook(() => useAgentWebSocket(1, onMessage))

    act(() => result.current.connect())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    act(() => {
      MockWebSocket._instances[0]._triggerClose(4000)
    })
    expect(result.current.error).toBe('No agent bound to task')
  })

  it('send sends JSON when connected', async () => {
    const onMessage = vi.fn()
    const { result } = renderHook(() => useAgentWebSocket(1, onMessage))

    act(() => result.current.connect())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    act(() => {
      result.current.send({ type: 'user_message', content: 'hello' })
    })
    expect(MockWebSocket._instances[0]._sent).toHaveLength(1)
    expect(JSON.parse(MockWebSocket._instances[0]._sent[0])).toEqual({
      type: 'user_message',
      content: 'hello',
    })
  })

  it('close prevents reconnection', async () => {
    const onMessage = vi.fn()
    const { result } = renderHook(() => useAgentWebSocket(1, onMessage))

    act(() => result.current.connect())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    act(() => result.current.close())
    expect(result.current.status).toBe('disconnected')
  })

  it('onerror sets error status', async () => {
    const onMessage = vi.fn()
    const { result } = renderHook(() => useAgentWebSocket(1, onMessage))

    act(() => result.current.connect())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    act(() => {
      MockWebSocket._instances[0]._triggerError()
    })
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('WebSocket error')
  })
})
