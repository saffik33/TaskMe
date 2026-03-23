import { useCallback, useEffect, useRef, useState } from 'react'

const WS_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/^http/, 'ws')

export default function useAgentWebSocket(taskId, onMessage) {
  const [status, setStatus] = useState('disconnected') // connecting | connected | disconnected | error
  const [error, setError] = useState(null)
  const wsRef = useRef(null)
  const retriesRef = useRef(0)
  const maxRetries = 3

  const connect = useCallback(() => {
    if (!taskId) return
    const token = sessionStorage.getItem('token')
    if (!token) {
      setError('No auth token')
      setStatus('error')
      return
    }

    setStatus('connecting')
    setError(null)

    // Build WS URL — handle both relative and absolute base URLs
    let wsUrl
    if (WS_BASE.startsWith('ws')) {
      wsUrl = `${WS_BASE}/ws/agent-chat?task_id=${taskId}&token=${token}`
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      wsUrl = `${protocol}//${window.location.host}${WS_BASE}/ws/agent-chat?task_id=${taskId}&token=${token}`
    }

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus('connected')
      retriesRef.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        onMessage?.(msg)
      } catch (e) {
        console.error('Failed to parse WS message:', e)
      }
    }

    ws.onerror = () => {
      setError('WebSocket error')
      setStatus('error')
    }

    ws.onclose = (event) => {
      wsRef.current = null
      if (event.code === 4001) {
        setError('Authentication failed')
        setStatus('error')
        return
      }
      if (event.code === 4004) {
        setError('Task not found or access denied')
        setStatus('error')
        return
      }
      if (event.code === 4000) {
        setError('No agent bound to task')
        setStatus('error')
        return
      }
      // Auto-reconnect on unexpected close
      if (retriesRef.current < maxRetries) {
        retriesRef.current++
        setTimeout(connect, 1000 * retriesRef.current)
      } else {
        setStatus('disconnected')
      }
    }
  }, [taskId, onMessage])

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  const close = useCallback(() => {
    retriesRef.current = maxRetries // prevent reconnect
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setStatus('disconnected')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      retriesRef.current = maxRetries
      wsRef.current?.close()
    }
  }, [])

  return { connect, send, close, status, error }
}
