import client from './client'

// Agents
export const listAgents = () => client.get('/admin/agents')
export const getAgent = (id) => client.get(`/admin/agents/${id}`)
export const createAgent = (data) => client.post('/admin/agents', data)
export const updateAgent = (id, data) => client.put(`/admin/agents/${id}`, data)
export const deleteAgent = (id) => client.delete(`/admin/agents/${id}`)
export const getAgentVersions = (id) => client.get(`/admin/agents/${id}/versions`)
export const rollbackAgent = (id, body) => client.post(`/admin/agents/${id}/rollback`, body)

// MCP Servers
export const listMcpServers = () => client.get('/admin/mcp-servers')
export const getMcpServer = (id) => client.get(`/admin/mcp-servers/${id}`)
export const createMcpServer = (data) => client.post('/admin/mcp-servers', data)
export const updateMcpServer = (id, data) => client.put(`/admin/mcp-servers/${id}`, data)
export const deleteMcpServer = (id) => client.delete(`/admin/mcp-servers/${id}`)
export const testMcpServer = (id) => client.post(`/admin/mcp-servers/${id}/test`)

// Models
export const listModels = () => client.get('/admin/models')

// Sessions
export const listSessions = (params) => client.get('/admin/sessions', { params })
export const getSession = (id) => client.get(`/admin/sessions/${id}`)
export const getSessionMessages = (id) => client.get(`/admin/sessions/${id}/messages`)
export const searchSessions = (q, limit = 20) => client.get('/admin/sessions/search', { params: { q, limit } })
