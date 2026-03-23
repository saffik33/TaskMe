import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../../api/agents', () => ({
  breakdownTask: vi.fn(),
}))
vi.mock('../../context/WorkspaceContext', () => ({
  useWorkspaces: () => ({ activeWorkspace: { id: 1 } }),
}))
vi.mock('../../context/TaskContext', () => ({
  useTasks: () => ({ loadTasks: vi.fn() }),
}))
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

import { breakdownTask } from '../../api/agents'
import TaskBreakdown from '../../components/TaskBreakdown'

const mockTask = {
  id: 1,
  task_name: 'Launch campaign',
  description: 'Full marketing campaign launch',
  status: 'To Do',
  priority: 'High',
}

describe('TaskBreakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders null when not open', () => {
    const { container } = render(<TaskBreakdown task={mockTask} open={false} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders task info when open', () => {
    render(<TaskBreakdown task={mockTask} open={true} onClose={() => {}} />)
    expect(screen.getByText('Launch campaign')).toBeInTheDocument()
    expect(screen.getByText('Full marketing campaign launch')).toBeInTheDocument()
    expect(screen.getByText('Break Down with AI')).toBeInTheDocument()
  })

  it('shows loading state during breakdown', async () => {
    breakdownTask.mockReturnValue(new Promise(() => {})) // never resolves
    render(<TaskBreakdown task={mockTask} open={true} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Break Down with AI'))
    expect(screen.getByText(/Analyzing task/)).toBeInTheDocument()
  })

  it('shows subtasks after successful breakdown', async () => {
    breakdownTask.mockResolvedValue({
      data: {
        task_id: 1,
        subtasks_created: 3,
        subtasks: [
          { task_name: 'Design assets', priority: 'High' },
          { task_name: 'Write copy', priority: 'Medium' },
          { task_name: 'Schedule posts', priority: 'Low' },
        ],
      },
    })
    render(<TaskBreakdown task={mockTask} open={true} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Break Down with AI'))

    await waitFor(() => {
      expect(screen.getByText('Created 3 subtasks')).toBeInTheDocument()
    })
    expect(screen.getByText('Design assets')).toBeInTheDocument()
    expect(screen.getByText('Write copy')).toBeInTheDocument()
    expect(screen.getByText('Schedule posts')).toBeInTheDocument()
  })

  it('shows error on failure', async () => {
    breakdownTask.mockRejectedValue({
      response: { data: { detail: 'Agent service unavailable' } },
    })
    render(<TaskBreakdown task={mockTask} open={true} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Break Down with AI'))

    await waitFor(() => {
      expect(screen.getByText('Breakdown failed')).toBeInTheDocument()
    })
    expect(screen.getByText('Agent service unavailable')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('calls onClose when clicking Cancel', () => {
    const onClose = vi.fn()
    render(<TaskBreakdown task={mockTask} open={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })
})
