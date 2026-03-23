import client from './client'

export const listAgentTemplates = () => client.get('/agents/templates')
export const checkAgentHealth = () => client.get('/agents/health')
export const bindAgent = (taskId, data, workspaceId) =>
  client.post(`/tasks/${taskId}/agent/bind?workspace_id=${workspaceId}`, data)
export const unbindAgent = (taskId, workspaceId) =>
  client.post(`/tasks/${taskId}/agent/unbind?workspace_id=${workspaceId}`)
export const getAgentStatus = (taskId, workspaceId) =>
  client.get(`/tasks/${taskId}/agent/status?workspace_id=${workspaceId}`)
export const getAgentMessages = (taskId, workspaceId) =>
  client.get(`/tasks/${taskId}/agent/messages?workspace_id=${workspaceId}`)
export const triggerExecution = (taskId, workspaceId) =>
  client.post(`/tasks/${taskId}/agent/execute?workspace_id=${workspaceId}`)
export const breakdownTask = (taskId, workspaceId) =>
  client.post(`/tasks/${taskId}/agent/breakdown?workspace_id=${workspaceId}`)
export const getSubtasks = (taskId, workspaceId) =>
  client.get(`/tasks/${taskId}/subtasks?workspace_id=${workspaceId}`)
