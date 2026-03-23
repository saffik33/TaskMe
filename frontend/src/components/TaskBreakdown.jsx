import { useState } from 'react'
import { Loader2, Sparkles, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { breakdownTask } from '../api/agents'
import { useWorkspaces } from '../context/WorkspaceContext'
import { useTasks } from '../context/TaskContext'
import toast from 'react-hot-toast'

export default function TaskBreakdown({ task, open, onClose }) {
  const { activeWorkspace } = useWorkspaces()
  const { loadTasks } = useTasks()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  if (!open || !task) return null

  const handleBreakdown = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await breakdownTask(task.id, activeWorkspace.id)
      setResult(res.data)
      loadTasks()
      toast.success(`Created ${res.data.subtasks_created} subtasks`)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to break down task'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Break Down Task</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Task info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-900">{task.task_name}</p>
            {task.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
            )}
            <div className="flex gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                {task.status}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {task.priority}
              </span>
            </div>
          </div>

          {/* Action / Result */}
          {!loading && !result && !error && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 mb-4">
                AI will analyze this task and generate 3-8 actionable subtasks.
              </p>
              <button
                onClick={handleBreakdown}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                Break Down with AI
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500 mb-3" />
              <p className="text-sm text-gray-500">Analyzing task and generating subtasks...</p>
              <p className="text-xs text-gray-400 mt-1">This may take 10-30 seconds</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700">Breakdown failed</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-5 h-5" />
                <p className="text-sm font-medium">
                  Created {result.subtasks_created} subtasks
                </p>
              </div>
              <div className="space-y-2">
                {result.subtasks.map((st, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{st.task_name}</p>
                    {st.description && (
                      <p className="text-xs text-gray-500 mt-1">{st.description}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      {st.priority && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {st.priority}
                        </span>
                      )}
                      {st.due_date && (
                        <span className="text-xs text-gray-400">{st.due_date}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {result ? 'Done' : 'Cancel'}
          </button>
          {error && (
            <button
              onClick={handleBreakdown}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
