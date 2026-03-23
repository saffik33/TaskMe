import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, Code } from 'lucide-react'

const PARAM_TYPES = ['string', 'number', 'boolean', 'object', 'array']

const emptyTool = () => ({
  name: '',
  description: '',
  parameters: [],
})

const emptyParam = () => ({
  name: '',
  type: 'string',
  description: '',
  required: false,
})

export default function ToolBuilder({ tools, onChange }) {
  const [expanded, setExpanded] = useState({})
  const [rawMode, setRawMode] = useState(false)
  const [rawJson, setRawJson] = useState('')
  const [rawError, setRawError] = useState('')

  const toggleExpand = (idx) => {
    setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  const updateTool = (idx, field, value) => {
    const updated = tools.map((t, i) => i === idx ? { ...t, [field]: value } : t)
    onChange(updated)
  }

  const addTool = () => {
    onChange([...tools, emptyTool()])
    setExpanded(prev => ({ ...prev, [tools.length]: true }))
  }

  const removeTool = (idx) => {
    onChange(tools.filter((_, i) => i !== idx))
  }

  const updateParam = (toolIdx, paramIdx, field, value) => {
    const updated = tools.map((t, ti) => {
      if (ti !== toolIdx) return t
      const params = t.parameters.map((p, pi) => pi === paramIdx ? { ...p, [field]: value } : p)
      return { ...t, parameters: params }
    })
    onChange(updated)
  }

  const addParam = (toolIdx) => {
    const updated = tools.map((t, i) => i === toolIdx ? { ...t, parameters: [...t.parameters, emptyParam()] } : t)
    onChange(updated)
  }

  const removeParam = (toolIdx, paramIdx) => {
    const updated = tools.map((t, ti) => {
      if (ti !== toolIdx) return t
      return { ...t, parameters: t.parameters.filter((_, pi) => pi !== paramIdx) }
    })
    onChange(updated)
  }

  const switchToRaw = () => {
    setRawJson(JSON.stringify(tools, null, 2))
    setRawError('')
    setRawMode(true)
  }

  const switchToVisual = () => {
    try {
      const parsed = JSON.parse(rawJson)
      if (!Array.isArray(parsed)) {
        setRawError('Must be a JSON array')
        return
      }
      onChange(parsed)
      setRawError('')
      setRawMode(false)
    } catch (err) {
      setRawError('Invalid JSON: ' + err.message)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Client Tools ({tools.length})</span>
        <button
          type="button"
          onClick={rawMode ? switchToVisual : switchToRaw}
          className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium"
        >
          <Code className="w-3.5 h-3.5" />
          {rawMode ? 'Visual Editor' : 'Raw JSON'}
        </button>
      </div>

      {rawMode ? (
        <div className="space-y-2">
          <textarea
            value={rawJson}
            onChange={e => { setRawJson(e.target.value); setRawError('') }}
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          {rawError && <p className="text-xs text-red-600">{rawError}</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {tools.map((tool, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(idx)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-700"
                >
                  {expanded[idx] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  {tool.name || `Tool ${idx + 1}`}
                </button>
                <button
                  type="button"
                  onClick={() => removeTool(idx)}
                  className="p-1 text-gray-400 hover:text-red-600 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {expanded[idx] && (
                <div className="p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                      <input
                        type="text"
                        value={tool.name}
                        onChange={e => updateTool(idx, 'name', e.target.value)}
                        placeholder="tool_name"
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                      <input
                        type="text"
                        value={tool.description}
                        onChange={e => updateTool(idx, 'description', e.target.value)}
                        placeholder="What this tool does"
                        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                  </div>

                  {/* Parameters Table */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-600">Parameters</label>
                      <button
                        type="button"
                        onClick={() => addParam(idx)}
                        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                    {tool.parameters.length > 0 && (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="text-left pb-1 font-medium">Name</th>
                            <th className="text-left pb-1 font-medium">Type</th>
                            <th className="text-left pb-1 font-medium">Description</th>
                            <th className="text-center pb-1 font-medium">Req</th>
                            <th className="w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {tool.parameters.map((param, pi) => (
                            <tr key={pi}>
                              <td className="py-1 pr-1">
                                <input
                                  type="text"
                                  value={param.name}
                                  onChange={e => updateParam(idx, pi, 'name', e.target.value)}
                                  placeholder="param"
                                  className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                              </td>
                              <td className="py-1 pr-1">
                                <select
                                  value={param.type}
                                  onChange={e => updateParam(idx, pi, 'type', e.target.value)}
                                  className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                  {PARAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </td>
                              <td className="py-1 pr-1">
                                <input
                                  type="text"
                                  value={param.description}
                                  onChange={e => updateParam(idx, pi, 'description', e.target.value)}
                                  placeholder="Description"
                                  className="w-full px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                              </td>
                              <td className="py-1 text-center">
                                <input
                                  type="checkbox"
                                  checked={param.required}
                                  onChange={e => updateParam(idx, pi, 'required', e.target.checked)}
                                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                              </td>
                              <td className="py-1 text-right">
                                <button
                                  type="button"
                                  onClick={() => removeParam(idx, pi)}
                                  className="p-0.5 text-gray-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {tool.parameters.length === 0 && (
                      <p className="text-xs text-gray-400 py-1">No parameters defined</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addTool}
            className="flex items-center gap-2 w-full justify-center py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Tool
          </button>
        </div>
      )}
    </div>
  )
}
