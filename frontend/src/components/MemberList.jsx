import { useState } from 'react'
import { X, Users, UserPlus, Trash2, Clock, Crown, Pencil, Eye, LogOut } from 'lucide-react'
import { useWorkspaces } from '../context/WorkspaceContext'
import { useAuth } from '../context/AuthContext'
import { cancelInvite as cancelInviteApi } from '../api/workspaces'
import toast from 'react-hot-toast'

const ROLE_BADGE = {
  owner: { bg: 'bg-purple-100 text-purple-700', icon: Crown },
  editor: { bg: 'bg-blue-100 text-blue-700', icon: Pencil },
  viewer: { bg: 'bg-gray-100 text-gray-600', icon: Eye },
}

export default function MemberList({ open, onClose }) {
  const { members, currentUserRole, activeWorkspace, inviteMember, removeMember, changeMemberRole, loadMembers } = useWorkspaces()
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')
  const [inviting, setInviting] = useState(false)

  if (!open) return null

  const isOwner = currentUserRole === 'owner'
  const memberList = members?.members || []
  const pendingList = members?.pending_invites || []

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setInviting(true)
    try {
      await inviteMember(email.trim(), role)
      toast.success('Invitation sent')
      setEmail('')
    } catch (err) {
      const detail = err.response?.data?.detail
      toast.error(detail || 'Failed to send invitation')
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (userId, username) => {
    if (!confirm(`Remove ${username} from this workspace?`)) return
    try {
      await removeMember(userId)
      toast.success(`${username} removed`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove member')
    }
  }

  const handleLeave = async () => {
    if (!confirm('Leave this workspace? You will lose access to all tasks.')) return
    try {
      await removeMember(user.id)
      toast.success('Left workspace')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to leave workspace')
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    try {
      await changeMemberRole(userId, newRole)
      toast.success('Role updated')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change role')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-purple-700">Workspace Members</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Member list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {memberList.map((m) => {
            const badge = ROLE_BADGE[m.role] || ROLE_BADGE.viewer
            const BadgeIcon = badge.icon
            const isSelf = m.user_id === user?.id
            return (
              <div key={m.user_id} className="flex items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-sm font-medium shrink-0">
                  {m.username?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-900 truncate">{m.username}</span>
                    {isSelf && <span className="text-xs text-gray-400">(you)</span>}
                  </div>
                  <span className="text-xs text-gray-500 truncate block">{m.email}</span>
                </div>
                {isOwner && !isSelf ? (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    >
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      onClick={() => handleRemove(m.user_id, m.username)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Remove member"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${badge.bg}`}>
                    <BadgeIcon className="w-3 h-3" />
                    {m.role}
                  </span>
                )}
              </div>
            )
          })}

          {/* Pending invites */}
          {pendingList.length > 0 && (
            <>
              <div className="pt-2 pb-1">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Pending Invites</span>
              </div>
              {pendingList.map((inv, i) => (
                <div key={i} className="flex items-center gap-3 py-2 opacity-60 hover:opacity-100 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-600 truncate block">{inv.email}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-50 text-yellow-700">
                    {inv.role}
                  </span>
                  {isOwner && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={async () => {
                          try {
                            await inviteMember(inv.email, inv.role)
                            toast.success(`Invitation resent to ${inv.email}`)
                          } catch {
                            toast.error('Failed to resend invitation')
                          }
                        }}
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium px-1.5 py-0.5 rounded hover:bg-purple-50"
                        title="Resend invitation"
                      >
                        Resend
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await cancelInviteApi(activeWorkspace.id, inv.id)
                            loadMembers()
                            toast.success('Invitation cancelled')
                          } catch {
                            toast.error('Failed to cancel invitation')
                          }
                        }}
                        className="text-gray-400 hover:text-red-500 p-0.5 rounded hover:bg-red-50"
                        title="Cancel invitation"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer: invite form (owner) or leave button (non-owner) */}
        <div className="px-6 py-4 border-t border-gray-100">
          {isOwner ? (
            <form onSubmit={handleInvite} className="space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm font-medium text-purple-700">Invite Member</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting || !email.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {inviting ? '...' : 'Invite'}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={handleLeave}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Leave Workspace
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
