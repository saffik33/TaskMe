import { Search, LayoutGrid, Table2, Sparkles, Loader2, X } from 'lucide-react'
import { useDebounce } from '../hooks/useDebounce'
import { useTasks } from '../context/TaskContext'
import { TASK_STATUSES, TASK_PRIORITIES } from '../utils/constants'
import { useState, useEffect } from 'react'
import CustomSelect from './CustomSelect'
import toast from 'react-hot-toast'

export default function TaskFilters({ view, onViewChange }) {
  const { filters, setFilters, tasks, smartSearchFilters } = useTasks()
  const [search, setSearch] = useState(filters.search)
  const [smartMode, setSmartMode] = useState(false)
  const [smartLoading, setSmartLoading] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    if (!smartMode) {
      setFilters((f) => ({ ...f, search: debouncedSearch }))
    }
  }, [debouncedSearch, setFilters, smartMode])

  const handleSmartSearch = async () => {
    if (!search.trim() || smartLoading) return
    setSmartLoading(true)
    try {
      const parsed = await smartSearchFilters(search)
      const parts = []
      if (parsed.status) parts.push(`Status: ${parsed.status.join(', ')}`)
      if (parsed.priority) parts.push(`Priority: ${parsed.priority.join(', ')}`)
      if (parsed.owner) parts.push(`Owner: ${parsed.owner}`)
      if (parsed.search) parts.push(`Search: "${parsed.search}"`)
      if (parsed.date_from || parsed.date_to) parts.push(`Date range applied`)
      if (parsed.sort_by) parts.push(`Sorted by ${parsed.sort_by}`)
      toast.success(parts.length ? `Filters: ${parts.join(' | ')}` : 'No specific filters extracted')
    } catch (err) {
      console.error('Smart search failed:', err)
      const detail = err.response?.data?.detail
      toast.error(detail || 'Failed to parse search query')
    } finally {
      setSmartLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && smartMode) {
      e.preventDefault()
      handleSmartSearch()
    }
  }

  const clearAllFilters = () => {
    setSearch('')
    setFilters({
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
  }

  const hasActiveSmartFilters = filters.statuses || filters.priorities || filters.date_from || filters.date_to

  const owners = [...new Set(tasks.map((t) => t.owner).filter(Boolean))]

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="relative w-full sm:w-[280px]">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={smartMode ? 'Describe what you\'re looking for...' : 'Search tasks...'}
          className={`w-full pl-9 pr-20 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white ${smartMode ? 'border-purple-300 ring-1 ring-purple-200' : 'border-gray-200'}`}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {smartLoading && <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />}
          {hasActiveSmartFilters && (
            <button
              onClick={clearAllFilters}
              className="p-1 rounded hover:bg-gray-100"
              title="Clear all filters"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
          <button
            onClick={() => setSmartMode((m) => !m)}
            className={`p-1 rounded transition-colors ${smartMode ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:text-purple-500 hover:bg-purple-50'}`}
            title={smartMode ? 'Smart search ON — press Enter to search' : 'Enable AI smart search'}
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </div>

      {hasActiveSmartFilters && (
        <div className="flex items-center gap-1">
          {filters.statuses && (
            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
              {filters.statuses.split(',').length} statuses
            </span>
          )}
          {filters.priorities && (
            <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700">
              {filters.priorities.split(',').length} priorities
            </span>
          )}
          {(filters.date_from || filters.date_to) && (
            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
              date range
            </span>
          )}
        </div>
      )}

      {!hasActiveSmartFilters && (
        <>
          <CustomSelect
            value={filters.status}
            onChange={(val) => setFilters((f) => ({ ...f, status: val }))}
            options={TASK_STATUSES.map((s) => ({ value: s.value, label: s.label, color: s.color }))}
            placeholder="All Statuses"
          />

          <CustomSelect
            value={filters.priority}
            onChange={(val) => setFilters((f) => ({ ...f, priority: val }))}
            options={TASK_PRIORITIES.map((p) => ({ value: p.value, label: p.label, color: p.color }))}
            placeholder="All Priorities"
          />

          {owners.length > 0 && (
            <CustomSelect
              value={filters.owner}
              onChange={(val) => setFilters((f) => ({ ...f, owner: val }))}
              options={owners.map((o) => ({ value: o, label: o }))}
              placeholder="All Owners"
            />
          )}
        </>
      )}

      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => onViewChange('table')}
          className={`p-2 ${view === 'table' ? 'bg-purple-50 text-purple-600' : 'bg-white text-gray-500 hover:bg-purple-50'}`}
          title="Table view"
        >
          <Table2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onViewChange('board')}
          className={`p-2 ${view === 'board' ? 'bg-purple-50 text-purple-600' : 'bg-white text-gray-500 hover:bg-purple-50'}`}
          title="Board view"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
