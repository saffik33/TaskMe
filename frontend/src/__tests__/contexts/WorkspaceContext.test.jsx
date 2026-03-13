import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { WorkspaceProvider, useWorkspaces } from '../../context/WorkspaceContext'
import toast from 'react-hot-toast'

vi.mock('react-hot-toast', () => ({ default: vi.fn() }))

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

import { fetchWorkspaces, fetchMembers, createWorkspace, updateWorkspace, deleteWorkspace, removeMember } from '../../api/workspaces'

function TestConsumer() {
  const { workspaces, activeWorkspace, loading, switchWorkspace, addWorkspace, editWorkspace, removeWorkspace } = useWorkspaces()
  if (loading) return <div>Loading...</div>
  return (
    <div>
      <div data-testid="active">{activeWorkspace?.name || 'none'}</div>
      <div data-testid="count">{workspaces.length}</div>
      {workspaces.map(ws => (
        <button key={ws.id} onClick={() => switchWorkspace(ws)}>{ws.name}</button>
      ))}
      <button onClick={() => addWorkspace({ name: 'New WS' })}>Add WS</button>
      <button onClick={() => editWorkspace(1, { name: 'Renamed' })}>Edit WS</button>
      <button onClick={() => removeWorkspace(1)}>Remove WS</button>
    </div>
  )
}

describe('WorkspaceContext', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
    fetchMembers.mockResolvedValue({ data: { members: [], pending_invites: [] } })
  })

  it('loads workspaces and sets first as active', async () => {
    fetchWorkspaces.mockResolvedValue({
      data: [
        { id: 1, name: 'WS1' },
        { id: 2, name: 'WS2' },
      ],
    })
    render(<WorkspaceProvider><TestConsumer /></WorkspaceProvider>)
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('2')
      expect(screen.getByTestId('active').textContent).toBe('WS1')
    })
  })

  it('restores active workspace from sessionStorage', async () => {
    sessionStorage.setItem('activeWorkspaceId', '2')
    fetchWorkspaces.mockResolvedValue({
      data: [
        { id: 1, name: 'WS1' },
        { id: 2, name: 'WS2' },
      ],
    })
    render(<WorkspaceProvider><TestConsumer /></WorkspaceProvider>)
    await waitFor(() => {
      expect(screen.getByTestId('active').textContent).toBe('WS2')
    })
  })

  it('switchWorkspace updates state and sessionStorage', async () => {
    fetchWorkspaces.mockResolvedValue({
      data: [
        { id: 1, name: 'WS1' },
        { id: 2, name: 'WS2' },
      ],
    })
    render(<WorkspaceProvider><TestConsumer /></WorkspaceProvider>)
    await waitFor(() => expect(screen.getByTestId('active').textContent).toBe('WS1'))

    await act(async () => {
      screen.getByText('WS2').click()
    })
    expect(screen.getByTestId('active').textContent).toBe('WS2')
    expect(sessionStorage.getItem('activeWorkspaceId')).toBe('2')
  })

  it('addWorkspace adds to list and switches to it', async () => {
    fetchWorkspaces.mockResolvedValue({ data: [{ id: 1, name: 'WS1' }] })
    createWorkspace.mockResolvedValue({ data: { id: 3, name: 'New WS' } })
    render(<WorkspaceProvider><TestConsumer /></WorkspaceProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))

    await act(async () => { screen.getByText('Add WS').click() })
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('2')
      expect(screen.getByTestId('active').textContent).toBe('New WS')
    })
  })

  it('removeWorkspace removes from list', async () => {
    fetchWorkspaces.mockResolvedValue({
      data: [
        { id: 1, name: 'WS1' },
        { id: 2, name: 'WS2' },
      ],
    })
    deleteWorkspace.mockResolvedValue({})
    render(<WorkspaceProvider><TestConsumer /></WorkspaceProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))

    await act(async () => { screen.getByText('Remove WS').click() })
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('1')
    })
  })

  it('editWorkspace updates in list and activeWorkspace', async () => {
    fetchWorkspaces.mockResolvedValue({ data: [{ id: 1, name: 'WS1' }] })
    updateWorkspace.mockResolvedValue({ data: { id: 1, name: 'Renamed' } })
    render(<WorkspaceProvider><TestConsumer /></WorkspaceProvider>)
    await waitFor(() => expect(screen.getByTestId('active').textContent).toBe('WS1'))

    await act(async () => { screen.getByText('Edit WS').click() })
    await waitFor(() => {
      expect(screen.getByTestId('active').textContent).toBe('Renamed')
    })
  })

  it('removeWorkspace switches active to remaining', async () => {
    fetchWorkspaces.mockResolvedValue({
      data: [
        { id: 1, name: 'WS1' },
        { id: 2, name: 'WS2' },
      ],
    })
    deleteWorkspace.mockResolvedValue({})
    render(<WorkspaceProvider><TestConsumer /></WorkspaceProvider>)
    await waitFor(() => expect(screen.getByTestId('active').textContent).toBe('WS1'))

    // Remove active workspace (id=1) → should switch to WS2
    await act(async () => { screen.getByText('Remove WS').click() })
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('1')
      expect(screen.getByTestId('active').textContent).toBe('WS2')
    })
  })

  it('shows toast notification when a new workspace appears on poll', async () => {
    let pollFn
    function PollConsumer() {
      const ctx = useWorkspaces()
      pollFn = ctx.poll
      if (ctx.loading) return <div>Loading...</div>
      return <div data-testid="count">{ctx.workspaces.length}</div>
    }

    fetchWorkspaces.mockResolvedValue({
      data: [{ id: 1, name: 'WS1', role: 'owner' }],
    })
    render(<WorkspaceProvider><PollConsumer /></WorkspaceProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    expect(toast).not.toHaveBeenCalled()

    // Simulate new workspace appearing via lightweight poll
    fetchWorkspaces.mockResolvedValue({
      data: [
        { id: 1, name: 'WS1', role: 'owner' },
        { id: 2, name: 'Project X', role: 'editor' },
      ],
    })
    await act(async () => { await pollFn() })
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining('Project X'),
      expect.objectContaining({ icon: '🔔' }),
    )
  })

  it('shows toast notification when role changes on poll', async () => {
    let pollFn
    function PollConsumer() {
      const ctx = useWorkspaces()
      pollFn = ctx.poll
      if (ctx.loading) return <div>Loading...</div>
      return <div data-testid="count">{ctx.workspaces.length}</div>
    }

    fetchWorkspaces.mockResolvedValue({
      data: [{ id: 1, name: 'WS1', role: 'editor' }],
    })
    render(<WorkspaceProvider><PollConsumer /></WorkspaceProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    toast.mockClear()

    // Role changes from editor to viewer
    fetchWorkspaces.mockResolvedValue({
      data: [{ id: 1, name: 'WS1', role: 'viewer' }],
    })
    await act(async () => { await pollFn() })
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining('changed to viewer'),
      expect.objectContaining({ icon: '🔔' }),
    )
  })

  it('shows toast notification when removed from workspace on poll', async () => {
    let pollFn
    function PollConsumer() {
      const ctx = useWorkspaces()
      pollFn = ctx.poll
      if (ctx.loading) return <div>Loading...</div>
      return <div data-testid="count">{ctx.workspaces.length}</div>
    }

    fetchWorkspaces.mockResolvedValue({
      data: [
        { id: 1, name: 'WS1', role: 'owner' },
        { id: 2, name: 'Project X', role: 'editor' },
      ],
    })
    render(<WorkspaceProvider><PollConsumer /></WorkspaceProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))
    toast.mockClear()

    // Project X disappears — user was removed
    fetchWorkspaces.mockResolvedValue({
      data: [{ id: 1, name: 'WS1', role: 'owner' }],
    })
    await act(async () => { await pollFn() })
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining('removed from "Project X"'),
      expect.objectContaining({ icon: '🔔', duration: 120000 }),
    )
  })

  it('self-leave reloads workspaces instead of members', async () => {
    let leaveFn
    function LeaveConsumer() {
      const ctx = useWorkspaces()
      leaveFn = ctx.removeMember
      if (ctx.loading) return <div>Loading...</div>
      return <div data-testid="count">{ctx.workspaces.length}</div>
    }

    fetchWorkspaces.mockResolvedValue({
      data: [
        { id: 1, name: 'WS1', role: 'owner' },
        { id: 2, name: 'WS2', role: 'editor' },
      ],
    })
    fetchMembers.mockResolvedValue({ data: { members: [], pending_invites: [] } })
    removeMember.mockResolvedValue({ data: { ok: true } })
    render(<WorkspaceProvider><LeaveConsumer /></WorkspaceProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))

    // After leave, fetchWorkspaces returns only WS1
    fetchWorkspaces.mockResolvedValue({
      data: [{ id: 1, name: 'WS1', role: 'owner' }],
    })
    await act(async () => { await leaveFn(1) }) // userId=1 matches mock user
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('1')
    })
  })
})
