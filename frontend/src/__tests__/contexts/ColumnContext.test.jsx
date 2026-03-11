import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { ColumnProvider, useColumns } from '../../context/ColumnContext'
import { WorkspaceProvider } from '../../context/WorkspaceContext'

vi.mock('../../api/tasks', () => ({
  fetchColumns: vi.fn(),
  createColumn: vi.fn(),
  updateColumn: vi.fn(),
  reorderColumns: vi.fn(),
  deleteColumn: vi.fn(),
  fetchTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  deleteAllTasks: vi.fn(),
  deleteBulkTasks: vi.fn(),
  createBulkTasks: vi.fn(),
  parseText: vi.fn(),
}))

vi.mock('../../api/workspaces', () => ({
  fetchWorkspaces: vi.fn(),
  fetchMembers: vi.fn(),
  createWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
  inviteMember: vi.fn(),
  removeMember: vi.fn(),
  changeRole: vi.fn(),
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: 'testuser', email: 'test@test.com' } }),
}))

import * as tasksApi from '../../api/tasks'
import { fetchWorkspaces, fetchMembers } from '../../api/workspaces'

const MOCK_COLUMNS = [
  { id: 1, field_key: 'task_name', display_name: 'Task Name', is_visible: true, is_core: true, position: 0 },
  { id: 2, field_key: 'status', display_name: 'Status', is_visible: true, is_core: true, position: 1 },
  { id: 3, field_key: 'cf_sprint', display_name: 'Sprint', is_visible: true, is_core: false, position: 2 },
  { id: 4, field_key: 'cf_hidden', display_name: 'Hidden', is_visible: false, is_core: false, position: 3 },
]

function TestConsumer() {
  const { columns, visibleColumns, customVisibleColumns, loading, addColumn, removeColumn, editColumn, reorder } = useColumns()
  if (loading) return <div>Loading...</div>
  return (
    <div>
      <div data-testid="total">{columns.length}</div>
      <div data-testid="visible">{visibleColumns.length}</div>
      <div data-testid="custom-visible">{customVisibleColumns.length}</div>
      <button onClick={() => addColumn({ display_name: 'New', field_type: 'text' })}>Add</button>
      <button onClick={() => removeColumn(3)}>Remove</button>
      <button onClick={() => editColumn(1, { display_name: 'Renamed' })}>EditCol</button>
      <button onClick={() => reorder([{ id: 1, position: 2 }])}>Reorder</button>
    </div>
  )
}

describe('ColumnContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchWorkspaces.mockResolvedValue({ data: [{ id: 1, name: 'WS1', role: 'owner' }] })
    fetchMembers.mockResolvedValue({ data: { members: [], pending_invites: [] } })
  })

  it('loads columns on mount', async () => {
    tasksApi.fetchColumns.mockResolvedValue({ data: MOCK_COLUMNS })
    render(
      <WorkspaceProvider>
        <ColumnProvider><TestConsumer /></ColumnProvider>
      </WorkspaceProvider>
    )
    await waitFor(() => {
      expect(screen.getByTestId('total').textContent).toBe('4')
    })
  })

  it('computes visibleColumns correctly', async () => {
    tasksApi.fetchColumns.mockResolvedValue({ data: MOCK_COLUMNS })
    render(
      <WorkspaceProvider>
        <ColumnProvider><TestConsumer /></ColumnProvider>
      </WorkspaceProvider>
    )
    await waitFor(() => {
      // 3 visible (task_name, status, cf_sprint), 1 hidden
      expect(screen.getByTestId('visible').textContent).toBe('3')
    })
  })

  it('computes customVisibleColumns correctly', async () => {
    tasksApi.fetchColumns.mockResolvedValue({ data: MOCK_COLUMNS })
    render(
      <WorkspaceProvider>
        <ColumnProvider><TestConsumer /></ColumnProvider>
      </WorkspaceProvider>
    )
    await waitFor(() => {
      // Only cf_sprint is custom + visible
      expect(screen.getByTestId('custom-visible').textContent).toBe('1')
    })
  })

  it('addColumn reloads columns', async () => {
    tasksApi.fetchColumns.mockResolvedValue({ data: MOCK_COLUMNS })
    tasksApi.createColumn.mockResolvedValue({ data: { id: 5, display_name: 'New' } })
    render(
      <WorkspaceProvider>
        <ColumnProvider><TestConsumer /></ColumnProvider>
      </WorkspaceProvider>
    )
    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('4'))

    // After add, fetchColumns is called again (reload)
    tasksApi.fetchColumns.mockResolvedValue({
      data: [...MOCK_COLUMNS, { id: 5, field_key: 'cf_new', display_name: 'New', is_visible: true, is_core: false, position: 4 }],
    })
    await act(async () => { screen.getByText('Add').click() })
    await waitFor(() => {
      expect(screen.getByTestId('total').textContent).toBe('5')
    })
  })

  it('editColumn calls API and reloads', async () => {
    tasksApi.fetchColumns.mockResolvedValue({ data: MOCK_COLUMNS })
    tasksApi.updateColumn.mockResolvedValue({ data: { id: 1, display_name: 'Renamed' } })
    render(
      <WorkspaceProvider>
        <ColumnProvider><TestConsumer /></ColumnProvider>
      </WorkspaceProvider>
    )
    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('4'))

    await act(async () => { screen.getByText('EditCol').click() })
    expect(tasksApi.updateColumn).toHaveBeenCalledWith(1, { display_name: 'Renamed' })
  })

  it('removeColumn calls API and reloads', async () => {
    tasksApi.fetchColumns.mockResolvedValue({ data: MOCK_COLUMNS })
    tasksApi.deleteColumn.mockResolvedValue({})
    render(
      <WorkspaceProvider>
        <ColumnProvider><TestConsumer /></ColumnProvider>
      </WorkspaceProvider>
    )
    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('4'))

    tasksApi.fetchColumns.mockResolvedValue({ data: MOCK_COLUMNS.slice(0, 3) })
    await act(async () => { screen.getByText('Remove').click() })
    expect(tasksApi.deleteColumn).toHaveBeenCalledWith(3)
  })

  it('reorder calls API and reloads', async () => {
    tasksApi.fetchColumns.mockResolvedValue({ data: MOCK_COLUMNS })
    tasksApi.reorderColumns.mockResolvedValue({ data: MOCK_COLUMNS })
    render(
      <WorkspaceProvider>
        <ColumnProvider><TestConsumer /></ColumnProvider>
      </WorkspaceProvider>
    )
    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('4'))

    await act(async () => { screen.getByText('Reorder').click() })
    expect(tasksApi.reorderColumns).toHaveBeenCalled()
  })
})
