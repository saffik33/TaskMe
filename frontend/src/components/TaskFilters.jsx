import { Search, LayoutGrid, Table2 } from 'lucide-react'
import { useDebounce } from '../hooks/useDebounce'
import { useTasks } from '../context/TaskContext'
import { TASK_STATUSES, TASK_PRIORITIES } from '../utils/constants'
import { useState, useEffect } from 'react'
import CustomSelect from './CustomSelect'

export default function TaskFilters({ view, onViewChange }) {
  const { filters, setFilters, tasks } = useTasks()
  const [search, setSearch] = useState(filters.search)
  const debouncedSearch = useDebounce(search, 300)

  useEffect(() => {
    setFilters((f) => ({ ...f, search: debouncedSearch }))
  }, [debouncedSearch, setFilters])

  const owners = [...new Set(tasks.map((t) => t.owner).filter(Boolean))]

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-[200px]">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks..."
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
        />
      </div>

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
