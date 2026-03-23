import { useState, useEffect } from 'react'
import { X, User, Bot, Wrench } from 'lucide-react'
import * as api from '../../api/agentAdmin'

function MessageBubble({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-gray-100 text-gray-800 text-sm">
          <div className="flex items-center gap-1.5 mb-1 text-gray-500 text-xs">
            <User className="w-3 h-3" /> User
          </div>
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    )
  }

  if (msg.role === 'assistant') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-purple-50 text-gray-800 text-sm">
          <div className="flex items-center gap-1.5 mb-1 text-purple-500 text-xs">
            <Bot className="w-3 h-3" /> Assistant
          </div>
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    )
  }

  if (msg.role === 'tool') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm">
          <div className="flex items-center gap-1.5 mb-1 text-green-700 text-xs">
            <Wrench className="w-3 h-3" />
            Tool: {msg.tool_name || 'unknown'}
          </div>
          <pre className="text-green-800 text-xs whitespace-pre-wrap overflow-x-auto">
            {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}
          </pre>
        </div>
      </div>
    )
  }

  return null
}

export default function SessionMessages({ sessionId, onClose }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .getSessionMessages(sessionId)
      .then(({ data }) => {
        if (!cancelled) setMessages(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail || 'Failed to load messages')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sessionId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Session Messages</h3>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{sessionId}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading && (
            <div className="text-center py-8 text-gray-400 text-sm">Loading messages...</div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {!loading && !error && messages.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">No messages in this session</div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-5 py-3 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
