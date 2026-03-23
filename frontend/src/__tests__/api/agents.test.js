import { describe, it, expect, vi } from 'vitest'
import client from '../../api/client'
import * as agents from '../../api/agents'

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

describe('agents API', () => {
  it('listAgentTemplates calls GET /agents/templates', async () => {
    client.get.mockResolvedValue({ data: [{ agent_id: 'task-copilot' }] })
    const res = await agents.listAgentTemplates()
    expect(client.get).toHaveBeenCalledWith('/agents/templates')
    expect(res.data[0].agent_id).toBe('task-copilot')
  })

  it('checkAgentHealth calls GET /agents/health', async () => {
    client.get.mockResolvedValue({ data: { available: true } })
    const res = await agents.checkAgentHealth()
    expect(client.get).toHaveBeenCalledWith('/agents/health')
    expect(res.data.available).toBe(true)
  })

  it('bindAgent calls POST with workspace_id', async () => {
    client.post.mockResolvedValue({ data: { agent_id: 'task-copilot' } })
    await agents.bindAgent(1, { agent_id: 'task-copilot', mode: 'assistive' }, 5)
    expect(client.post).toHaveBeenCalledWith(
      '/tasks/1/agent/bind?workspace_id=5',
      { agent_id: 'task-copilot', mode: 'assistive' },
    )
  })

  it('unbindAgent calls POST with workspace_id', async () => {
    client.post.mockResolvedValue({ data: {} })
    await agents.unbindAgent(1, 5)
    expect(client.post).toHaveBeenCalledWith('/tasks/1/agent/unbind?workspace_id=5')
  })

  it('getAgentStatus calls GET with workspace_id', async () => {
    client.get.mockResolvedValue({ data: { agent_status: 'idle' } })
    await agents.getAgentStatus(1, 5)
    expect(client.get).toHaveBeenCalledWith('/tasks/1/agent/status?workspace_id=5')
  })

  it('getAgentMessages calls GET with workspace_id', async () => {
    client.get.mockResolvedValue({ data: [] })
    await agents.getAgentMessages(1, 5)
    expect(client.get).toHaveBeenCalledWith('/tasks/1/agent/messages?workspace_id=5')
  })

  it('breakdownTask calls POST with workspace_id', async () => {
    client.post.mockResolvedValue({ data: { subtasks_created: 3 } })
    await agents.breakdownTask(1, 5)
    expect(client.post).toHaveBeenCalledWith('/tasks/1/agent/breakdown?workspace_id=5')
  })

  it('getSubtasks calls GET with workspace_id', async () => {
    client.get.mockResolvedValue({ data: [] })
    await agents.getSubtasks(1, 5)
    expect(client.get).toHaveBeenCalledWith('/tasks/1/subtasks?workspace_id=5')
  })
})
