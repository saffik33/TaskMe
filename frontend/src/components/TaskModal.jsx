import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { TASK_STATUSES, TASK_PRIORITIES } from '../utils/constants'
import { toInputDate } from '../utils/dateHelpers'
import { useColumns } from '../context/ColumnContext'

const emptyTask = {
  task_name: '',
  description: '',
  owner: '',
  email: '',
  start_date: '',
  due_date: '',
  status: 'To Do',
  priority: 'Medium',
}

export default function TaskModal({ open, task, onSave, onClose }) {
  const [form, setForm] = useState(emptyTask)
  const [customForm, setCustomForm] = useState({})
  const { customVisibleColumns } = useColumns()
  const isEdit = !!task?.id

  useEffect(() => {
    if (task) {
      setForm({
        task_name: task.task_name || '',
        description: task.description || '',
        owner: task.owner || '',
        email: task.email || '',
        start_date: toInputDate(task.start_date),
        due_date: toInputDate(task.due_date),
        status: task.status || 'To Do',
        priority: task.priority || 'Medium',
      })
      // Parse existing custom fields
      const cf = task._customFields || (task.custom_fields ? JSON.parse(task.custom_fields) : {})
      setCustomForm(cf)
    } else {
      setForm(emptyTask)
      setCustomForm({})
    }
  }, [task])

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    const data = { ...form }
    if (!data.start_date) data.start_date = null
    if (!data.due_date) data.due_date = null
    if (!data.description) data.description = null
    if (!data.owner) data.owner = null
    if (!data.email) data.email = null

    // Include custom fields if any have values
    const hasCustomValues = Object.values(customForm).some(
      (v) => v !== null && v !== undefined && v !== '',
    )
    if (hasCustomValues) {
      const cleaned = {}
      for (const [key, val] of Object.entries(customForm)) {
        if (val !== null && val !== undefined && val !== '') {
          cleaned[key] = val
        }
      }
      data.custom_fields = JSON.stringify(cleaned)
    }

    onSave(data)
  }

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const setCustom = (fieldKey) => (e) =>
    setCustomForm((f) => ({ ...f, [fieldKey]: e.target.value }))

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-purple-600">
            {isEdit ? 'Edit Task' : 'New Task'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Name *
            </label>
            <input
              value={form.task_name}
              onChange={set('task_name')}
              required
              className={inputClass}
              placeholder="Enter task name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Task details..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Owner
              </label>
              <input
                value={form.owner}
                onChange={set('owner')}
                className={inputClass}
                placeholder="Person responsible"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                className={inputClass}
                placeholder="owner@email.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={set('start_date')}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={set('due_date')}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={set('status')}
                className={inputClass}
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={set('priority')}
                className={inputClass}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic custom fields */}
          {customVisibleColumns.length > 0 && (
            <>
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                  Custom Fields
                </p>
                <div className="space-y-3">
                  {customVisibleColumns.map((col) => {
                    const val = customForm[col.field_key] ?? ''

                    if (col.field_type === 'select') {
                      let opts = []
                      try { opts = JSON.parse(col.options || '[]') } catch { /* ignore */ }
                      return (
                        <div key={col.field_key}>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {col.display_name}
                          </label>
                          <select
                            value={val}
                            onChange={setCustom(col.field_key)}
                            className={inputClass}
                          >
                            <option value="">— Select —</option>
                            {opts.map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        </div>
                      )
                    }

                    return (
                      <div key={col.field_key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {col.display_name}
                        </label>
                        <input
                          type={col.field_type === 'number' ? 'number' : col.field_type === 'date' ? 'date' : 'text'}
                          value={val}
                          onChange={setCustom(col.field_key)}
                          className={inputClass}
                          placeholder={col.display_name}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
            >
              {isEdit ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
