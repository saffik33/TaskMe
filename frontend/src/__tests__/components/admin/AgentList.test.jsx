import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockDeleteAgent = vi.fn()
let mockAgents = []

vi.mock('../../../context/AgentAdminContext', () => ({
  useAgentAdmin: () => ({
    agents: mockAgents,
    deleteAgent: mockDeleteAgent,
  }),
}))

// Mock child components to isolate AgentList tests
vi.mock('../../../components/admin/AgentForm', () => ({
  default: ({ agent, onClose }) => (
    <div data-testid="agent-form">
      <span>{agent ? 'edit' : 'create'}</span>
      <button onClick={onClose}>CloseForm</button>
    </div>
  ),
}))

vi.mock('../../../components/admin/AgentVersionHistory', () => ({
  default: ({ onClose }) => (
    <div data-testid="version-history">
      <button onClick={onClose}>CloseHistory</button>
    </div>
  ),
}))

vi.mock('../../../components/ConfirmDialog', () => ({
  default: ({ open, title, message, onConfirm, onCancel }) => open ? (
    <div data-testid="confirm-dialog">
      <span>{message}</span>
      <button onClick={onConfirm}>Confirm</button>
      <button onClick={onCancel}>CancelDialog</button>
    </div>
  ) : null,
}))

import AgentList from '../../../components/admin/AgentList'

describe('AgentList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAgents = [
      { agent_id: 'copilot', name: 'Co-Pilot', model: 'claude-3', client_tools: [{ name: 'tool1' }], version: 2 },
      { agent_id: 'breakdown', name: 'Breakdown', model: 'gpt-4', client_tools: [], version: 1 },
    ]
  })

  it('renders agent table with data', () => {
    render(<AgentList />)
    expect(screen.getByText('Co-Pilot')).toBeInTheDocument()
    expect(screen.getByText('Breakdown')).toBeInTheDocument()
    expect(screen.getByText('copilot')).toBeInTheDocument()
    expect(screen.getByText('claude-3')).toBeInTheDocument()
  })

  it('search filters agents by name', () => {
    render(<AgentList />)
    const search = screen.getByPlaceholderText('Search agents...')
    fireEvent.change(search, { target: { value: 'co-pilot' } })
    expect(screen.getByText('Co-Pilot')).toBeInTheDocument()
    expect(screen.queryByText('Breakdown')).not.toBeInTheDocument()
  })

  it('search filters agents by agent_id', () => {
    render(<AgentList />)
    const search = screen.getByPlaceholderText('Search agents...')
    fireEvent.change(search, { target: { value: 'breakdown' } })
    expect(screen.queryByText('Co-Pilot')).not.toBeInTheDocument()
    expect(screen.getByText('Breakdown')).toBeInTheDocument()
  })

  it('shows Create Agent button', () => {
    render(<AgentList />)
    expect(screen.getByText('Create Agent')).toBeInTheDocument()
  })

  it('clicking Create Agent opens form in create mode', () => {
    render(<AgentList />)
    fireEvent.click(screen.getByText('Create Agent'))
    expect(screen.getByTestId('agent-form')).toBeInTheDocument()
    expect(screen.getByText('create')).toBeInTheDocument()
  })

  it('shows empty state when no agents match', () => {
    mockAgents = []
    render(<AgentList />)
    expect(screen.getByText('No agents found')).toBeInTheDocument()
  })

  it('shows edit and delete buttons for each agent', () => {
    render(<AgentList />)
    const editButtons = screen.getAllByTitle('Edit')
    const deleteButtons = screen.getAllByTitle('Delete')
    expect(editButtons).toHaveLength(2)
    expect(deleteButtons).toHaveLength(2)
  })

  it('clicking delete opens confirm dialog', () => {
    render(<AgentList />)
    const deleteButtons = screen.getAllByTitle('Delete')
    fireEvent.click(deleteButtons[0])
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    expect(screen.getByText(/Delete "Co-Pilot"/)).toBeInTheDocument()
  })

  it('clicking edit opens form in edit mode', () => {
    render(<AgentList />)
    const editButtons = screen.getAllByTitle('Edit')
    fireEvent.click(editButtons[0])
    expect(screen.getByTestId('agent-form')).toBeInTheDocument()
    expect(screen.getByText('edit')).toBeInTheDocument()
  })
})
