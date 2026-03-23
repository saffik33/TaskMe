import { useState, useMemo } from 'react'
import { Plus, Pencil, Plug, Trash2, Search } from 'lucide-react'
import { useAgentAdmin } from '../../context/AgentAdminContext'
import McpServerForm from './McpServerForm'
import McpTestResult from './McpTestResult'
import ConfirmDialog from '../ConfirmDialog'
import * as api from '../../api/agentAdmin'
import toast from 'react-hot-toast'

export default function McpServerList() {
  const { mcpServers, deleteMcpServer } = useAgentAdmin()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editServer, setEditServer] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(null)

  const filtered = useMemo(() => {
    if (!search) return mcpServers
    const q = search.toLowerCase()
    return mcpServers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.host.toLowerCase().includes(q)
    )
  }, [mcpServers, search])

  const handleDelete = async () => {
    if (deleteTarget) {
      await deleteMcpServer(deleteTarget.mcp_server_id)
      setDeleteTarget(null)
    }
  }

  const handleTest = async (server) => {
    setTesting(server.mcp_server_id)
    try {
      const { data } = await api.testMcpServer(server.mcp_server_id)
      setTestResult(data)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Connection test failed')
    } finally {
      setTesting(null)
    }
  }

  const formatEndpoint = (server) => {
    return `${server.host}:${server.port}${server.path || ''}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search MCP servers..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <button
          onClick={() => {
            setEditServer(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-sm text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Server
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Endpoint</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">TLS</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Auth</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Auto-Approve</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((server) => (
              <tr key={server.mcp_server_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{server.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                  {formatEndpoint(server)}
                </td>
                <td className="px-4 py-3 text-center">
                  {server.use_tls ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      TLS
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                      None
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      server.auth_strategy === 'PASSTHROUGH'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {server.auth_strategy || 'NONE'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {server.auto_approve ? (
                    <span className="text-green-600 font-medium">&#10003;</span>
                  ) : (
                    <span className="text-gray-300">&#8212;</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => {
                        setEditServer(server)
                        setShowForm(true)
                      }}
                      className="p-1.5 text-gray-400 hover:text-purple-600 rounded"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleTest(server)}
                      disabled={testing === server.mcp_server_id}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded disabled:opacity-50"
                      title="Test Connection"
                    >
                      <Plug className={`w-4 h-4 ${testing === server.mcp_server_id ? 'animate-pulse' : ''}`} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(server)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No MCP servers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <McpServerForm
          server={editServer}
          onClose={() => {
            setShowForm(false)
            setEditServer(null)
          }}
        />
      )}

      {testResult && (
        <McpTestResult result={testResult} onClose={() => setTestResult(null)} />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={true}
          title="Delete MCP Server"
          message={`Delete "${deleteTarget.name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
