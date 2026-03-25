import { useEffect, useRef } from 'react'
import { Sparkles, MessageSquare, Unlink, Check } from 'lucide-react'
import { useAgent } from '../context/AgentContext'
import { useWorkspaces } from '../context/WorkspaceContext'

const BREAKDOWN_ID = 'task-breakdown'

export default function AgentActionMenu({ task, position, onClose, onBreakdown }) {
  const { templates, agentAvailable, bindAndOpenPanel, unbindAgentFromTask } = useAgent()
  const { activeWorkspace } = useWorkspaces()
  const menuRef = useRef(null)

  // Close on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const chatAgents = templates.filter(t => t.agent_id !== BREAKDOWN_ID && t.agent_id !== 'follow-up-agent' && t.agent_id !== 'test-assistant')
  const hasBoundAgent = !!task.agent_id

  const handleBreakdown = () => {
    onBreakdown(task)
    onClose()
  }

  const handleSelectAgent = async (agentId) => {
    if (!activeWorkspace) return
    await bindAndOpenPanel(task.id, agentId, task)
    onClose()
  }

  const handleUnbind = async () => {
    if (!activeWorkspace) return
    await unbindAgentFromTask(task.id)
    onClose()
  }

  // Position menu, keeping it on screen
  const style = {
    position: 'fixed',
    zIndex: 50,
    left: Math.min(position.x, window.innerWidth - 280),
    top: Math.min(position.y, window.innerHeight - 400),
  }

  return (
    <div ref={menuRef} style={style} className="bg-white rounded-lg shadow-xl border border-gray-200 py-1 w-64">
      <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
        AI Actions
      </div>

      {/* Breakdown — always first */}
      <button
        onClick={handleBreakdown}
        disabled={!agentAvailable}
        className="w-full px-4 py-2 text-sm text-left hover:bg-purple-50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Sparkles className="w-4 h-4 text-purple-500" />
        Break Down Task
      </button>

      <div className="border-t border-gray-100 my-1" />

      {/* Chat agents */}
      {chatAgents.map(agent => (
        <button
          key={agent.agent_id}
          onClick={() => handleSelectAgent(agent.agent_id)}
          disabled={!agentAvailable}
          className={`w-full px-4 py-2 text-sm text-left hover:bg-purple-50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
            task.agent_id === agent.agent_id ? 'bg-purple-50 text-purple-700' : 'text-gray-700'
          }`}
        >
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <span className="flex-1">{agent.name}</span>
          {task.agent_id === agent.agent_id && (
            <Check className="w-4 h-4 text-purple-600" />
          )}
        </button>
      ))}

      {/* Unbind — only if agent bound */}
      {hasBoundAgent && (
        <>
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={handleUnbind}
            className="w-full px-4 py-2 text-sm text-left hover:bg-red-50 text-red-600 flex items-center gap-2"
          >
            <Unlink className="w-4 h-4" />
            Remove Agent
          </button>
        </>
      )}

      {!agentAvailable && (
        <div className="px-4 py-2 text-xs text-gray-400">
          Agent service unavailable
        </div>
      )}
    </div>
  )
}
