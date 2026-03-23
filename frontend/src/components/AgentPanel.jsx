import { useEffect, useRef, useState } from 'react'
import { X, Send, Bot, User, Wrench, AlertCircle, Brain, Loader2 } from 'lucide-react'
import { useAgent } from '../context/AgentContext'

function MessageBubble({ msg }) {
  if (msg.type === 'user_message') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-purple-600 text-white text-sm">
          <div className="flex items-center gap-1.5 mb-1 text-purple-200 text-xs">
            <User className="w-3 h-3" /> You
          </div>
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    )
  }

  if (msg.type === 'assistant_message') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-gray-100 text-gray-800 text-sm">
          <div className="flex items-center gap-1.5 mb-1 text-gray-500 text-xs">
            <Bot className="w-3 h-3" /> Agent
          </div>
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    )
  }

  if (msg.type === 'assistant_thinking') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm">
          <div className="flex items-center gap-1.5 mb-1 text-amber-600 text-xs">
            <Brain className="w-3 h-3" /> Thinking
          </div>
          <p className="whitespace-pre-wrap text-amber-800 text-xs">{msg.content}</p>
        </div>
      </div>
    )
  }

  if (msg.type === 'tool_result') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-sm">
          <div className="flex items-center gap-1.5 mb-1 text-green-700 text-xs">
            <Wrench className="w-3 h-3" />
            Tool: {msg.tool_name}
          </div>
          <p className="text-green-800 text-xs">{msg.content || (msg.success ? 'Success' : 'Failed')}</p>
        </div>
      </div>
    )
  }

  if (msg.type === 'tool_execution_request') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm">
          <div className="flex items-center gap-1.5 mb-1 text-blue-700 text-xs">
            <Wrench className="w-3 h-3" />
            Calling: {msg.tool_name}
          </div>
          <pre className="text-blue-800 text-xs overflow-x-auto">
            {JSON.stringify(msg.parameters, null, 2)}
          </pre>
        </div>
      </div>
    )
  }

  if (msg.type === 'error') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm">
          <div className="flex items-center gap-1.5 text-red-700">
            <AlertCircle className="w-3 h-3" />
            {msg.message}
          </div>
        </div>
      </div>
    )
  }

  return null
}

const STATUS_COLORS = {
  idle: 'bg-green-400',
  executing: 'bg-blue-400 animate-pulse',
  waiting_approval: 'bg-yellow-400',
  completed: 'bg-gray-400',
  failed: 'bg-red-400',
}

export default function AgentPanel() {
  const { activePanel, messages, streaming, wsStatus, wsError, closePanel, sendMessage } = useAgent()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages])

  if (!activePanel) return null

  const { task } = activePanel
  const statusColor = STATUS_COLORS[task.agent_status] || 'bg-gray-300'

  const handleSend = () => {
    if (!input.trim() || streaming) return
    sendMessage(input)
    setInput('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed right-0 top-0 h-full w-[400px] bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="w-5 h-5 text-purple-600 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-900 truncate">{task.task_name}</span>
          </div>
          <button
            onClick={closePanel}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">
            {task.agent_id || 'No agent'}
          </span>
          {task.agent_status && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className={`w-2 h-2 rounded-full ${statusColor}`} />
              {task.agent_status}
            </span>
          )}
          {wsStatus === 'connecting' && (
            <span className="text-xs text-amber-600">Connecting...</span>
          )}
          {wsError && (
            <span className="text-xs text-red-600">{wsError}</span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="text-center text-gray-400 text-sm py-8">
            <Bot className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>Start a conversation with the agent</p>
            <p className="text-xs mt-1">Ask for help, suggestions, or actions on this task</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {streaming && messages[messages.length - 1]?.type !== 'assistant_message' && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-lg bg-gray-100 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={wsStatus === 'connected' ? 'Type a message...' : 'Connecting...'}
            disabled={wsStatus !== 'connected'}
            className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 min-h-[40px] max-h-[100px]"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming || wsStatus !== 'connected'}
            className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
