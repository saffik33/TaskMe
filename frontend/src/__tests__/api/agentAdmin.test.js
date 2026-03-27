import { describe, it, expect, vi } from 'vitest'
import client from '../../api/client'
import * as api from '../../api/agentAdmin'

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('agentAdmin API', () => {
  it('listAgents calls GET /admin/agents', async () => {
    client.get.mockResolvedValue({ data: [{ agent_id: 'copilot' }] })
    const res = await api.listAgents()
    expect(client.get).toHaveBeenCalledWith('/admin/agents')
    expect(res.data[0].agent_id).toBe('copilot')
  })

  it('createAgent calls POST /admin/agents', async () => {
    const payload = { name: 'New Agent', agent_id: 'new-agent' }
    client.post.mockResolvedValue({ data: payload })
    await api.createAgent(payload)
    expect(client.post).toHaveBeenCalledWith('/admin/agents', payload)
  })

  it('updateAgent calls PUT /admin/agents/:id', async () => {
    const payload = { name: 'Updated' }
    client.put.mockResolvedValue({ data: payload })
    await api.updateAgent('copilot', payload)
    expect(client.put).toHaveBeenCalledWith('/admin/agents/copilot', payload)
  })

  it('deleteAgent calls DELETE /admin/agents/:id', async () => {
    client.delete.mockResolvedValue({})
    await api.deleteAgent('copilot')
    expect(client.delete).toHaveBeenCalledWith('/admin/agents/copilot')
  })

  it('listMcpServers calls GET /admin/mcp-servers', async () => {
    client.get.mockResolvedValue({ data: [] })
    await api.listMcpServers()
    expect(client.get).toHaveBeenCalledWith('/admin/mcp-servers')
  })

  it('testMcpServer calls POST /admin/mcp-servers/:id/test', async () => {
    client.post.mockResolvedValue({ data: { ok: true } })
    await api.testMcpServer('mcp-1')
    expect(client.post).toHaveBeenCalledWith('/admin/mcp-servers/mcp-1/test')
  })

  it('listModels calls GET /admin/models', async () => {
    client.get.mockResolvedValue({ data: [] })
    await api.listModels()
    expect(client.get).toHaveBeenCalledWith('/admin/models')
  })

  it('listSessions calls GET /admin/sessions with params', async () => {
    client.get.mockResolvedValue({ data: [] })
    await api.listSessions({ agent_id: 'copilot', limit: 10 })
    expect(client.get).toHaveBeenCalledWith('/admin/sessions', { params: { agent_id: 'copilot', limit: 10 } })
  })

  it('getAgent calls GET /admin/agents/:id', async () => {
    client.get.mockResolvedValue({ data: { agent_id: 'copilot' } })
    await api.getAgent('copilot')
    expect(client.get).toHaveBeenCalledWith('/admin/agents/copilot')
  })

  it('createMcpServer calls POST /admin/mcp-servers', async () => {
    const payload = { name: 'GitHub' }
    client.post.mockResolvedValue({ data: payload })
    await api.createMcpServer(payload)
    expect(client.post).toHaveBeenCalledWith('/admin/mcp-servers', payload)
  })

  it('deleteMcpServer calls DELETE /admin/mcp-servers/:id', async () => {
    client.delete.mockResolvedValue({})
    await api.deleteMcpServer('mcp-1')
    expect(client.delete).toHaveBeenCalledWith('/admin/mcp-servers/mcp-1')
  })

  it('searchSessions calls GET with query params', async () => {
    client.get.mockResolvedValue({ data: [] })
    await api.searchSessions('test', 10)
    expect(client.get).toHaveBeenCalledWith('/admin/sessions/search', { params: { q: 'test', limit: 10 } })
  })
})
