import client from './client'

export const fetchTasks = (params = {}) => client.get('/tasks', { params })

export const getTask = (id) => client.get(`/tasks/${id}`)

export const createTask = (data) => client.post('/tasks', data)

export const createBulkTasks = (tasks) => client.post('/tasks/bulk', tasks)

export const updateTask = (id, data) => client.patch(`/tasks/${id}`, data)

export const deleteTask = (id) => client.delete(`/tasks/${id}`)

export const deleteAllTasks = () => client.delete('/tasks/all')

export const deleteBulkTasks = (ids) => client.delete('/tasks/bulk/delete', { data: ids })

export const parseText = (text, provider, tone) =>
  client.post('/parse', { text, provider, tone })

export const exportExcel = (params = {}) =>
  client.get('/export/excel', { params, responseType: 'blob' })

export const sendNotification = (taskIds, message = '') =>
  client.post('/email/notify', { task_ids: taskIds, message })

export const createShareLink = (taskIds) =>
  client.post('/share', { task_ids: taskIds })

export const getSharedTasks = (token) => client.get(`/share/${token}`)

// Column management
export const fetchColumns = () => client.get('/columns')
export const createColumn = (data) => client.post('/columns', data)
export const updateColumn = (id, data) => client.patch(`/columns/${id}`, data)
export const reorderColumns = (positions) => client.patch('/columns/reorder', positions)
export const deleteColumn = (id) => client.delete(`/columns/${id}`)
