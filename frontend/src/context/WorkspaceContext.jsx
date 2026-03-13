import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
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
  const prevWorkspacesRef = useRef(null)

  // Derive current user's role from activeWorkspace response (includes role field)
  const currentUserRole = activeWorkspace?.role || null

  const checkForChanges = useCallback((newWorkspaces) => {
    if (prevWorkspacesRef.current === null) {
      // First load — populate ref, no toasts
      prevWorkspacesRef.current = new Map(newWorkspaces.map((w) => [w.id, { name: w.name, role: w.role }]))
      return
    }
    const prev = prevWorkspacesRef.current
    for (const ws of newWorkspaces) {
      const old = prev.get(ws.id)
      if (!old) {
        toast(`You were added to "${ws.name}" as ${ws.role}`, { icon: '🔔' })
      } else if (old.role !== ws.role) {
        toast(`Your role in "${ws.name}" changed to ${ws.role}`, { icon: '🔔' })
      }
    }
    prevWorkspacesRef.current = new Map(newWorkspaces.map((w) => [w.id, { name: w.name, role: w.role }]))
  }, [])

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
      checkForChanges(res.data)
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
  }, [loadMembers, checkForChanges])

  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  // Poll for workspace changes every 30 seconds
  const loadWorkspacesRef = useRef(loadWorkspaces)
  loadWorkspacesRef.current = loadWorkspaces
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => loadWorkspacesRef.current(), 30000)
    return () => clearInterval(interval)
  }, [user])

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
