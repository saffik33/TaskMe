import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  fetchWorkspaces,
  fetchMembers as apiFetchMembers,
  inviteMember as apiInvite,
  removeMember as apiRemove,
  changeRole as apiChangeRole,
  createWorkspace as apiCreate,
  updateWorkspace as apiUpdate,
  deleteWorkspace as apiDelete,
} from '../api/workspaces'
import { useAuth } from './AuthContext'

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const { user } = useAuth()
  const [workspaces, setWorkspaces] = useState([])
  const [activeWorkspace, setActiveWorkspace] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  // Derive current user's role from activeWorkspace response (includes role field)
  const currentUserRole = activeWorkspace?.role || null

  const loadMembers = useCallback(async (wsId) => {
    if (!wsId) return
    try {
      const res = await apiFetchMembers(wsId)
      setMembers(res.data)
    } catch {
      setMembers({ members: [], pending_invites: [] })
    }
  }, [])

  const loadWorkspaces = useCallback(async () => {
    try {
      const res = await fetchWorkspaces()
      setWorkspaces(res.data)
      const savedId = sessionStorage.getItem('activeWorkspaceId')
      const saved = res.data.find((w) => w.id === Number(savedId))
      const active = saved || res.data[0] || null
      setActiveWorkspace(active)
      if (active) loadMembers(active.id)
    } catch {
      setWorkspaces([])
    } finally {
      setLoading(false)
    }
  }, [loadMembers])

  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  const switchWorkspace = useCallback((workspace) => {
    setActiveWorkspace(workspace)
    sessionStorage.setItem('activeWorkspaceId', String(workspace.id))
    loadMembers(workspace.id)
  }, [loadMembers])

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

  const inviteMember = useCallback(async (email, role) => {
    if (!activeWorkspace) return
    const res = await apiInvite(activeWorkspace.id, email, role)
    await loadMembers(activeWorkspace.id)
    return res.data
  }, [activeWorkspace, loadMembers])

  const removeMemberFromWorkspace = useCallback(async (userId) => {
    if (!activeWorkspace) return
    await apiRemove(activeWorkspace.id, userId)
    await loadMembers(activeWorkspace.id)
  }, [activeWorkspace, loadMembers])

  const changeMemberRole = useCallback(async (userId, role) => {
    if (!activeWorkspace) return
    await apiChangeRole(activeWorkspace.id, userId, role)
    await loadMembers(activeWorkspace.id)
  }, [activeWorkspace, loadMembers])

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        members,
        currentUserRole,
        loading,
        switchWorkspace,
        addWorkspace,
        editWorkspace,
        removeWorkspace,
        inviteMember,
        removeMember: removeMemberFromWorkspace,
        changeMemberRole,
        loadMembers,
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
