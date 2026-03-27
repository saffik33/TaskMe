import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockBindAndOpenPanel = vi.fn()
const mockUnbindAgentFromTask = vi.fn()

let mockAgentAvailable = true
let mockTemplates = [
  { agent_id: 'task-copilot', name: 'Task Co-Pilot' },
  { agent_id: 'task-breakdown', name: 'Smart Breakdown' },
  { agent_id: 'follow-up-agent', name: 'Follow Up' },
  { agent_id: 'test-assistant', name: 'Test Assistant' },
]

vi.mock('../../context/AgentContext', () => ({
  useAgent: () => ({
    agentAvailable: mockAgentAvailable,
    templates: mockTemplates,
    bindAndOpenPanel: mockBindAndOpenPanel,
    unbindAgentFromTask: mockUnbindAgentFromTask,
  }),
}))

vi.mock('../../context/WorkspaceContext', () => ({
  useWorkspaces: () => ({
    activeWorkspace: { id: 1, name: 'Test Workspace' },
  }),
}))

import AgentActionMenu from '../../components/AgentActionMenu'

const defaultProps = {
  task: { id: 1, task_name: 'Test Task', agent_id: null },
  position: { x: 100, y: 100 },
  onClose: vi.fn(),
  onBreakdown: vi.fn(),
}

describe('AgentActionMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAgentAvailable = true
    mockTemplates = [
      { agent_id: 'task-copilot', name: 'Task Co-Pilot' },
      { agent_id: 'task-breakdown', name: 'Smart Breakdown' },
      { agent_id: 'follow-up-agent', name: 'Follow Up' },
      { agent_id: 'test-assistant', name: 'Test Assistant' },
    ]
  })

  it('renders chat agents excluding follow-up and test-assistant', () => {
    render(<AgentActionMenu {...defaultProps} />)
    expect(screen.getByText('Task Co-Pilot')).toBeInTheDocument()
    expect(screen.queryByText('Follow Up')).not.toBeInTheDocument()
    expect(screen.queryByText('Test Assistant')).not.toBeInTheDocument()
    // Breakdown agent excluded from chat list but "Break Down Task" button exists
    expect(screen.getByText('Break Down Task')).toBeInTheDocument()
  })

  it('shows breakdown button', () => {
    render(<AgentActionMenu {...defaultProps} />)
    expect(screen.getByText('Break Down Task')).toBeInTheDocument()
  })

  it('clicking agent calls bindAndOpenPanel', async () => {
    mockBindAndOpenPanel.mockResolvedValue({})
    render(<AgentActionMenu {...defaultProps} />)
    fireEvent.click(screen.getByText('Task Co-Pilot'))
    await waitFor(() => {
      expect(mockBindAndOpenPanel).toHaveBeenCalledWith(1, 'task-copilot', { id: 1, task_name: 'Test Task', agent_id: null })
    })
  })

  it('shows checkmark on bound agent', () => {
    const task = { id: 1, task_name: 'Test Task', agent_id: 'task-copilot' }
    const { container } = render(<AgentActionMenu {...defaultProps} task={task} />)
    // The bound agent button should have the purple highlight class
    const buttons = container.querySelectorAll('button')
    const copilotBtn = Array.from(buttons).find(b => b.textContent.includes('Task Co-Pilot'))
    expect(copilotBtn.className).toContain('bg-purple-50')
  })

  it('shows Remove Agent when agent is bound', () => {
    const task = { id: 1, task_name: 'Test Task', agent_id: 'task-copilot' }
    render(<AgentActionMenu {...defaultProps} task={task} />)
    expect(screen.getByText('Remove Agent')).toBeInTheDocument()
  })

  it('does not show Remove Agent when no agent is bound', () => {
    render(<AgentActionMenu {...defaultProps} />)
    expect(screen.queryByText('Remove Agent')).not.toBeInTheDocument()
  })

  it('closes on outside click', () => {
    render(<AgentActionMenu {...defaultProps} />)
    fireEvent.mouseDown(document.body)
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('shows unavailable message when agent service is down', () => {
    mockAgentAvailable = false
    render(<AgentActionMenu {...defaultProps} />)
    expect(screen.getByText('Agent service unavailable')).toBeInTheDocument()
  })

  it('clicking breakdown calls onBreakdown and onClose', () => {
    render(<AgentActionMenu {...defaultProps} />)
    fireEvent.click(screen.getByText('Break Down Task'))
    expect(defaultProps.onBreakdown).toHaveBeenCalledWith(defaultProps.task)
    expect(defaultProps.onClose).toHaveBeenCalled()
  })
})
