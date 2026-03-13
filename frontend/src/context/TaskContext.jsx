import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import * as api from '../api/tasks'
import { useWorkspaces } from './WorkspaceContext'

const TaskContext = createContext()

const normalizeTask = (task) => ({
  ...task,
  _customFields: task.custom_fields ? JSON.parse(task.custom_fields) : {},
})

export function TaskProvider({ children }) {
  const { activeWorkspace } = useWorkspaces()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const prevTasksHashRef = useRef(null)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    priority: '',
    statuses: '',
    priorities: '',
    owner: '',
    date_from: '',
    date_to: '',
    sort_by: 'created_at',
    order: 'desc',
  })

  const loadTasks = useCallback(async () => {
    if (!activeWorkspace) return
    setLoading(true)
    try {
      const params = { workspace_id: activeWorkspace.id }
      if (filters.search) params.search = filters.search
      if (filters.status) params.status = filters.status
      if (filters.priority) params.priority = filters.priority
      if (filters.owner) params.owner = filters.owner
      if (filters.statuses) params.statuses = filters.statuses
      if (filters.priorities) params.priorities = filters.priorities
      if (filters.date_from) params.date_from = filters.date_from
      if (filters.date_to) params.date_to = filters.date_to
      params.sort_by = filters.sort_by
      params.order = filters.order

      const res = await api.fetchTasks(params)
      const normalized = res.data.map(normalizeTask)
      prevTasksHashRef.current = JSON.stringify(res.data.map((t) => ({ id: t.id, updated_at: t.updated_at })))
      setTasks(normalized)
    } catch (err) {
      console.error('Failed to load tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [filters, activeWorkspace])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  // Lightweight poll — only updates tasks if data actually changed
  const buildParams = useCallback(() => {
    if (!activeWorkspace) return null
    const params = { workspace_id: activeWorkspace.id }
    if (filters.search) params.search = filters.search
    if (filters.status) params.status = filters.status
    if (filters.priority) params.priority = filters.priority
    if (filters.owner) params.owner = filters.owner
    if (filters.statuses) params.statuses = filters.statuses
    if (filters.priorities) params.priorities = filters.priorities
    if (filters.date_from) params.date_from = filters.date_from
    if (filters.date_to) params.date_to = filters.date_to
    params.sort_by = filters.sort_by
    params.order = filters.order
    return params
  }, [activeWorkspace, filters])

  const pollTasks = useCallback(async () => {
    const params = buildParams()
    if (!params) return
    try {
      const res = await api.fetchTasks(params)
      const hash = JSON.stringify(res.data.map((t) => ({ id: t.id, updated_at: t.updated_at })))
      if (hash === prevTasksHashRef.current) return
      prevTasksHashRef.current = hash
      setTasks(res.data.map(normalizeTask))
    } catch { /* silent */ }
  }, [buildParams])

  const pollTasksRef = useRef(pollTasks)
  pollTasksRef.current = pollTasks
  useEffect(() => {
    if (!activeWorkspace) return
    const interval = setInterval(() => pollTasksRef.current(), 60000)
    return () => clearInterval(interval)
  }, [activeWorkspace])

  const addTask = async (data) => {
    const params = { workspace_id: activeWorkspace.id }
    const res = await api.createTask(data, params)
    const newTask = normalizeTask(res.data)
    setTasks((prev) => [newTask, ...prev])
    return res.data
  }

  const addBulkTasks = async (tasksData) => {
    const params = { workspace_id: activeWorkspace.id }
    const res = await api.createBulkTasks(tasksData, params)
    const newTasks = res.data.map(normalizeTask)
    setTasks((prev) => [...newTasks, ...prev])
    return res.data
  }

  const editTask = async (id, data) => {
    const previousTasks = tasks

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
      await api.deleteAllTasks({ workspace_id: activeWorkspace.id })
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
    const res = await api.parseText(text, provider, tone, activeWorkspace?.id)
    return res.data.tasks
  }

  const smartSearchFilters = async (query, provider) => {
    const res = await api.smartSearch(query, provider)
    const parsed = res.data?.filters

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Smart search returned an invalid response')
    }

    const newFilters = {
      search: parsed.search || '',
      status: '',
      priority: '',
      statuses: Array.isArray(parsed.status) ? parsed.status.join(',') : '',
      priorities: Array.isArray(parsed.priority) ? parsed.priority.join(',') : '',
      owner: parsed.owner || '',
      date_from: parsed.date_from || '',
      date_to: parsed.date_to || '',
      sort_by: parsed.sort_by || 'created_at',
      order: parsed.order || 'desc',
    }

    setFilters(newFilters)
    return parsed
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
        smartSearchFilters,
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
