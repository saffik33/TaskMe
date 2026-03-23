import { Bot } from 'lucide-react'
import { useAgent } from '../context/AgentContext'

const MODES = [
  { value: 'manual', label: 'Manual', desc: 'No agent assistance' },
  { value: 'assistive', label: 'Assistive', desc: 'Chat co-pilot for suggestions' },
  { value: 'autonomous', label: 'Autonomous', desc: 'Agent executes automatically' },
]

export default function AgentModeSelector({ mode, agentId, onModeChange, onAgentChange }) {
  const { agentAvailable, templates } = useAgent()

  if (!agentAvailable) return null

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
        <Bot className="w-4 h-4 text-purple-600" />
        AI Agent
      </label>

      {/* Mode radio buttons */}
      <div className="flex gap-2 mb-3">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onModeChange(m.value)}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
              mode === m.value
                ? 'border-purple-500 bg-purple-50 text-purple-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <div>{m.label}</div>
            <div className="text-[10px] font-normal opacity-70 mt-0.5">{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Agent template dropdown — shown for non-manual modes */}
      {mode !== 'manual' && templates.length > 0 && (
        <select
          value={agentId || templates[0]?.agent_id || ''}
          onChange={(e) => onAgentChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {templates.map((t) => (
            <option key={t.agent_id} value={t.agent_id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
