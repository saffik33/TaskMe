import client from './client'

export const fetchTasks = (params = {}) => client.get('/tasks', { params })

export const getTask = (id) => client.get(`/tasks/${id}`)

export const createTask = (data, params = {}) => client.post('/tasks', data, { params })

export const createBulkTasks = (tasks, params = {}) => client.post('/tasks/bulk', tasks, { params })

export const updateTask = (id, data) => client.patch(`/tasks/${id}`, data)

export const deleteTask = (id) => client.delete(`/tasks/${id}`)

export const deleteAllTasks = (params = {}) => client.delete('/tasks/all', { params })

export const copyMoveTasks = (taskIds, destinationWorkspaceId, action) =>
  client.post('/tasks/copy-move', { task_ids: taskIds, destination_workspace_id: destinationWorkspaceId, action })

export const deleteBulkTasks = (ids) => client.delete('/tasks/bulk/delete', { data: ids })

export const parseText = (text, provider, tone, workspaceId) =>
  client.post('/parse', { text, provider, tone, workspace_id: workspaceId })

export const smartSearch = (query, provider) =>
  client.post('/tasks/smart-search', { query, provider })

export const exportExcel = (params = {}) =>
  client.get('/export/excel', { params, responseType: 'blob' })

export const sendNotification = (taskIds, message = '') =>
  client.post('/email/notify', { task_ids: taskIds, message })

export const createShareLink = (taskIds, workspaceId) =>
  client.post('/share', { task_ids: taskIds, workspace_id: workspaceId })

export const getSharedTasks = (token) => client.get(`/share/${token}`)

export const sendShareEmail = (shareUrl, recipientEmail, taskIds) =>
  client.post('/share/send-email', { share_url: shareUrl, recipient_email: recipientEmail, task_ids: taskIds })

// Column management
export const fetchColumns = (params = {}) => client.get('/columns', { params })
export const createColumn = (data, params = {}) => client.post('/columns', data, { params })
export const updateColumn = (id, data) => client.patch(`/columns/${id}`, data)
export const reorderColumns = (positions) => client.patch('/columns/reorder', positions)
export const deleteColumn = (id) => client.delete(`/columns/${id}`)
