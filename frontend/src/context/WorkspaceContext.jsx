import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  fetchWorkspaces,
  createWorkspace as apiCreate,
  updateWorkspace as apiUpdate,
  deleteWorkspace as apiDelete,
} from '../api/workspaces'

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces] = useState([])
  const [activeWorkspace, setActiveWorkspace] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadWorkspaces = useCallback(async () => {
    try {
      const res = await fetchWorkspaces()
      setWorkspaces(res.data)
      // Set active workspace from localStorage or default to first
      const savedId = localStorage.getItem('activeWorkspaceId')
      const saved = res.data.find((w) => w.id === Number(savedId))
      setActiveWorkspace(saved || res.data[0] || null)
    } catch {
      setWorkspaces([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  const switchWorkspace = useCallback((workspace) => {
    setActiveWorkspace(workspace)
    localStorage.setItem('activeWorkspaceId', String(workspace.id))
  }, [])

  const addWorkspace = useCallback(async (data) => {
    const res = await apiCreate(data)
    const newWs = res.data
    setWorkspaces((prev) => [...prev, newWs])
    switchWorkspace(newWs)
    return newWs
  }, [switchWorkspace])

  const editWorkspace = useCallback(async (id, data) => {
    const res = await apiUpdate(id, data)
    const updated = res.data
    setWorkspaces((prev) => prev.map((w) => (w.id === id ? updated : w)))
    if (activeWorkspace?.id === id) setActiveWorkspace(updated)
    return updated
  }, [activeWorkspace])

  const removeWorkspace = useCallback(async (id) => {
    await apiDelete(id)
    setWorkspaces((prev) => {
      const remaining = prev.filter((w) => w.id !== id)
      if (activeWorkspace?.id === id && remaining.length > 0) {
        switchWorkspace(remaining[0])
      }
      return remaining
    })
  }, [activeWorkspace, switchWorkspace])

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        loading,
        switchWorkspace,
        addWorkspace,
        editWorkspace,
        removeWorkspace,
        reload: loadWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspaces() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspaces must be used within WorkspaceProvider')
  return ctx
}
