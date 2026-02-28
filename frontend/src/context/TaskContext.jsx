import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as api from '../api/tasks'

const TaskContext = createContext()

const normalizeTask = (task) => ({
  ...task,
  _customFields: task.custom_fields ? JSON.parse(task.custom_fields) : {},
})

export function TaskProvider({ children }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    owner: '',
    sort_by: 'created_at',
    order: 'desc',
  })

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.search) params.search = filters.search
      if (filters.status) params.status = filters.status
      if (filters.priority) params.priority = filters.priority
      if (filters.owner) params.owner = filters.owner
      params.sort_by = filters.sort_by
      params.order = filters.order

      const res = await api.fetchTasks(params)
      setTasks(res.data.map(normalizeTask))
    } catch (err) {
      console.error('Failed to load tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const addTask = async (data) => {
    const res = await api.createTask(data)
    const newTask = normalizeTask(res.data)
    setTasks((prev) => [newTask, ...prev])
    return res.data
  }

  const addBulkTasks = async (tasksData) => {
    const res = await api.createBulkTasks(tasksData)
    const newTasks = res.data.map(normalizeTask)
    setTasks((prev) => [...newTasks, ...prev])
    return res.data
  }

  const editTask = async (id, data) => {
    const previousTasks = tasks

    // Optimistic: update the single task immediately
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const merged = { ...t, ...data }
        if (data.custom_fields !== undefined) {
          merged._customFields = data.custom_fields
            ? JSON.parse(data.custom_fields)
            : {}
        }
        return merged
      })
    )

    try {
      const res = await api.updateTask(id, data)
      const authoritative = normalizeTask(res.data)
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? authoritative : t))
      )
      return res.data
    } catch (err) {
      setTasks(previousTasks)
      throw err
    }
  }

  const removeTask = async (id) => {
    const previousTasks = tasks
    setTasks((prev) => prev.filter((t) => t.id !== id))
    try {
      await api.deleteTask(id)
    } catch (err) {
      setTasks(previousTasks)
      throw err
    }
  }

  const removeAllTasks = async () => {
    const previousTasks = tasks
    setTasks([])
    try {
      await api.deleteAllTasks()
    } catch (err) {
      setTasks(previousTasks)
      throw err
    }
  }

  const removeBulkTasks = async (ids) => {
    const idSet = new Set(ids)
    const previousTasks = tasks
    setTasks((prev) => prev.filter((t) => !idSet.has(t.id)))
    try {
      await api.deleteBulkTasks(ids)
    } catch (err) {
      setTasks(previousTasks)
      throw err
    }
  }

  const parseTasks = async (text, provider, tone) => {
    const res = await api.parseText(text, provider, tone)
    return res.data.tasks
  }

  return (
    <TaskContext.Provider
      value={{
        tasks,
        loading,
        filters,
        setFilters,
        loadTasks,
        addTask,
        addBulkTasks,
        editTask,
        removeTask,
        removeAllTasks,
        removeBulkTasks,
        parseTasks,
      }}
    >
      {children}
    </TaskContext.Provider>
  )
}

export function useTasks() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error('useTasks must be used within TaskProvider')
  return ctx
}
