import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Eye, EyeOff, Trash2, Plus, Lock, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useColumns } from '../context/ColumnContext'

const PROTECTED_VISIBILITY = new Set(['task_name', 'status', 'priority'])
const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
]

function arrayMove(arr, from, to) {
  const result = [...arr]
  const [item] = result.splice(from, 1)
  result.splice(to, 0, item)
  return result
}

function SortableRow({ col, onToggleVisibility, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: col.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isProtected = PROTECTED_VISIBILITY.has(col.field_key)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-100 rounded-lg"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <span className="flex-1 text-sm font-medium text-gray-700 truncate">
        {col.display_name}
      </span>

      <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-50 rounded">
        {col.field_type}
      </span>

      {isProtected ? (
        <span className="text-xs text-gray-400 flex items-center gap-1 whitespace-nowrap">
          <Lock className="w-3 h-3" /> Locked
        </span>
      ) : (
        <button
          onClick={() => onToggleVisibility(col)}
          className="p-1 rounded hover:bg-gray-100"
          title={col.is_visible ? 'Hide column' : 'Show column'}
        >
          {col.is_visible ? (
            <Eye className="w-4 h-4 text-indigo-500" />
          ) : (
            <EyeOff className="w-4 h-4 text-gray-400" />
          )}
        </button>
      )}

      {col.is_core ? (
        <div className="w-8" />
      ) : (
        <button
          onClick={() => onDelete(col)}
          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
          title="Delete column"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export default function ColumnManager({ open, onClose }) {
  const { columns, addColumn, editColumn, reorder, removeColumn } = useColumns()
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('text')
  const [newOptions, setNewOptions] = useState('')
  const [adding, setAdding] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const sorted = [...columns].sort((a, b) => a.position - b.position)

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sorted.findIndex((c) => c.id === active.id)
    const newIndex = sorted.findIndex((c) => c.id === over.id)
    const reordered = arrayMove(sorted, oldIndex, newIndex)

    const positions = reordered.map((col, idx) => ({ id: col.id, position: idx }))
    try {
      await reorder(positions)
    } catch {
      toast.error('Failed to reorder columns')
    }
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    try {
      const data = { display_name: newName.trim(), field_type: newType }
      if (newType === 'select' && newOptions.trim()) {
        data.options = JSON.stringify(
          newOptions.split(',').map((o) => o.trim()).filter(Boolean),
        )
      }
      await addColumn(data)
      setNewName('')
      setNewType('text')
      setNewOptions('')
      toast.success('Column added')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add column')
    } finally {
      setAdding(false)
    }
  }

  const handleToggleVisibility = async (col) => {
    try {
      await editColumn(col.id, { is_visible: !col.is_visible })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update column')
    }
  }

  const handleDelete = async (col) => {
    try {
      await removeColumn(col.id)
      toast.success(`"${col.display_name}" column removed`)
    } catch {
      toast.error('Failed to delete column')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Manage Columns</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add column form */}
        <div className="px-5 py-3 border-b border-gray-100 space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Add Custom Column
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Column name"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>
                  {ft.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || adding}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          {newType === 'select' && (
            <input
              type="text"
              value={newOptions}
              onChange={(e) => setNewOptions(e.target.value)}
              placeholder="Options (comma-separated, e.g. Sprint 1, Sprint 2, Sprint 3)"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
        </div>

        {/* Column list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sorted.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {sorted.map((col) => (
                <SortableRow
                  key={col.id}
                  col={col}
                  onToggleVisibility={handleToggleVisibility}
                  onDelete={handleDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
