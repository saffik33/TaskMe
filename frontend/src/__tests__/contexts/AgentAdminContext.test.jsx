import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AgentAdminProvider, useAgentAdmin } from '../../context/AgentAdminContext'

vi.mock('../../api/agentAdmin', () => ({
  listAgents: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
  listMcpServers: vi.fn(),
  createMcpServer: vi.fn(),
  updateMcpServer: vi.fn(),
  deleteMcpServer: vi.fn(),
  listModels: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

import * as api from '../../api/agentAdmin'

function TestConsumer() {
  const { agents, mcpServers, models, loading, createAgent, updateAgent, deleteAgent, createMcpServer, deleteMcpServer } = useAgentAdmin()

  return (
    <div>
      <div data-testid="loading">{loading ? 'yes' : 'no'}</div>
      <div data-testid="agent-count">{agents.length}</div>
      <div data-testid="mcp-count">{mcpServers.length}</div>
      <div data-testid="model-count">{models.length}</div>
      <div data-testid="agent-names">{agents.map(a => a.name).join(',')}</div>
      <div data-testid="mcp-names">{mcpServers.map(s => s.name).join(',')}</div>
      <button data-testid="create-agent" onClick={() => createAgent({ name: 'New Agent', agent_id: 'new-agent' })}>CreateAgent</button>
      <button data-testid="update-agent" onClick={() => updateAgent('copilot', { name: 'Updated' })}>UpdateAgent</button>
      <button data-testid="delete-agent" onClick={() => deleteAgent('copilot')}>DeleteAgent</button>
      <button data-testid="create-mcp" onClick={() => createMcpServer({ name: 'New MCP' })}>CreateMcp</button>
      <button data-testid="delete-mcp" onClick={() => deleteMcpServer('mcp-1')}>DeleteMcp</button>
    </div>
  )
}

function renderWithProvider() {
  return render(
    <AgentAdminProvider>
      <TestConsumer />
    </AgentAdminProvider>,
  )
}

describe('AgentAdminContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listAgents.mockResolvedValue({ data: [{ agent_id: 'copilot', name: 'Co-Pilot' }] })
    api.listMcpServers.mockResolvedValue({ data: [{ mcp_server_id: 'mcp-1', name: 'GitHub' }] })
    api.listModels.mockResolvedValue({ data: [{ model_id: 'claude-3', name: 'Claude 3', vendor: 'Anthropic' }] })
  })

  it('loads agents, mcpServers, and models on mount', async () => {
    renderWithProvider()
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('no')
    })
    expect(screen.getByTestId('agent-count')).toHaveTextContent('1')
    expect(screen.getByTestId('mcp-count')).toHaveTextContent('1')
    expect(screen.getByTestId('model-count')).toHaveTextContent('1')
  })

  it('createAgent adds to state', async () => {
    api.createAgent.mockResolvedValue({ data: { agent_id: 'new-agent', name: 'New Agent' } })
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'))

    await act(async () => {
      screen.getByTestId('create-agent').click()
    })
    expect(api.createAgent).toHaveBeenCalledWith({ name: 'New Agent', agent_id: 'new-agent' })
    expect(screen.getByTestId('agent-count')).toHaveTextContent('2')
  })

  it('updateAgent replaces in state', async () => {
    api.updateAgent.mockResolvedValue({ data: { agent_id: 'copilot', name: 'Updated' } })
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'))

    await act(async () => {
      screen.getByTestId('update-agent').click()
    })
    expect(api.updateAgent).toHaveBeenCalledWith('copilot', { name: 'Updated' })
    expect(screen.getByTestId('agent-names')).toHaveTextContent('Updated')
  })

  it('deleteAgent removes from state', async () => {
    api.deleteAgent.mockResolvedValue({})
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'))

    await act(async () => {
      screen.getByTestId('delete-agent').click()
    })
    expect(api.deleteAgent).toHaveBeenCalledWith('copilot')
    expect(screen.getByTestId('agent-count')).toHaveTextContent('0')
  })

  it('createMcpServer adds to state', async () => {
    api.createMcpServer.mockResolvedValue({ data: { mcp_server_id: 'mcp-2', name: 'New MCP' } })
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'))

    await act(async () => {
      screen.getByTestId('create-mcp').click()
    })
    expect(api.createMcpServer).toHaveBeenCalledWith({ name: 'New MCP' })
    expect(screen.getByTestId('mcp-count')).toHaveTextContent('2')
  })

  it('deleteMcpServer removes from state', async () => {
    api.deleteMcpServer.mockResolvedValue({})
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'))

    await act(async () => {
      screen.getByTestId('delete-mcp').click()
    })
    expect(api.deleteMcpServer).toHaveBeenCalledWith('mcp-1')
    expect(screen.getByTestId('mcp-count')).toHaveTextContent('0')
  })

  it('silently handles load failures', async () => {
    api.listAgents.mockRejectedValue(new Error('fail'))
    api.listMcpServers.mockRejectedValue(new Error('fail'))
    api.listModels.mockRejectedValue(new Error('fail'))
    renderWithProvider()
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('no')
    })
    expect(screen.getByTestId('agent-count')).toHaveTextContent('0')
    expect(screen.getByTestId('mcp-count')).toHaveTextContent('0')
    expect(screen.getByTestId('model-count')).toHaveTextContent('0')
  })
})
