import { Pencil, Trash2, Mail, User, Calendar } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import StatusBadge from './StatusBadge'
import PriorityBadge from './PriorityBadge'
import { formatDate } from '../utils/dateHelpers'

export default function TaskCard({ task, onEdit, onDelete, onNotify }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow group cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 ring-2 ring-indigo-300' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-900 leading-tight flex-1 mr-2">
          {task.task_name}
        </h4>
        <PriorityBadge priority={task.priority} />
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{task.description}</p>
      )}

      <div className="space-y-1.5 text-xs text-gray-500 mb-3">
        {task.owner && (
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-gray-400" />
            <span>{task.owner}</span>
          </div>
        )}
        {task.due_date && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>{formatDate(task.due_date)}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <StatusBadge status={task.status} />
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(task) }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 text-gray-400 hover:text-purple-600 rounded"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task) }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 text-gray-400 hover:text-red-600 rounded"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {task.email && (
            <button
              onClick={(e) => { e.stopPropagation(); onNotify(task) }}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-1 text-gray-400 hover:text-blue-600 rounded"
              title="Notify"
            >
              <Mail className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
