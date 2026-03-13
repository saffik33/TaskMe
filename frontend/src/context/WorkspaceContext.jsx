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
      prevWorkspacesRef.current = new Map(res.data.map((w) => [w.id, { name: w.name, role: w.role }]))
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

  // Lightweight poll — only fetches workspaces, compares, fires toasts if changed
  const loadWorkspacesRef = useRef(loadWorkspaces)
  loadWorkspacesRef.current = loadWorkspaces
  const pollForChanges = useCallback(async () => {
    try {
      const res = await fetchWorkspaces()
      if (prevWorkspacesRef.current === null) return
      const prev = prevWorkspacesRef.current
      let changed = false
      if (res.data.length !== prev.size) changed = true
      for (const ws of res.data) {
        const old = prev.get(ws.id)
        if (!old) {
          toast(`You were added to "${ws.name}" as ${ws.role}`, { icon: '🔔', duration: 120000 })
          changed = true
        } else if (old.role !== ws.role) {
          toast(`Your role in "${ws.name}" changed to ${ws.role}`, { icon: '🔔', duration: 120000 })
          changed = true
        }
      }
      for (const [id, old] of prev) {
        if (!res.data.find(ws => ws.id === id)) {
          toast(`You were removed from "${old.name}"`, { icon: '🔔', duration: 120000 })
          changed = true
        }
      }
      prevWorkspacesRef.current = new Map(res.data.map((w) => [w.id, { name: w.name, role: w.role }]))
      if (changed) loadWorkspacesRef.current()
    } catch { /* silent — poll failure is not user-facing */ }
  }, [])

  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  // Poll for workspace changes every 2 minutes
  const pollRef = useRef(pollForChanges)
  pollRef.current = pollForChanges
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => pollRef.current(), 120000)
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
        poll: pollForChanges,
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
