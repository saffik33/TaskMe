import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { WorkspaceProvider, useWorkspaces } from '../../context/WorkspaceContext'

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

import { fetchWorkspaces, fetchMembers, createWorkspace, updateWorkspace, deleteWorkspace } from '../../api/workspaces'

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
})
