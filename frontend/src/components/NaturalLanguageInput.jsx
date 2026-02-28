import { useState } from 'react'
import { Sparkles, Save, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTasks } from '../context/TaskContext'
import { useColumns } from '../context/ColumnContext'
import { TASK_PRIORITIES } from '../utils/constants'
import CustomSelect from './CustomSelect'

export default function NaturalLanguageInput() {
  const { parseTasks, addBulkTasks } = useTasks()
  const { columns } = useColumns()
  const [text, setText] = useState('')
  const [provider, setProvider] = useState('openai')
  const [tone, setTone] = useState('none')
  const [parsing, setParsing] = useState(false)
  const [parsedTasks, setParsedTasks] = useState(null)

  const handleParse = async () => {
    if (!text.trim()) return
    setParsing(true)
    try {
      const tasks = await parseTasks(text, provider, tone)
      setParsedTasks(tasks)
      toast.success(`Parsed ${tasks.length} task(s)`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to parse tasks')
    } finally {
      setParsing(false)
    }
  }

  const handleSaveAll = async () => {
    if (!parsedTasks?.length) return
    try {
      const tasksToCreate = parsedTasks.map((t) => ({
        task_name: t.task_name,
        description: t.description || null,
        owner: t.owner || null,
        email: t.email || null,
        start_date: t.start_date || null,
        due_date: t.due_date || null,
        status: 'To Do',
        priority: t.priority || 'Medium',
        custom_fields: t.custom_fields ? JSON.stringify(t.custom_fields) : null,
      }))
      await addBulkTasks(tasksToCreate)
      toast.success(`Saved ${tasksToCreate.length} task(s)`)
      setParsedTasks(null)
      setText('')
    } catch (err) {
      toast.error('Failed to save tasks')
    }
  }

  const updateParsedTask = (index, field, value) => {
    setParsedTasks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    )
  }

  const removeParsedTask = (index) => {
    setParsedTasks((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      {/* Input area */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <label className="block text-sm font-medium text-purple-600 mb-2">
          Describe your tasks in plain English
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. John needs to finish the quarterly report by March 15. Sarah should review the budget proposal next week - it's urgent. Mike will set up the new server, email: mike@company.com"
          rows={4}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none placeholder:text-gray-400"
        />
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <CustomSelect
              value={provider}
              onChange={setProvider}
              options={[
                { value: 'openai', label: 'OpenAI' },
                { value: 'anthropic', label: 'Anthropic' },
              ]}
              placeholder="Provider"
            />
            <CustomSelect
              value={tone}
              onChange={setTone}
              options={[
                { value: 'none', label: 'None' },
                { value: 'professional', label: 'Professional' },
                { value: 'executive', label: 'Executive' },
                { value: 'friendly', label: 'Friendly' },
                { value: 'concise', label: 'Concise' },
              ]}
              placeholder="Tone"
            />
          </div>
          <button
            onClick={handleParse}
            disabled={parsing || !text.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
          >
            {parsing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {parsing ? 'Creating...' : 'Create Tasks'}
          </button>
        </div>
      </div>

      {/* Parsed preview */}
      {parsedTasks && parsedTasks.length > 0 && (
        <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Parsed Tasks ({parsedTasks.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setParsedTasks(null)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                <X className="w-3.5 h-3.5" /> Discard
              </button>
              <button
                onClick={handleSaveAll}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                <Save className="w-3.5 h-3.5" /> Save All
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {parsedTasks.map((task, i) => (
              <div
                key={i}
                className="border border-gray-200 rounded-lg p-4 bg-gray-50 relative group"
              >
                <button
                  onClick={() => removeParsedTask(i)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
                <input
                  value={task.task_name}
                  onChange={(e) => updateParsedTask(i, 'task_name', e.target.value)}
                  className="w-full text-sm font-semibold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none pb-1 mb-2"
                />
                <div className="space-y-1.5 text-xs text-gray-500">
                  {task.owner && (
                    <div>
                      <span className="text-gray-400">Owner:</span>{' '}
                      <input
                        value={task.owner}
                        onChange={(e) => updateParsedTask(i, 'owner', e.target.value)}
                        className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  )}
                  {task.due_date && (
                    <div>
                      <span className="text-gray-400">Due:</span>{' '}
                      <input
                        type="date"
                        value={task.due_date}
                        onChange={(e) => updateParsedTask(i, 'due_date', e.target.value)}
                        className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400">Priority:</span>{' '}
                    <select
                      value={task.priority}
                      onChange={(e) => updateParsedTask(i, 'priority', e.target.value)}
                      className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none"
                    >
                      {TASK_PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {task.custom_fields && Object.entries(task.custom_fields).map(([key, val]) => {
                    const col = columns.find((c) => c.field_key === key)
                    return (
                      <div key={key}>
                        <span className="text-gray-400">{col?.display_name || key}:</span>{' '}
                        <span className="text-gray-700">{String(val)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
