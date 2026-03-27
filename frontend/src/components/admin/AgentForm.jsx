import { useState } from 'react'
import { X, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAgentAdmin } from '../../context/AgentAdminContext'
import ToolBuilder from './ToolBuilder'

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const THINKING_MODES = ['disabled', 'manual', 'adaptive']
const EFFORT_LEVELS = ['low', 'medium', 'high']

function defaultForm() {
  return {
    agent_id: '',
    name: '',
    model: '',
    system_prompt: '',
    temperature: 1.0,
    max_tokens: 4096,
    use_prompt_cache: false,
    client_tools: [],
    mcp_server_ids: [],
    sub_agent_ids: [],
    thinking_mode: 'disabled',
    thinking_budget_tokens: 1024,
    thinking_effort: 'medium',
    observation_masking_enabled: false,
    observation_masking_recent_window_turns: 3,
    version_comment: '',
  }
}

function formFromAgent(agent) {
  return {
    agent_id: agent.agent_id,
    name: agent.name,
    model: agent.model || '',
    system_prompt: agent.system_prompt || '',
    temperature: agent.temperature ?? 1.0,
    max_tokens: agent.max_tokens ?? 4096,
    use_prompt_cache: agent.use_prompt_cache ?? false,
    client_tools: agent.client_tools || [],
    mcp_server_ids: agent.mcp_server_ids || [],
    sub_agent_ids: agent.sub_agent_ids || [],
    thinking_mode: agent.thinking_mode || 'disabled',
    thinking_budget_tokens: agent.thinking_budget_tokens ?? 1024,
    thinking_effort: agent.thinking_effort || 'medium',
    observation_masking_enabled: agent.observation_masking_enabled ?? false,
    observation_masking_recent_window_turns: agent.observation_masking_recent_window_turns ?? 3,
    version_comment: '',
  }
}

function Section({ title, expanded, onToggle, children }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        {title}
      </button>
      {expanded && <div className="px-4 py-4 space-y-4">{children}</div>}
    </div>
  )
}

export default function AgentForm({ agent, onClose }) {
  const isEdit = !!agent
  const { createAgent, updateAgent, models, mcpServers, agents } = useAgentAdmin()
  const [form, setForm] = useState(isEdit ? formFromAgent(agent) : defaultForm())
  const [submitting, setSubmitting] = useState(false)

  // Sections open state
  const [sections, setSections] = useState({
    parameters: false,
    tools: false,
    integrations: false,
    advanced: false,
  })

  const toggleSection = (key) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const set = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleNameChange = (value) => {
    set('name', value)
    if (!isEdit) {
      set('agent_id', slugify(value))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!form.agent_id.trim()) {
      toast.error('Agent ID is required')
      return
    }
    if (isEdit && !form.version_comment.trim()) {
      toast.error('Version comment is required for updates')
      return
    }

    setSubmitting(true)
    try {
      if (isEdit) {
        await updateAgent(agent.agent_id, form)
      } else {
        await createAgent(form)
      }
      onClose()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save agent')
    } finally {
      setSubmitting(false)
    }
  }

  const otherAgents = agents.filter(a => a.agent_id !== form.agent_id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit Agent' : 'Create Agent'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* === Basic (always open) === */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-800">Basic</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="My Agent"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Agent ID</label>
                <input
                  type="text"
                  value={form.agent_id}
                  onChange={e => set('agent_id', e.target.value)}
                  readOnly={isEdit}
                  placeholder="my-agent"
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${isEdit ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
              <select
                value={form.model}
                onChange={e => set('model', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Select a model...</option>
                {models.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.display_name} ({m.vendor}) — ${m.input_price}/${m.output_price} per 1M
                  </option>
                ))}
              </select>
            </div>
            {isEdit && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Version Comment <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.version_comment}
                  onChange={e => set('version_comment', e.target.value)}
                  placeholder="Describe what changed..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
            )}
          </div>

          {/* === System Prompt (always open) === */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-800">System Prompt</h3>
            <textarea
              value={form.system_prompt}
              onChange={e => set('system_prompt', e.target.value)}
              rows={6}
              placeholder="You are a helpful assistant..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-y"
            />
          </div>

          {/* === Parameters (collapsed) === */}
          <Section title="Parameters" expanded={sections.parameters} onToggle={() => toggleSection('parameters')}>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Temperature: <span className="text-purple-600 font-semibold">{form.temperature}</span>
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={form.temperature}
                onChange={e => set('temperature', parseFloat(e.target.value))}
                className="w-full accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0 (Precise)</span>
                <span>2 (Creative)</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Tokens</label>
              <input
                type="number"
                value={form.max_tokens}
                onChange={e => set('max_tokens', parseInt(e.target.value) || 0)}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="use_prompt_cache"
                checked={form.use_prompt_cache}
                onChange={e => set('use_prompt_cache', e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="use_prompt_cache" className="text-sm text-gray-700">Enable prompt caching</label>
            </div>
          </Section>

          {/* === Client Tools (collapsed) === */}
          <Section title="Client Tools" expanded={sections.tools} onToggle={() => toggleSection('tools')}>
            <ToolBuilder tools={form.client_tools} onChange={val => set('client_tools', val)} />
          </Section>

          {/* === Integrations (collapsed) === */}
          <Section title="Integrations" expanded={sections.integrations} onToggle={() => toggleSection('integrations')}>
            {/* MCP Servers */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">MCP Servers</label>
              {mcpServers.length === 0 ? (
                <p className="text-xs text-gray-400">No MCP servers configured</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {mcpServers.map(s => (
                    <label key={s.mcp_server_id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.mcp_server_ids.includes(s.mcp_server_id)}
                        onChange={e => {
                          if (e.target.checked) {
                            set('mcp_server_ids', [...form.mcp_server_ids, s.mcp_server_id])
                          } else {
                            set('mcp_server_ids', form.mcp_server_ids.filter(id => id !== s.mcp_server_id))
                          }
                        }}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Sub-Agents */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Sub-Agents</label>
              {otherAgents.length === 0 ? (
                <p className="text-xs text-gray-400">No other agents available</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {otherAgents.map(a => (
                    <label key={a.agent_id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.sub_agent_ids.includes(a.agent_id)}
                        onChange={e => {
                          if (e.target.checked) {
                            set('sub_agent_ids', [...form.sub_agent_ids, a.agent_id])
                          } else {
                            set('sub_agent_ids', form.sub_agent_ids.filter(id => id !== a.agent_id))
                          }
                        }}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      {a.name} <span className="text-xs text-gray-400 font-mono">({a.agent_id})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* === Advanced (collapsed) === */}
          <Section title="Advanced" expanded={sections.advanced} onToggle={() => toggleSection('advanced')}>
            {/* Thinking Config */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Thinking</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mode</label>
                  <select
                    value={form.thinking_mode}
                    onChange={e => set('thinking_mode', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    {THINKING_MODES.map(m => (
                      <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Budget Tokens</label>
                  <input
                    type="number"
                    value={form.thinking_budget_tokens}
                    onChange={e => set('thinking_budget_tokens', parseInt(e.target.value) || 0)}
                    min="0"
                    disabled={form.thinking_mode === 'disabled'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:text-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Effort</label>
                  <select
                    value={form.thinking_effort}
                    onChange={e => set('thinking_effort', e.target.value)}
                    disabled={form.thinking_mode === 'disabled'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    {EFFORT_LEVELS.map(l => (
                      <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Observation Masking */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Observation Masking</h4>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="obs_masking"
                  checked={form.observation_masking_enabled}
                  onChange={e => set('observation_masking_enabled', e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="obs_masking" className="text-sm text-gray-700">Enable observation masking</label>
              </div>
              {form.observation_masking_enabled && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Recent Window Turns</label>
                  <input
                    type="number"
                    value={form.observation_masking_recent_window_turns}
                    onChange={e => set('observation_masking_recent_window_turns', parseInt(e.target.value) || 0)}
                    min="1"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              )}
            </div>
          </Section>
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
            {submitting ? 'Saving...' : isEdit ? 'Update Agent' : 'Create Agent'}
          </button>
        </div>
      </div>
    </div>
  )
}
