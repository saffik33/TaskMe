import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, ListTodo } from 'lucide-react'
import { getSharedTasks } from '../api/tasks'
import StatusBadge from '../components/StatusBadge'
import PriorityBadge from '../components/PriorityBadge'
import { formatDate } from '../utils/dateHelpers'

export default function SharedView() {
  const { token } = useParams()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getSharedTasks(token)
        setTasks(res.data)
      } catch {
        setError('This share link is invalid or has expired.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <ListTodo className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">TaskMe</h1>
            <p className="text-xs text-gray-500">Shared Task List</p>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Task</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Priority</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{task.task_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{task.owner || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(task.due_date)}</td>
                  <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={task.priority} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">
          Shared via TaskMe - AI-Powered Task Management
        </p>
      </main>
    </div>
  )
}
