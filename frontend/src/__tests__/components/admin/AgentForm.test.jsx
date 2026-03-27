import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockCreateAgent = vi.fn()
const mockUpdateAgent = vi.fn()

vi.mock('../../../context/AgentAdminContext', () => ({
  useAgentAdmin: () => ({
    createAgent: mockCreateAgent,
    updateAgent: mockUpdateAgent,
    models: [
      { model_id: 'claude-3-opus', name: 'Claude 3 Opus', vendor: 'Anthropic', price_per_1k_tokens: null },
      { model_id: 'gpt-4', name: 'GPT-4', vendor: 'OpenAI', price_per_1k_tokens: 0.03 },
    ],
    mcpServers: [],
    agents: [],
  }),
}))

vi.mock('../../../components/admin/ToolBuilder', () => ({
  default: () => <div data-testid="tool-builder">ToolBuilder</div>,
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

import AgentForm from '../../../components/admin/AgentForm'

describe('AgentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders in create mode when no agent prop', () => {
    render(<AgentForm agent={null} onClose={() => {}} />)
    const matches = screen.getAllByText('Create Agent')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('renders in edit mode with agent data', () => {
    const agent = {
      agent_id: 'copilot',
      name: 'Co-Pilot',
      model: 'claude-3-opus',
      system_prompt: 'You help with tasks',
      temperature: 0.7,
      max_tokens: 2048,
      client_tools: [],
      mcp_server_ids: [],
      sub_agent_ids: [],
    }
    render(<AgentForm agent={agent} onClose={() => {}} />)
    expect(screen.getByText('Edit Agent')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Co-Pilot')).toBeInTheDocument()
    expect(screen.getByDisplayValue('copilot')).toBeInTheDocument()
  })

  it('auto-slugifies name to agent_id in create mode', () => {
    render(<AgentForm agent={null} onClose={() => {}} />)
    const nameInput = screen.getByPlaceholderText('My Agent')
    fireEvent.change(nameInput, { target: { value: 'My Cool Agent' } })
    expect(screen.getByDisplayValue('my-cool-agent')).toBeInTheDocument()
  })

  it('does not auto-slugify in edit mode', () => {
    const agent = {
      agent_id: 'copilot',
      name: 'Co-Pilot',
      model: '',
      system_prompt: '',
      client_tools: [],
      mcp_server_ids: [],
      sub_agent_ids: [],
    }
    render(<AgentForm agent={agent} onClose={() => {}} />)
    const nameInput = screen.getByDisplayValue('Co-Pilot')
    fireEvent.change(nameInput, { target: { value: 'New Name' } })
    // agent_id should remain unchanged
    expect(screen.getByDisplayValue('copilot')).toBeInTheDocument()
  })

  it('renders model dropdown with options', () => {
    render(<AgentForm agent={null} onClose={() => {}} />)
    const modelSelect = screen.getByDisplayValue('Select a model...')
    expect(modelSelect).toBeInTheDocument()
    // Check model options are present
    const options = modelSelect.querySelectorAll('option')
    expect(options.length).toBe(3) // placeholder + 2 models
  })

  it('submit calls createAgent in create mode', async () => {
    mockCreateAgent.mockResolvedValue({ agent_id: 'test', name: 'Test' })
    const onClose = vi.fn()
    render(<AgentForm agent={null} onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText('My Agent'), { target: { value: 'Test' } })
    const submitButtons = screen.getAllByText('Create Agent')
    fireEvent.click(submitButtons[submitButtons.length - 1])

    await waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalled()
    })
  })

  it('cancel button calls onClose', () => {
    const onClose = vi.fn()
    render(<AgentForm agent={null} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows version comment field in edit mode', () => {
    const agent = {
      agent_id: 'copilot',
      name: 'Co-Pilot',
      model: '',
      system_prompt: '',
      client_tools: [],
      mcp_server_ids: [],
      sub_agent_ids: [],
    }
    render(<AgentForm agent={agent} onClose={() => {}} />)
    expect(screen.getByPlaceholderText('Describe what changed...')).toBeInTheDocument()
  })
})
