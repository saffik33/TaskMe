import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockSendMessage = vi.fn()
const mockClosePanel = vi.fn()

let mockMessages = []
let mockStreaming = false
let mockWsStatus = 'connected'
let mockActivePanel = {
  taskId: 1,
  task: {
    id: 1,
    task_name: 'Test Task',
    agent_id: 'task-copilot',
    agent_status: 'idle',
  },
}

vi.mock('../../context/AgentContext', () => ({
  useAgent: () => ({
    activePanel: mockActivePanel,
    messages: mockMessages,
    streaming: mockStreaming,
    wsStatus: mockWsStatus,
    wsError: null,
    closePanel: mockClosePanel,
    sendMessage: mockSendMessage,
  }),
}))

import AgentPanel from '../../components/AgentPanel'

describe('AgentPanel', () => {
  beforeEach(() => {
    mockMessages = []
    mockStreaming = false
    mockWsStatus = 'connected'
    mockActivePanel = {
      taskId: 1,
      task: { id: 1, task_name: 'Test Task', agent_id: 'task-copilot', agent_status: 'idle' },
    }
    vi.clearAllMocks()
  })

  it('renders task name and agent info', () => {
    render(<AgentPanel />)
    expect(screen.getByText('Test Task')).toBeInTheDocument()
    expect(screen.getByText('task-copilot')).toBeInTheDocument()
    expect(screen.getByText('idle')).toBeInTheDocument()
  })

  it('renders empty state when no messages', () => {
    render(<AgentPanel />)
    expect(screen.getByText('Start a conversation with the agent')).toBeInTheDocument()
  })

  it('calls closePanel when clicking close button', () => {
    render(<AgentPanel />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(mockClosePanel).toHaveBeenCalled()
  })

  it('sends message on button click', () => {
    render(<AgentPanel />)
    const input = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(input, { target: { value: 'Hello agent' } })
    const allButtons = screen.getAllByRole('button')
    fireEvent.click(allButtons[allButtons.length - 1])
    expect(mockSendMessage).toHaveBeenCalledWith('Hello agent')
  })

  it('sends message on Enter key', () => {
    render(<AgentPanel />)
    const input = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(input, { target: { value: 'Enter test' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })
    expect(mockSendMessage).toHaveBeenCalledWith('Enter test')
  })

  it('does not send on Shift+Enter', () => {
    render(<AgentPanel />)
    const input = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(input, { target: { value: 'No send' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('renders null when activePanel is null', () => {
    mockActivePanel = null
    const { container } = render(<AgentPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('renders user message bubble', () => {
    mockMessages = [{ type: 'user_message', content: 'My question' }]
    render(<AgentPanel />)
    expect(screen.getByText('My question')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('renders assistant message bubble', () => {
    mockMessages = [{ type: 'assistant_message', content: 'Agent reply', is_final: true }]
    render(<AgentPanel />)
    expect(screen.getByText('Agent reply')).toBeInTheDocument()
    expect(screen.getByText('Agent')).toBeInTheDocument()
  })

  it('renders thinking message bubble', () => {
    mockMessages = [{ type: 'assistant_thinking', content: 'Let me think...' }]
    render(<AgentPanel />)
    expect(screen.getByText('Let me think...')).toBeInTheDocument()
    expect(screen.getByText('Thinking')).toBeInTheDocument()
  })

  it('renders tool result bubble', () => {
    mockMessages = [{ type: 'tool_result', tool_name: 'update_task', success: true, content: 'Updated status' }]
    render(<AgentPanel />)
    expect(screen.getByText('Updated status')).toBeInTheDocument()
    expect(screen.getByText(/update_task/)).toBeInTheDocument()
  })

  it('renders error message', () => {
    mockMessages = [{ type: 'error', message: 'Something went wrong' }]
    render(<AgentPanel />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('renders tool execution request', () => {
    mockMessages = [{ type: 'tool_execution_request', tool_name: 'create_subtask', parameters: { task_name: 'Sub 1' } }]
    render(<AgentPanel />)
    expect(screen.getByText(/create_subtask/)).toBeInTheDocument()
  })
})
