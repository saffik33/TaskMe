import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import * as agentApi from '../api/agents'
import { useWorkspaces } from './WorkspaceContext'
import { useTasks } from './TaskContext'
import useAgentWebSocket from '../hooks/useAgentWebSocket'

const AgentContext = createContext()

export function AgentProvider({ children }) {
  const { activeWorkspace } = useWorkspaces()
  const { loadTasks } = useTasks()
  const [agentAvailable, setAgentAvailable] = useState(false)
  const [templates, setTemplates] = useState([])
  const [activePanel, setActivePanel] = useState(null) // { taskId, task }
  const [messages, setMessages] = useState([])
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef(null)

  // Check agent service health on mount
  useEffect(() => {
    agentApi.checkAgentHealth()
      .then((res) => setAgentAvailable(res.data.available))
      .catch(() => setAgentAvailable(false))
  }, [])

  // Load templates when available
  useEffect(() => {
    if (!agentAvailable) return
    agentApi.listAgentTemplates()
      .then((res) => setTemplates(res.data))
      .catch(() => setTemplates([]))
  }, [agentAvailable])

  // WebSocket message handler
  const handleWsMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'session_established':
        // Session ID saved by backend relay
        break
      case 'assistant_message':
        if (msg.is_final) {
          setStreaming(false)
          setMessages((prev) => {
            // Replace last streaming message with final
            const last = prev[prev.length - 1]
            if (last?.type === 'assistant_message' && !last.is_final) {
              return [...prev.slice(0, -1), msg]
            }
            return [...prev, msg]
          })
        } else {
          setStreaming(true)
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last?.type === 'assistant_message' && !last.is_final) {
              return [...prev.slice(0, -1), msg]
            }
            return [...prev, msg]
          })
        }
        break
      case 'assistant_thinking':
        setMessages((prev) => [...prev, msg])
        break
      case 'tool_result':
        setMessages((prev) => [...prev, msg])
        // Refresh tasks since a tool may have modified them
        loadTasks()
        break
      case 'tool_execution_request':
      case 'tool_approval_request':
        setMessages((prev) => [...prev, msg])
        break
      case 'usage':
        // Could track token usage — skip for now
        break
      case 'error':
        setMessages((prev) => [...prev, msg])
        setStreaming(false)
        break
      case 'end':
        setStreaming(false)
        break
      default:
        break
    }
  }, [loadTasks])

  const { connect, send, close, status: wsStatus, error: wsError } = useAgentWebSocket(
    activePanel?.taskId,
    handleWsMessage,
  )

  // Open agent panel for a task
  const openPanel = useCallback((task) => {
    setMessages([])
    setStreaming(false)
    setActivePanel({ taskId: task.id, task })
  }, [])

  // Connect WS when panel opens with a bound agent
  useEffect(() => {
    if (activePanel?.task?.agent_id && wsStatus === 'disconnected') {
      connect()
    }
  }, [activePanel, connect, wsStatus])

  // Load existing messages when panel opens
  useEffect(() => {
    if (!activePanel || !activeWorkspace) return
    agentApi.getAgentMessages(activePanel.taskId, activeWorkspace.id)
      .then((res) => {
        if (res.data.length > 0) {
          // Convert stored messages to display format
          const displayMsgs = res.data.map((m) => ({
            type: m.role === 'user' ? 'user_message' : 'assistant_message',
            content: m.content?.content || '',
            is_final: true,
          }))
          setMessages(displayMsgs)
        }
      })
      .catch(() => {})
  }, [activePanel, activeWorkspace])

  const closePanel = useCallback(() => {
    close()
    setActivePanel(null)
    setMessages([])
    setStreaming(false)
  }, [close])

  const sendMessage = useCallback((content) => {
    if (!content.trim()) return
    // Add user message to local state
    setMessages((prev) => [...prev, { type: 'user_message', content }])
    setStreaming(true)
    send({ type: 'user_message', content })
  }, [send])

  const bindAgentToTask = useCallback(async (taskId, agentId, mode) => {
    if (!activeWorkspace) return
    await agentApi.bindAgent(taskId, { agent_id: agentId, mode }, activeWorkspace.id)
    loadTasks()
  }, [activeWorkspace, loadTasks])

  const unbindAgentFromTask = useCallback(async (taskId) => {
    if (!activeWorkspace) return
    await agentApi.unbindAgent(taskId, activeWorkspace.id)
    loadTasks()
    if (activePanel?.taskId === taskId) {
      closePanel()
    }
  }, [activeWorkspace, loadTasks, activePanel, closePanel])

  return (
    <AgentContext.Provider
      value={{
        agentAvailable,
        templates,
        activePanel,
        messages,
        streaming,
        wsStatus,
        wsError,
        openPanel,
        closePanel,
        sendMessage,
        bindAgentToTask,
        unbindAgentFromTask,
      }}
    >
      {children}
    </AgentContext.Provider>
  )
}

export function useAgent() {
  const ctx = useContext(AgentContext)
  if (!ctx) throw new Error('useAgent must be used within AgentProvider')
  return ctx
}
