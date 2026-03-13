import { describe, it, expect, vi } from 'vitest'
import { login, register, getMe, resendVerification } from '../../api/auth'

vi.mock('../../api/client', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: {} }),
    get: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

import client from '../../api/client'

describe('auth API', () => {
  it('login calls POST /auth/login with credentials', async () => {
    await login('alice', 'Pass1234')
    expect(client.post).toHaveBeenCalledWith('/auth/login', {
      username: 'alice',
      password: 'Pass1234',
    })
  })

  it('register calls POST /auth/register with data', async () => {
    await register('alice', 'alice@test.com', 'Pass1234')
    expect(client.post).toHaveBeenCalledWith('/auth/register', {
      username: 'alice',
      email: 'alice@test.com',
      password: 'Pass1234',
    })
  })

  it('getMe calls GET /auth/me', async () => {
    await getMe()
    expect(client.get).toHaveBeenCalledWith('/auth/me')
  })
})
