import { useState, useEffect } from 'react'
import { Search, Eye, MessageSquare } from 'lucide-react'
import * as api from '../../api/agentAdmin'
import SessionMessages from './SessionMessages'

export default function SessionList() {
  const [sessions, setSessions] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [viewSession, setViewSession] = useState(null)

  const fetchSessions = async (searchQuery, cursorVal = null) => {
    setLoading(true)
    try {
      if (searchQuery.trim()) {
        const { data } = await api.searchSessions(searchQuery)
        setSessions(data)
        setHasMore(false)
        setCursor(null)
      } else {
        const params = { limit: 20 }
        if (cursorVal) params.cursor = cursorVal
        const { data } = await api.listSessions(params)
        const items = data.items || data
        const nextCursor = data.next_cursor || null

        if (cursorVal) {
          setSessions((prev) => [...prev, ...items])
        } else {
          setSessions(items)
        }
        setCursor(nextCursor)
        setHasMore(!!nextCursor)
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions('')
  }, [])

  const handleSearch = () => {
    setCursor(null)
    fetchSessions(search)
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  const loadMore = () => {
    if (cursor) fetchSessions(search, cursor)
  }

  const truncateId = (id) => {
    if (!id) return '--'
    return id.length > 12 ? id.slice(0, 12) + '...' : id
  }

  const statusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700'
      case 'completed':
        return 'bg-gray-100 text-gray-600'
      case 'failed':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-gray-100 text-gray-500'
    }
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search sessions..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <button
          onClick={handleSearch}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-sm text-sm font-medium"
        >
          <Search className="w-4 h-4" /> Search
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Session ID</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Agent ID</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Turns</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sessions.map((session) => (
              <tr key={session.session_id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500" title={session.session_id}>
                  {truncateId(session.session_id)}
                </td>
                <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                  {session.agent_id || '--'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(session.status)}`}
                  >
                    {session.status || 'unknown'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                    {session.turn_count ?? session.turns ?? '--'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setViewSession(session.session_id)}
                    className="p-1.5 text-gray-400 hover:text-purple-600 rounded"
                    title="View Messages"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No sessions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Loading / Load More */}
      {loading && (
        <div className="text-center py-4 text-gray-400 text-sm">Loading...</div>
      )}
      {hasMore && !loading && (
        <div className="text-center">
          <button
            onClick={loadMore}
            className="px-4 py-2 text-sm font-medium text-purple-600 bg-white border border-purple-300 rounded-lg hover:bg-purple-50"
          >
            Load More
          </button>
        </div>
      )}

      {/* Message viewer */}
      {viewSession && (
        <SessionMessages
          sessionId={viewSession}
          onClose={() => setViewSession(null)}
        />
      )}
    </div>
  )
}
