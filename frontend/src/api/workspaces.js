import client from './client'

export const fetchWorkspaces = () => client.get('/workspaces')

export const createWorkspace = (data) => client.post('/workspaces', data)

export const getWorkspace = (id) => client.get(`/workspaces/${id}`)

export const updateWorkspace = (id, data) => client.patch(`/workspaces/${id}`, data)

export const deleteWorkspace = (id) => client.delete(`/workspaces/${id}`)
