import { describe, it, expect, vi } from 'vitest'
import {
  fetchWorkspaces,
  createWorkspace,
  inviteMember,
  changeRole,
} from '../../api/workspaces'

vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

import client from '../../api/client'

describe('workspaces API', () => {
  it('fetchWorkspaces calls GET /workspaces', async () => {
    await fetchWorkspaces()
    expect(client.get).toHaveBeenCalledWith('/workspaces')
  })

  it('createWorkspace sends POST with name', async () => {
    await createWorkspace({ name: 'Project X' })
    expect(client.post).toHaveBeenCalledWith('/workspaces', { name: 'Project X' })
  })

  it('inviteMember sends POST with email and role', async () => {
    await inviteMember(1, 'bob@test.com', 'editor')
    expect(client.post).toHaveBeenCalledWith('/workspaces/1/invite', {
      email: 'bob@test.com',
      role: 'editor',
    })
  })

  it('changeRole sends PATCH with role', async () => {
    await changeRole(1, 5, 'viewer')
    expect(client.patch).toHaveBeenCalledWith('/workspaces/1/members/5/role', {
      role: 'viewer',
    })
  })
})
