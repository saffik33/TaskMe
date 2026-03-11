import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Plus, Check, FolderOpen } from 'lucide-react'
import { useWorkspaces } from '../context/WorkspaceContext'
import toast from 'react-hot-toast'

export default function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, currentUserRole, switchWorkspace, addWorkspace } = useWorkspaces()

  const roleBadgeColor = {
    owner: 'bg-purple-100 text-purple-700',
    editor: 'bg-blue-100 text-blue-700',
    viewer: 'bg-gray-100 text-gray-600',
  }
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setCreating(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await addWorkspace({ name: newName.trim() })
      setNewName('')
      setCreating(false)
      setOpen(false)
      toast.success('Workspace created')
    } catch {
      toast.error('Failed to create workspace')
    }
  }

  if (!activeWorkspace) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
      >
        <FolderOpen className="w-4 h-4" />
        <span className="max-w-[150px] truncate">{activeWorkspace.name}</span>
        {currentUserRole && (
          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${roleBadgeColor[currentUserRole] || 'bg-gray-100 text-gray-600'}`}>
            {currentUserRole}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-xl py-1">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => {
                switchWorkspace(ws)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-purple-50 transition-colors ${
                ws.id === activeWorkspace.id ? 'text-purple-700 font-medium bg-purple-50' : 'text-gray-700'
              }`}
            >
              <FolderOpen className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 truncate">{ws.name}</span>
              {ws.role && (
                <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${roleBadgeColor[ws.role] || 'bg-gray-100 text-gray-600'}`}>
                  {ws.role}
                </span>
              )}
              {ws.id === activeWorkspace.id && <Check className="w-4 h-4 text-purple-600" />}
            </button>
          ))}

          <div className="border-t border-gray-100 mt-1 pt-1">
            {creating ? (
              <div className="px-3 py-2 flex items-center gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Workspace name..."
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  className="px-2 py-1 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full text-left px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
