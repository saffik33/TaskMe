import { useState } from 'react'
import { Plus, Download, Share2, Loader2, Trash2, Settings, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTasks } from '../context/TaskContext'
import { useColumns } from '../context/ColumnContext'
import NaturalLanguageInput from '../components/NaturalLanguageInput'
import TaskFilters from '../components/TaskFilters'
import TaskTable from '../components/TaskTable'
import TaskBoard from '../components/TaskBoard'
import TaskModal from '../components/TaskModal'
import ConfirmDialog from '../components/ConfirmDialog'
import ShareDialog from '../components/ShareDialog'
import ColumnManager from '../components/ColumnManager'
import { exportExcel, sendNotification } from '../api/tasks'

export default function Dashboard() {
  const { tasks, loading, addTask, editTask, removeTask, removeBulkTasks } = useTasks()
  const { columns } = useColumns()

  const [view, setView] = useState('table')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [deleteTask, setDeleteTask] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [rowSelection, setRowSelection] = useState({})
  const [deleteSelectedConfirm, setDeleteSelectedConfirm] = useState(false)
  const [columnManagerOpen, setColumnManagerOpen] = useState(false)

  const handleOpenCreate = () => {
    setEditingTask(null)
    setModalOpen(true)
  }

  const handleEdit = (task) => {
    setEditingTask(task)
    setModalOpen(true)
  }

  const handleSave = async (data) => {
    try {
      if (editingTask?.id) {
        await editTask(editingTask.id, data)
        toast.success('Task updated')
      } else {
        await addTask(data)
        toast.success('Task created')
      }
      setModalOpen(false)
      setEditingTask(null)
    } catch {
      toast.error('Failed to save task')
    }
  }

  const handleDelete = async () => {
    if (!deleteTask) return
    try {
      await removeTask(deleteTask.id)
      toast.success('Task deleted')
      setDeleteTask(null)
    } catch {
      toast.error('Failed to delete task')
    }
  }

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]).map(Number)
  const selectedCount = selectedIds.length

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    try {
      await removeBulkTasks(selectedIds)
      toast.success(`${selectedIds.length} task(s) deleted`)
      setRowSelection({})
      setDeleteSelectedConfirm(false)
    } catch {
      toast.error('Failed to delete selected tasks')
    }
  }

  const handleFieldChange = async (taskId, field, value, displayLabel) => {
    try {
      const payload = field === 'custom_fields'
        ? { custom_fields: value }
        : { [field]: value || null }
      await editTask(taskId, payload)
      if (!displayLabel) {
        const col = columns.find((c) => c.field_key === field)
        displayLabel = col?.display_name || field
      }
      toast.success(`${displayLabel} updated`)
    } catch {
      toast.error('Failed to update task')
    }
  }

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await editTask(taskId, { status: newStatus })
      toast.success(`Task moved to ${newStatus}`)
    } catch {
      toast.error('Failed to move task')
    }
  }

  const handleNotify = async (task) => {
    try {
      await sendNotification([task.id], 'You have a task assigned to you.')
      toast.success(`Email sent to ${task.email}`)
    } catch {
      toast.error('Failed to send notification')
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await exportExcel(selectedCount > 0 ? { ids: selectedIds.join(',') } : {})
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `taskme_export.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success(selectedCount > 0 ? `Exported ${selectedCount} task(s)` : 'All tasks exported')
    } catch {
      toast.error('Failed to export')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <NaturalLanguageInput />

      {/* Actions bar */}
      <div className="flex items-center justify-between gap-3">
        <TaskFilters view={view} onViewChange={setView} />
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setColumnManagerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            title="Manage columns"
          >
            <Settings className="w-4 h-4" /> Columns
          </button>
          <button
            onClick={() => setDeleteSelectedConfirm(true)}
            disabled={selectedCount === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors text-gray-400 bg-white border-gray-200 opacity-50 cursor-not-allowed${selectedCount > 0 ? ' invisible' : ''}`}
            title="Delete selected tasks"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || tasks.length === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50${selectedCount > 0 ? ' invisible' : ''}`}
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export
          </button>
          <button
            onClick={() => setShareOpen(true)}
            disabled={tasks.length === 0}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50${selectedCount > 0 ? ' invisible' : ''}`}
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </div>

      {/* Selection bar */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
          <span className="text-sm font-medium text-indigo-700">
            {selectedCount} task(s) selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDeleteSelectedConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete ({selectedCount})
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Export ({selectedCount})
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Share2 className="w-4 h-4" /> Share ({selectedCount})
            </button>
            <button
              onClick={() => setRowSelection({})}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" /> Clear
            </button>
          </div>
        </div>
      )}

      {/* Task display */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : view === 'table' ? (
        <TaskTable
          tasks={tasks}
          onEdit={handleEdit}
          onDelete={setDeleteTask}
          onNotify={handleNotify}
          onFieldChange={handleFieldChange}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        />
      ) : (
        <TaskBoard
          tasks={tasks}
          onEdit={handleEdit}
          onDelete={setDeleteTask}
          onNotify={handleNotify}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Modals */}
      <TaskModal
        open={modalOpen}
        task={editingTask}
        onSave={handleSave}
        onClose={() => {
          setModalOpen(false)
          setEditingTask(null)
        }}
      />

      <ConfirmDialog
        open={!!deleteTask}
        title="Delete Task"
        message={`Are you sure you want to delete "${deleteTask?.task_name}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTask(null)}
      />

      <ConfirmDialog
        open={deleteSelectedConfirm}
        title="Delete Selected Tasks"
        message={`Are you sure you want to delete ${selectedCount} selected task(s)? This action cannot be undone.`}
        onConfirm={handleDeleteSelected}
        onCancel={() => setDeleteSelectedConfirm(false)}
      />

      <ShareDialog
        open={shareOpen}
        taskIds={selectedCount > 0 ? selectedIds : tasks.map((t) => t.id)}
        onClose={() => setShareOpen(false)}
      />

      <ColumnManager
        open={columnManagerOpen}
        onClose={() => setColumnManagerOpen(false)}
      />
    </div>
  )
}
