import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TASK_STATUSES } from '../utils/constants'
import TaskCard from './TaskCard'

function DroppableColumn({ status, tasks, onEdit, onDelete, onNotify }) {
  const { setNodeRef, isOver } = useDroppable({ id: status.value })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{status.label}</h3>
        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[100px] rounded-lg p-2 transition-colors ${
          isOver
            ? 'bg-indigo-50 border-2 border-dashed border-indigo-300'
            : 'bg-gray-50'
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onDelete={onDelete}
              onNotify={onNotify}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && !isOver && (
          <p className="text-xs text-gray-400 text-center py-8">No tasks</p>
        )}
        {tasks.length === 0 && isOver && (
          <p className="text-xs text-indigo-400 text-center py-8">Drop here</p>
        )}
      </div>
    </div>
  )
}

export default function TaskBoard({ tasks, onEdit, onDelete, onNotify, onStatusChange }) {
  const [activeTask, setActiveTask] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const columns = TASK_STATUSES.map((status) => ({
    ...status,
    tasks: tasks.filter((t) => t.status === status.value),
  }))

  const handleDragStart = (event) => {
    const task = tasks.find((t) => t.id === event.active.id)
    setActiveTask(task || null)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const taskId = active.id
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    // Determine the target status — `over.id` could be a column ID (status string)
    // or another task's ID (number). If it's a task, find which column that task is in.
    let newStatus = null
    if (typeof over.id === 'string' && TASK_STATUSES.some((s) => s.value === over.id)) {
      newStatus = over.id
    } else {
      const overTask = tasks.find((t) => t.id === over.id)
      if (overTask) newStatus = overTask.status
    }

    if (newStatus && newStatus !== task.status) {
      onStatusChange(taskId, newStatus)
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500 text-sm">No tasks yet. Use the input above to create tasks from natural language!</p>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map((col) => (
          <DroppableColumn
            key={col.value}
            status={col}
            tasks={col.tasks}
            onEdit={onEdit}
            onDelete={onDelete}
            onNotify={onNotify}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <div className="rotate-2 scale-105">
            <TaskCard task={activeTask} onEdit={() => {}} onDelete={() => {}} onNotify={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
