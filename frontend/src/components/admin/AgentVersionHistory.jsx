import { useState, useEffect } from 'react'
import { X, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import * as api from '../../api/agentAdmin'
import { useAgentAdmin } from '../../context/AgentAdminContext'
import ConfirmDialog from '../ConfirmDialog'

export default function AgentVersionHistory({ agent, onClose }) {
  const { loadAgents } = useAgentAdmin()
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [rollbackTarget, setRollbackTarget] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.getAgentVersions(agent.agent_id)
        setVersions(data)
      } catch (err) {
        toast.error('Failed to load version history')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [agent.agent_id])

  const handleRollback = async () => {
    if (!rollbackTarget) return
    try {
      await api.rollbackAgent(agent.agent_id, { version: rollbackTarget.version })
      toast.success(`Rolled back to v${rollbackTarget.version}`)
      await loadAgents()
      onClose()
    } catch (err) {
      toast.error('Rollback failed')
    } finally {
      setRollbackTarget(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Version History</h2>
            <p className="text-sm text-gray-500">{agent.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
            </div>
          ) : versions.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No version history available</p>
          ) : (
            <div className="space-y-3">
              {versions.map((v) => (
                <div
                  key={v.version}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">v{v.version}</span>
                      {v.version === agent.version && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                          current
                        </span>
                      )}
                    </div>
                    {v.version_comment && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{v.version_comment}</p>
                    )}
                    {v.archived_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(v.archived_at).toLocaleDateString()} {new Date(v.archived_at).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                  {v.version !== agent.version && (
                    <button
                      onClick={() => setRollbackTarget(v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Rollback
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {rollbackTarget && (
          <ConfirmDialog
            open={true}
            title="Rollback Agent"
            message={`Roll back "${agent.name}" to version ${rollbackTarget.version}? The current configuration will be archived.`}
            onConfirm={handleRollback}
            onCancel={() => setRollbackTarget(null)}
          />
        )}
      </div>
    </div>
  )
}
