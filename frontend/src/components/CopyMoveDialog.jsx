import { useState, useEffect } from 'react'
import { X, Copy, ArrowRightLeft, FolderOpen } from 'lucide-react'
import { copyMoveTasks } from '../api/tasks'
import { useWorkspaces } from '../context/WorkspaceContext'
import toast from 'react-hot-toast'

export default function CopyMoveDialog({ open, taskIds, onClose, onComplete }) {
  const { workspaces, activeWorkspace } = useWorkspaces()
  const [selectedWsId, setSelectedWsId] = useState('')
  const [loading, setLoading] = useState(false)

  const otherWorkspaces = workspaces.filter((w) => w.id !== activeWorkspace?.id)

  useEffect(() => {
    if (open) {
      setSelectedWsId(otherWorkspaces[0]?.id || '')
      setLoading(false)
    }
  }, [open])

  if (!open) return null

  const selectedWs = otherWorkspaces.find((w) => w.id === Number(selectedWsId))

  const handleAction = async (action) => {
    if (!selectedWsId) return
    setLoading(true)
    try {
      const res = await copyMoveTasks(taskIds, Number(selectedWsId), action)
      const label = action === 'copy' ? 'Copied' : 'Moved'
      toast.success(`${label} ${res.data.count} task(s) to "${selectedWs?.name}"`)
      onComplete(action)
      onClose()
    } catch (err) {
      const detail = err.response?.data?.detail
      toast.error(detail || `Failed to ${action} tasks`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5 text-purple-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Copy/Move {taskIds.length} Task(s)</h3>
        </div>

        {otherWorkspaces.length === 0 ? (
          <div className="text-center py-6">
            <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No other workspaces available.</p>
            <p className="text-xs text-gray-400 mt-1">Create another workspace first.</p>
          </div>
        ) : (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select destination workspace
            </label>
            <select
              value={selectedWsId}
              onChange={(e) => setSelectedWsId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 mb-4"
            >
              {otherWorkspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>

            <div className="flex gap-3">
              <button
                onClick={() => handleAction('copy')}
                disabled={loading || !selectedWsId}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                <Copy className="w-4 h-4" />
                {loading ? 'Processing...' : 'Copy Here'}
              </button>
              <button
                onClick={() => handleAction('move')}
                disabled={loading || !selectedWsId}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-lg hover:bg-purple-50 disabled:opacity-50 transition-colors"
              >
                <ArrowRightLeft className="w-4 h-4" />
                {loading ? 'Processing...' : 'Move Here'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
