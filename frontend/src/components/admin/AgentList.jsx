import { useState, useMemo } from 'react'
import { Plus, Pencil, History, Trash2, Search } from 'lucide-react'
import { useAgentAdmin } from '../../context/AgentAdminContext'
import AgentForm from './AgentForm'
import AgentVersionHistory from './AgentVersionHistory'
import ConfirmDialog from '../ConfirmDialog'

export default function AgentList() {
  const { agents, deleteAgent } = useAgentAdmin()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editAgent, setEditAgent] = useState(null)
  const [showVersions, setShowVersions] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const filtered = useMemo(() => {
    if (!search) return agents
    const q = search.toLowerCase()
    return agents.filter(a => a.name.toLowerCase().includes(q) || a.agent_id.toLowerCase().includes(q))
  }, [agents, search])

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteAgent(deleteTarget.agent_id)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <button
          onClick={() => { setEditAgent(null); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-sm text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Create Agent
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Agent ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Model</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Tools</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Ver</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(agent => (
              <tr key={agent.agent_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{agent.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{agent.agent_id}</td>
                <td className="px-4 py-3 text-gray-600">{agent.model}</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    {(agent.client_tools || []).length}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-gray-500">v{agent.version}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => { setEditAgent(agent); setShowForm(true) }} className="p-1.5 text-gray-400 hover:text-purple-600 rounded" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowVersions(agent)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Version History">
                      <History className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTarget(agent)} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No agents found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && <AgentForm agent={editAgent} onClose={() => { setShowForm(false); setEditAgent(null) }} />}
      {showVersions && <AgentVersionHistory agent={showVersions} onClose={() => setShowVersions(null)} />}
      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title="Delete Agent"
          message={`Delete "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
