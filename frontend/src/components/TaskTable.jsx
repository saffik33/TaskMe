import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'
import { Pencil, Trash2, Mail, ArrowUpDown } from 'lucide-react'
import StatusBadge from './StatusBadge'
import PriorityBadge from './PriorityBadge'
import InlineSelect from './InlineSelect'
import InlineEdit from './InlineEdit'
import { formatDate, toInputDate } from '../utils/dateHelpers'
import { TASK_STATUSES, TASK_PRIORITIES } from '../utils/constants'
import { useColumns } from '../context/ColumnContext'

const CORE_SIZES = {
  task_name: { size: 180, minSize: 120, maxSize: 400 },
  description: { size: 200, minSize: 100, maxSize: 500 },
  owner: { size: 130, minSize: 80, maxSize: 250 },
  email: { size: 180, minSize: 100, maxSize: 300 },
  start_date: { size: 120, minSize: 100, maxSize: 160 },
  due_date: { size: 120, minSize: 100, maxSize: 160 },
  status: { size: 120, minSize: 90, maxSize: 180 },
  priority: { size: 120, minSize: 90, maxSize: 180 },
}

export default function TaskTable({ tasks, onEdit, onDelete, onNotify, onFieldChange, rowSelection, onRowSelectionChange }) {
  const [sorting, setSorting] = useState([])
  const { visibleColumns } = useColumns()

  const columns = useMemo(() => {
    // Helper to save a custom field — merges into existing custom_fields JSON
    const saveCustomField = (task, fieldKey, value, displayName) => {
      const existing = { ...(task._customFields || {}) }
      if (value === null || value === undefined || value === '') {
        delete existing[fieldKey]
      } else {
        existing[fieldKey] = value
      }
      onFieldChange(task.id, 'custom_fields', JSON.stringify(existing), displayName)
    }

    // Core column cell renderers keyed by field_key
    const coreCell = {
      task_name: ({ getValue, row }) => (
        <InlineEdit
          value={getValue()}
          onSave={(val) => onFieldChange(row.original.id, 'task_name', val)}
          required
          maxLength={255}
        />
      ),
      description: ({ getValue, row }) => (
        <InlineEdit
          value={getValue()}
          onSave={(val) => onFieldChange(row.original.id, 'description', val)}
          type="textarea"
          formatDisplay={(v) => v && v.length > 50 ? v.slice(0, 50) + '…' : v}
        />
      ),
      owner: ({ getValue, row }) => (
        <InlineEdit
          value={getValue()}
          onSave={(val) => onFieldChange(row.original.id, 'owner', val)}
          maxLength={150}
        />
      ),
      email: ({ getValue, row }) => (
        <InlineEdit
          value={getValue()}
          onSave={(val) => onFieldChange(row.original.id, 'email', val)}
          type="email"
          maxLength={255}
        />
      ),
      start_date: ({ getValue, row }) => (
        <InlineEdit
          value={toInputDate(getValue())}
          onSave={(val) => onFieldChange(row.original.id, 'start_date', val || null)}
          type="date"
          formatDisplay={() => formatDate(getValue())}
        />
      ),
      due_date: ({ getValue, row }) => (
        <InlineEdit
          value={toInputDate(getValue())}
          onSave={(val) => onFieldChange(row.original.id, 'due_date', val || null)}
          type="date"
          formatDisplay={() => formatDate(getValue())}
        />
      ),
      status: ({ getValue, row }) => (
        <InlineSelect
          value={getValue()}
          options={TASK_STATUSES}
          onSelect={(val) => onFieldChange(row.original.id, 'status', val)}
          renderBadge={(v) => <StatusBadge status={v} />}
        />
      ),
      priority: ({ getValue, row }) => (
        <InlineSelect
          value={getValue()}
          options={TASK_PRIORITIES}
          onSelect={(val) => onFieldChange(row.original.id, 'priority', val)}
          renderBadge={(v) => <PriorityBadge priority={v} />}
        />
      ),
    }

    // Selection checkbox column
    const cols = [
      {
        id: 'select',
        size: 40,
        minSize: 40,
        maxSize: 40,
        enableResizing: false,
        enableSorting: false,
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              checked={table.getIsAllRowsSelected()}
              ref={(el) => {
                if (el) el.indeterminate = table.getIsSomeRowsSelected()
              }}
              onChange={table.getToggleAllRowsSelectedHandler()}
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              checked={row.getIsSelected()}
              onChange={row.getToggleSelectedHandler()}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ),
      },
    ]

    // Build columns from visible column config
    visibleColumns.forEach((colConfig) => {
      const { field_key, display_name, is_core, field_type } = colConfig

      // Core column — use specialized renderer
      if (is_core && coreCell[field_key]) {
        cols.push({
          accessorKey: field_key,
          header: display_name,
          ...(CORE_SIZES[field_key] || { size: 150, minSize: 80, maxSize: 300 }),
          cell: coreCell[field_key],
        })
        return
      }

      // Custom column — generic renderer based on field_type
      const sizes = { size: 150, minSize: 80, maxSize: 300 }

      if (field_type === 'select') {
        let opts = []
        try { opts = JSON.parse(colConfig.options || '[]') } catch { /* ignore */ }
        const selectOptions = opts.map((o) => ({ value: o, label: o }))
        cols.push({
          id: field_key,
          header: display_name,
          ...sizes,
          accessorFn: (row) => row._customFields?.[field_key] ?? '',
          cell: ({ getValue, row }) => (
            <InlineSelect
              value={getValue()}
              options={selectOptions}
              onSelect={(val) => saveCustomField(row.original, field_key, val, display_name)}
              renderBadge={(v) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                  {v || '—'}
                </span>
              )}
            />
          ),
        })
        return
      }

      if (field_type === 'date') {
        cols.push({
          id: field_key,
          header: display_name,
          ...sizes,
          accessorFn: (row) => row._customFields?.[field_key] ?? '',
          cell: ({ getValue, row }) => (
            <InlineEdit
              value={toInputDate(getValue())}
              onSave={(val) => saveCustomField(row.original, field_key, val || null, display_name)}
              type="date"
              formatDisplay={() => formatDate(getValue())}
            />
          ),
        })
        return
      }

      if (field_type === 'number') {
        cols.push({
          id: field_key,
          header: display_name,
          ...sizes,
          accessorFn: (row) => row._customFields?.[field_key] ?? '',
          cell: ({ getValue, row }) => (
            <InlineEdit
              value={getValue()?.toString() ?? ''}
              onSave={(val) => saveCustomField(row.original, field_key, val ? Number(val) : null, display_name)}
              type="number"
            />
          ),
        })
        return
      }

      // Default: text
      cols.push({
        id: field_key,
        header: display_name,
        ...sizes,
        accessorFn: (row) => row._customFields?.[field_key] ?? '',
        cell: ({ getValue, row }) => (
          <InlineEdit
            value={getValue()}
            onSave={(val) => saveCustomField(row.original, field_key, val, display_name)}
          />
        ),
      })
    })

    // Always append the actions column
    cols.push({
      id: 'actions',
      header: '',
      size: 100,
      minSize: 80,
      maxSize: 120,
      enableResizing: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(row.original)
            }}
            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(row.original)
            }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {row.original.email && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onNotify(row.original)
              }}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="Send notification"
            >
              <Mail className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    })

    return cols
  }, [visibleColumns, onEdit, onDelete, onNotify, onFieldChange])

  const table = useReactTable({
    data: tasks,
    columns,
    columnResizeMode: 'onChange',
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: onRowSelectionChange,
    enableRowSelection: true,
    getRowId: (row) => String(row.id),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500 text-sm">No tasks yet. Use the input above to create tasks from natural language!</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table style={{ width: table.getCenterTotalSize(), tableLayout: 'fixed' }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-gray-200 bg-gray-50">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize(), maxWidth: header.getSize(), position: 'relative' }}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider overflow-hidden border-r border-gray-200/60 last:border-r-0"
                  >
                    {header.isPlaceholder ? null : header.column.id === 'select' ? (
                      flexRender(header.column.columnDef.header, header.getContext())
                    ) : (
                      <button
                        className="inline-flex items-center gap-1 hover:text-gray-700"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <ArrowUpDown className="w-3 h-3" />
                        )}
                      </button>
                    )}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => header.column.resetSize()}
                        className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none touch-none transition-colors ${
                          header.column.getIsResizing()
                            ? 'bg-indigo-400 opacity-100'
                            : 'opacity-0 hover:opacity-100 hover:bg-indigo-300'
                        }`}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-gray-100 transition-colors ${
                  row.getIsSelected()
                    ? 'bg-indigo-50/60 hover:bg-indigo-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}
                    className="px-4 py-3 text-sm border-r border-gray-100 last:border-r-0"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
