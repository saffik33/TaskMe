import { useState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAgentAdmin } from '../../context/AgentAdminContext'
import KeyValueEditor from './KeyValueEditor'
import TagInput from './TagInput'

const AUTH_STRATEGIES = ['NONE', 'PASSTHROUGH']

function defaultForm() {
  return {
    name: '',
    description: '',
    host: '',
    port: '443',
    path: '/mcp',
    use_tls: true,
    auth_strategy: 'NONE',
    auto_approve: false,
    headers: {},
    passthrough_headers: [],
  }
}

function formFromServer(server) {
  return {
    name: server.name || '',
    description: server.description || '',
    host: server.host || '',
    port: String(server.port || '443'),
    path: server.path || '/mcp',
    use_tls: server.use_tls ?? true,
    auth_strategy: server.auth_strategy || 'NONE',
    auto_approve: server.auto_approve ?? false,
    headers: server.headers || {},
    passthrough_headers: server.passthrough_headers || [],
  }
}

export default function McpServerForm({ server, onClose }) {
  const isEdit = !!server
  const { createMcpServer, updateMcpServer } = useAgentAdmin()
  const [form, setForm] = useState(isEdit ? formFromServer(server) : defaultForm())
  const [submitting, setSubmitting] = useState(false)

  const set = (field, value) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!/^[a-z0-9-]+$/.test(form.name)) {
      toast.error('Name must be lowercase letters, numbers, and hyphens only')
      return
    }
    if (!form.host.trim()) {
      toast.error('Host is required')
      return
    }
    if (!form.port.trim()) {
      toast.error('Port is required')
      return
    }

    const payload = {
      ...form,
      port: parseInt(form.port, 10),
    }

    setSubmitting(true)
    try {
      if (isEdit) {
        await updateMcpServer(server.mcp_server_id, payload)
      } else {
        await createMcpServer(payload)
      }
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save MCP server')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit MCP Server' : 'Add MCP Server'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="my-mcp-server"
              pattern="[a-z0-9-]+"
              className={inputClass}
            />
            <p className="text-xs text-gray-400 mt-1">Lowercase letters, numbers, and hyphens only</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Optional description..."
              className={inputClass}
            />
          </div>

          {/* Connection */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Host <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.host}
                onChange={(e) => set('host', e.target.value)}
                placeholder="mcp.example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Port <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.port}
                onChange={(e) => set('port', e.target.value)}
                placeholder="443"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Path <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.path}
                onChange={(e) => set('path', e.target.value)}
                placeholder="/mcp"
                className={inputClass}
              />
            </div>
          </div>

          {/* Toggles Row */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="use_tls"
                checked={form.use_tls}
                onChange={(e) => set('use_tls', e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="use_tls" className="text-sm text-gray-700">
                Use TLS
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="auto_approve"
                checked={form.auto_approve}
                onChange={(e) => set('auto_approve', e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="auto_approve" className="text-sm text-gray-700">
                Auto-Approve
              </label>
            </div>
          </div>

          {/* Auth Strategy */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Auth Strategy</label>
            <select
              value={form.auth_strategy}
              onChange={(e) => set('auth_strategy', e.target.value)}
              className={inputClass}
            >
              {AUTH_STRATEGIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Headers */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Headers</label>
            <KeyValueEditor value={form.headers} onChange={(v) => set('headers', v)} />
          </div>

          {/* Passthrough Headers */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Passthrough Headers</label>
            <TagInput
              value={form.passthrough_headers}
              onChange={(v) => set('passthrough_headers', v)}
              placeholder="Header name, press Enter"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : isEdit ? 'Update Server' : 'Add Server'}
          </button>
        </div>
      </div>
    </div>
  )
}
