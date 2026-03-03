import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as api from '../api/tasks'
import { useWorkspaces } from './WorkspaceContext'

const ColumnContext = createContext()

export function ColumnProvider({ children }) {
  const { activeWorkspace } = useWorkspaces()
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(true)

  const loadColumns = useCallback(async () => {
    if (!activeWorkspace) return
    try {
      const res = await api.fetchColumns({ workspace_id: activeWorkspace.id })
      setColumns(res.data)
    } catch (err) {
      console.error('Failed to load columns:', err)
    } finally {
      setLoading(false)
    }
  }, [activeWorkspace])

  useEffect(() => {
    loadColumns()
  }, [loadColumns])

  const visibleColumns = useMemo(
    () => columns.filter((c) => c.is_visible).sort((a, b) => a.position - b.position),
    [columns],
  )

  const customVisibleColumns = useMemo(
    () => visibleColumns.filter((c) => !c.is_core),
    [visibleColumns],
  )

  const addColumn = async (data) => {
    const params = activeWorkspace ? { workspace_id: activeWorkspace.id } : {}
    const res = await api.createColumn(data, params)
    await loadColumns()
    return res.data
  }

  const editColumn = async (id, data) => {
    const res = await api.updateColumn(id, data)
    await loadColumns()
    return res.data
  }

  const reorder = async (positions) => {
    await api.reorderColumns(positions)
    await loadColumns()
  }

  const removeColumn = async (id) => {
    await api.deleteColumn(id)
    await loadColumns()
  }

  return (
    <ColumnContext.Provider
      value={{
        columns,
        visibleColumns,
        customVisibleColumns,
        loading,
        loadColumns,
        addColumn,
        editColumn,
        reorder,
        removeColumn,
      }}
    >
      {children}
    </ColumnContext.Provider>
  )
}

export function useColumns() {
  const ctx = useContext(ColumnContext)
  if (!ctx) throw new Error('useColumns must be used within ColumnProvider')
  return ctx
}
