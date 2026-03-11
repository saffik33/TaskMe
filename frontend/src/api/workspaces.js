import client from './client'

export const fetchWorkspaces = () => client.get('/workspaces')

export const createWorkspace = (data) => client.post('/workspaces', data)

export const getWorkspace = (id) => client.get(`/workspaces/${id}`)

export const updateWorkspace = (id, data) => client.patch(`/workspaces/${id}`, data)

export const deleteWorkspace = (id) => client.delete(`/workspaces/${id}`)

// Member management
export const fetchMembers = (workspaceId) => client.get(`/workspaces/${workspaceId}/members`)

export const inviteMember = (workspaceId, email, role) =>
  client.post(`/workspaces/${workspaceId}/invite`, { email, role })

export const removeMember = (workspaceId, userId) =>
  client.delete(`/workspaces/${workspaceId}/members/${userId}`)

export const changeRole = (workspaceId, userId, role) =>
  client.patch(`/workspaces/${workspaceId}/members/${userId}/role`, { role })

export const acceptInvite = (token) => client.post(`/invites/${token}/accept`)
