import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AgentProvider, useAgent } from '../../context/AgentContext'

// Mock dependencies
vi.mock('../../api/agents', () => ({
  checkAgentHealth: vi.fn(),
  listAgentTemplates: vi.fn(),
  bindAgent: vi.fn(),
  unbindAgent: vi.fn(),
  getAgentMessages: vi.fn(),
  getAgentStatus: vi.fn(),
}))

const mockConnect = vi.fn()
const mockSend = vi.fn()
const mockClose = vi.fn()

vi.mock('../../hooks/useAgentWebSocket', () => ({
  default: () => ({
    connect: mockConnect,
    send: mockSend,
    close: mockClose,
    status: 'disconnected',
    error: null,
  }),
}))

vi.mock('../../context/WorkspaceContext', () => ({
  useWorkspaces: () => ({
    activeWorkspace: { id: 1, name: 'Test Workspace' },
  }),
}))

vi.mock('../../context/TaskContext', () => ({
  useTasks: () => ({
    loadTasks: vi.fn(),
  }),
}))

import * as agentsApi from '../../api/agents'

function TestConsumer() {
  const {
    agentAvailable, templates, activePanel, messages, streaming,
    openPanel, closePanel, sendMessage, bindAgentToTask, unbindAgentFromTask,
    bindAndOpenPanel,
  } = useAgent()

  return (
    <div>
      <div data-testid="available">{agentAvailable ? 'yes' : 'no'}</div>
      <div data-testid="template-count">{templates.length}</div>
      <div data-testid="panel-open">{activePanel ? 'open' : 'closed'}</div>
      <div data-testid="message-count">{messages.length}</div>
      <div data-testid="streaming">{streaming ? 'yes' : 'no'}</div>
      <button data-testid="open-panel" onClick={() => openPanel({ id: 1, task_name: 'Test', agent_id: 'task-copilot' })}>Open</button>
      <button data-testid="close-panel" onClick={closePanel}>Close</button>
      <button data-testid="send-msg" onClick={() => sendMessage('hello')}>Send</button>
      <button data-testid="send-empty" onClick={() => sendMessage('')}>SendEmpty</button>
      <button data-testid="bind" onClick={() => bindAgentToTask(1, 'task-copilot', 'assistive')}>Bind</button>
      <button data-testid="unbind" onClick={() => unbindAgentFromTask(1)}>Unbind</button>
      <button data-testid="bind-and-open" onClick={() => bindAndOpenPanel(1, 'task-copilot', { id: 1, task_name: 'Test' })}>BindOpen</button>
    </div>
  )
}

function renderWithProvider() {
  return render(
    <AgentProvider>
      <TestConsumer />
    </AgentProvider>,
  )
}

describe('AgentContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    agentsApi.checkAgentHealth.mockResolvedValue({ data: { available: true } })
    agentsApi.listAgentTemplates.mockResolvedValue({ data: [{ agent_id: 'task-copilot', name: 'Co-Pilot' }] })
    agentsApi.getAgentMessages.mockResolvedValue({ data: [] })
    agentsApi.bindAgent.mockResolvedValue({ data: {} })
    agentsApi.unbindAgent.mockResolvedValue({ data: {} })
  })

  it('checks agent health on mount', async () => {
    renderWithProvider()
    await waitFor(() => {
      expect(agentsApi.checkAgentHealth).toHaveBeenCalled()
    })
  })

  it('sets agentAvailable from health check', async () => {
    renderWithProvider()
    await waitFor(() => {
      expect(screen.getByTestId('available')).toHaveTextContent('yes')
    })
  })

  it('loads templates when available', async () => {
    renderWithProvider()
    await waitFor(() => {
      expect(screen.getByTestId('template-count')).toHaveTextContent('1')
    })
  })

  it('does not load templates when unavailable', async () => {
    agentsApi.checkAgentHealth.mockResolvedValue({ data: { available: false } })
    renderWithProvider()
    await waitFor(() => {
      expect(screen.getByTestId('available')).toHaveTextContent('no')
    })
    expect(screen.getByTestId('template-count')).toHaveTextContent('0')
  })

  it('openPanel sets active panel', async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('available')).toHaveTextContent('yes'))

    act(() => {
      screen.getByTestId('open-panel').click()
    })
    expect(screen.getByTestId('panel-open')).toHaveTextContent('open')
  })

  it('closePanel clears panel and messages', async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('available')).toHaveTextContent('yes'))

    act(() => screen.getByTestId('open-panel').click())
    expect(screen.getByTestId('panel-open')).toHaveTextContent('open')

    act(() => screen.getByTestId('close-panel').click())
    expect(screen.getByTestId('panel-open')).toHaveTextContent('closed')
    expect(mockClose).toHaveBeenCalled()
  })

  it('sendMessage adds user message and calls WS send', async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('available')).toHaveTextContent('yes'))

    act(() => screen.getByTestId('open-panel').click())
    act(() => screen.getByTestId('send-msg').click())
    expect(screen.getByTestId('message-count')).toHaveTextContent('1')
    expect(mockSend).toHaveBeenCalledWith({ type: 'user_message', content: 'hello' })
  })

  it('sendMessage with empty string does nothing', async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('available')).toHaveTextContent('yes'))

    act(() => screen.getByTestId('send-empty').click())
    expect(screen.getByTestId('message-count')).toHaveTextContent('0')
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('bindAgentToTask calls API and reloads tasks', async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('available')).toHaveTextContent('yes'))

    await act(async () => {
      screen.getByTestId('bind').click()
    })
    expect(agentsApi.bindAgent).toHaveBeenCalledWith(1, { agent_id: 'task-copilot', mode: 'assistive' }, 1)
  })

  it('unbindAgentFromTask calls API', async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('available')).toHaveTextContent('yes'))

    await act(async () => {
      screen.getByTestId('unbind').click()
    })
    expect(agentsApi.unbindAgent).toHaveBeenCalledWith(1, 1)
  })

  it('unbindAgentFromTask closes panel', async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('available')).toHaveTextContent('yes'))

    act(() => screen.getByTestId('open-panel').click())
    expect(screen.getByTestId('panel-open')).toHaveTextContent('open')

    await act(async () => {
      screen.getByTestId('unbind').click()
    })
    expect(screen.getByTestId('panel-open')).toHaveTextContent('closed')
  })

  it('bindAndOpenPanel binds agent and opens panel', async () => {
    renderWithProvider()
    await waitFor(() => expect(screen.getByTestId('available')).toHaveTextContent('yes'))

    await act(async () => {
      screen.getByTestId('bind-and-open').click()
    })
    expect(agentsApi.bindAgent).toHaveBeenCalledWith(1, { agent_id: 'task-copilot', mode: 'assistive' }, 1)
    expect(screen.getByTestId('panel-open')).toHaveTextContent('open')
  })

  it('health check failure sets agentAvailable to false', async () => {
    agentsApi.checkAgentHealth.mockRejectedValue(new Error('network'))
    renderWithProvider()
    await waitFor(() => {
      expect(screen.getByTestId('available')).toHaveTextContent('no')
    })
  })
})
