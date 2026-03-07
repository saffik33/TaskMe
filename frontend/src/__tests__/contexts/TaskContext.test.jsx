import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { TaskProvider, useTasks } from '../../context/TaskContext'
import { WorkspaceProvider } from '../../context/WorkspaceContext'

// Mock the APIs
vi.mock('../../api/tasks', () => ({
  fetchTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  deleteAllTasks: vi.fn(),
  deleteBulkTasks: vi.fn(),
  createBulkTasks: vi.fn(),
  parseText: vi.fn(),
  smartSearch: vi.fn(),
  fetchColumns: vi.fn(),
  createColumn: vi.fn(),
  updateColumn: vi.fn(),
  reorderColumns: vi.fn(),
  deleteColumn: vi.fn(),
}))

vi.mock('../../api/workspaces', () => ({
  fetchWorkspaces: vi.fn(),
  createWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
}))

import * as tasksApi from '../../api/tasks'
import { fetchWorkspaces } from '../../api/workspaces'

function TestConsumer() {
  const { tasks, loading, addTask, editTask, removeTask } = useTasks()
  if (loading) return <div>Loading...</div>
  return (
    <div>
      <div data-testid="count">{tasks.length}</div>
      {tasks.map(t => <div key={t.id} data-testid={`task-${t.id}`}>{t.task_name}</div>)}
      <button onClick={() => addTask({ task_name: 'New Task' }).catch(() => {})}>Add</button>
      <button onClick={() => editTask(1, { task_name: 'Edited' }).catch(() => {})}>Edit</button>
      <button onClick={() => removeTask(1).catch(() => {})}>Remove</button>
    </div>
  )
}

function renderWithProviders(ui) {
  return render(
    <WorkspaceProvider>{ui}</WorkspaceProvider>
  )
}

describe('TaskContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchWorkspaces.mockResolvedValue({
      data: [{ id: 1, name: 'WS1' }],
    })
  })

  it('loads tasks when workspace is active', async () => {
    tasksApi.fetchTasks.mockResolvedValue({
      data: [
        { id: 1, task_name: 'Task A', custom_fields: null },
        { id: 2, task_name: 'Task B', custom_fields: null },
      ],
    })
    renderWithProviders(<TaskProvider><TestConsumer /></TaskProvider>)
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('2')
    })
  })

  it('addTask calls createTask API', async () => {
    tasksApi.fetchTasks.mockResolvedValue({ data: [] })
    tasksApi.createTask.mockResolvedValue({
      data: { id: 10, task_name: 'New Task', custom_fields: null },
    })
    renderWithProviders(<TaskProvider><TestConsumer /></TaskProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'))

    await act(async () => { screen.getByText('Add').click() })
    expect(tasksApi.createTask).toHaveBeenCalledWith(
      { task_name: 'New Task' },
      { workspace_id: 1 },
    )
  })

  it('editTask updates task in state optimistically', async () => {
    tasksApi.fetchTasks.mockResolvedValue({
      data: [{ id: 1, task_name: 'Original', custom_fields: null }],
    })
    tasksApi.updateTask.mockResolvedValue({
      data: { id: 1, task_name: 'Edited', custom_fields: null },
    })
    renderWithProviders(<TaskProvider><TestConsumer /></TaskProvider>)
    await waitFor(() => expect(screen.getByTestId('task-1').textContent).toBe('Original'))

    await act(async () => { screen.getByText('Edit').click() })
    await waitFor(() => {
      expect(screen.getByTestId('task-1').textContent).toBe('Edited')
    })
  })

  it('removeTask removes from state optimistically', async () => {
    tasksApi.fetchTasks.mockResolvedValue({
      data: [{ id: 1, task_name: 'Gone Soon', custom_fields: null }],
    })
    tasksApi.deleteTask.mockResolvedValue({})
    renderWithProviders(<TaskProvider><TestConsumer /></TaskProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))

    await act(async () => { screen.getByText('Remove').click() })
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('0')
    })
  })
})


// Extended consumer for rollback and bulk tests
function ExtendedConsumer() {
  const { tasks, loading, editTask, removeTask, removeAllTasks, removeBulkTasks, addBulkTasks } = useTasks()
  if (loading) return <div>Loading...</div>
  return (
    <div>
      <div data-testid="count">{tasks.length}</div>
      {tasks.map(t => <div key={t.id} data-testid={`task-${t.id}`}>{t.task_name}</div>)}
      <button onClick={() => editTask(1, { task_name: 'Edited' }).catch(() => {})}>Edit</button>
      <button onClick={() => removeTask(1).catch(() => {})}>RemoveOne</button>
      <button onClick={() => removeAllTasks().catch(() => {})}>RemoveAll</button>
      <button onClick={() => removeBulkTasks([1, 2]).catch(() => {})}>RemoveBulk</button>
      <button onClick={() => addBulkTasks([{ task_name: 'B1' }, { task_name: 'B2' }]).catch(() => {})}>AddBulk</button>
    </div>
  )
}

describe('TaskContext — rollback & bulk operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchWorkspaces.mockResolvedValue({ data: [{ id: 1, name: 'WS1' }] })
  })

  it('editTask API failure rolls back state', async () => {
    tasksApi.fetchTasks.mockResolvedValue({
      data: [{ id: 1, task_name: 'Original', custom_fields: null }],
    })
    tasksApi.updateTask.mockRejectedValue(new Error('Server error'))
    render(<WorkspaceProvider><TaskProvider><ExtendedConsumer /></TaskProvider></WorkspaceProvider>)
    await waitFor(() => expect(screen.getByTestId('task-1').textContent).toBe('Original'))

    await act(async () => { screen.getByText('Edit').click() })
    // Should roll back to Original after API failure
    await waitFor(() => {
      expect(screen.getByTestId('task-1').textContent).toBe('Original')
    })
  })

  it('removeTask API failure rolls back state', async () => {
    tasksApi.fetchTasks.mockResolvedValue({
      data: [{ id: 1, task_name: 'Still Here', custom_fields: null }],
    })
    tasksApi.deleteTask.mockRejectedValue(new Error('Server error'))
    render(<WorkspaceProvider><TaskProvider><ExtendedConsumer /></TaskProvider></WorkspaceProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))

    await act(async () => { screen.getByText('RemoveOne').click() })
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('1')
    })
  })

  it('removeAllTasks clears state', async () => {
    tasksApi.fetchTasks.mockResolvedValue({
      data: [
        { id: 1, task_name: 'T1', custom_fields: null },
        { id: 2, task_name: 'T2', custom_fields: null },
      ],
    })
    tasksApi.deleteAllTasks.mockResolvedValue({})
    render(<WorkspaceProvider><TaskProvider><ExtendedConsumer /></TaskProvider></WorkspaceProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))

    await act(async () => { screen.getByText('RemoveAll').click() })
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('0')
    })
  })

  it('removeAllTasks API failure rolls back', async () => {
    tasksApi.fetchTasks.mockResolvedValue({
      data: [
        { id: 1, task_name: 'T1', custom_fields: null },
        { id: 2, task_name: 'T2', custom_fields: null },
      ],
    })
    tasksApi.deleteAllTasks.mockRejectedValue(new Error('fail'))
    render(<WorkspaceProvider><TaskProvider><ExtendedConsumer /></TaskProvider></WorkspaceProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))

    await act(async () => { screen.getByText('RemoveAll').click() })
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('2')
    })
  })

  it('removeBulkTasks removes specified tasks', async () => {
    tasksApi.fetchTasks.mockResolvedValue({
      data: [
        { id: 1, task_name: 'T1', custom_fields: null },
        { id: 2, task_name: 'T2', custom_fields: null },
        { id: 3, task_name: 'T3', custom_fields: null },
      ],
    })
    tasksApi.deleteBulkTasks.mockResolvedValue({})
    render(<WorkspaceProvider><TaskProvider><ExtendedConsumer /></TaskProvider></WorkspaceProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('3'))

    await act(async () => { screen.getByText('RemoveBulk').click() })
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('1')
    })
  })

  it('removeBulkTasks API failure rolls back', async () => {
    tasksApi.fetchTasks.mockResolvedValue({
      data: [
        { id: 1, task_name: 'T1', custom_fields: null },
        { id: 2, task_name: 'T2', custom_fields: null },
      ],
    })
    tasksApi.deleteBulkTasks.mockRejectedValue(new Error('fail'))
    render(<WorkspaceProvider><TaskProvider><ExtendedConsumer /></TaskProvider></WorkspaceProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))

    await act(async () => { screen.getByText('RemoveBulk').click() })
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('2')
    })
  })

  it('addBulkTasks calls API', async () => {
    tasksApi.fetchTasks.mockResolvedValue({ data: [] })
    tasksApi.createBulkTasks.mockResolvedValue({
      data: [
        { id: 10, task_name: 'B1', custom_fields: null },
        { id: 11, task_name: 'B2', custom_fields: null },
      ],
    })
    render(<WorkspaceProvider><TaskProvider><ExtendedConsumer /></TaskProvider></WorkspaceProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'))

    await act(async () => { screen.getByText('AddBulk').click() })
    expect(tasksApi.createBulkTasks).toHaveBeenCalled()
  })
})
