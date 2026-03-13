import { describe, it, expect, vi } from 'vitest'
import { fetchTasks, createTask, deleteTask } from '../../api/tasks'

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

import client from '../../api/client'

describe('tasks API', () => {
  it('fetchTasks passes workspace_id as query param', async () => {
    await fetchTasks({ workspace_id: 5 })
    expect(client.get).toHaveBeenCalledWith('/tasks', {
      params: { workspace_id: 5 },
    })
  })

  it('createTask sends POST with workspace_id param', async () => {
    await createTask({ task_name: 'New' }, { workspace_id: 3 })
    expect(client.post).toHaveBeenCalledWith(
      '/tasks',
      { task_name: 'New' },
      { params: { workspace_id: 3 } },
    )
  })

  it('deleteTask sends DELETE with task id', async () => {
    await deleteTask(42)
    expect(client.delete).toHaveBeenCalledWith('/tasks/42')
  })
})
