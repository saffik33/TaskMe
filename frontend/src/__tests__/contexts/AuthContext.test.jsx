import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../../context/AuthContext'

// Mock the auth API
vi.mock('../../api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
  getMe: vi.fn(),
  resendVerification: vi.fn(),
}))

import { login as apiLogin, register as apiRegister, getMe } from '../../api/auth'

function TestConsumer() {
  const { user, loading, login, logout, register } = useAuth()
  if (loading) return <div>Loading...</div>
  return (
    <div>
      <div data-testid="user">{user ? user.username : 'none'}</div>
      <button onClick={() => login('test', 'pass')}>Login</button>
      <button onClick={logout}>Logout</button>
      <button onClick={() => register('new', 'new@test.com', 'Pass1234')}>Register</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('starts with no user when no token', async () => {
    getMe.mockRejectedValue(new Error('no token'))
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('none')
    })
  })

  it('loads user from token on mount', async () => {
    sessionStorage.setItem('token', 'valid-token')
    getMe.mockResolvedValue({ data: { username: 'alice', id: 1, email: 'a@t.com' } })
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('alice')
    })
  })

  it('login stores token and sets user', async () => {
    getMe.mockRejectedValue(new Error('no token'))
    apiLogin.mockResolvedValue({
      data: { access_token: 'new-token', user: { username: 'bob', id: 2 } },
    })
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('none'))

    await act(async () => {
      screen.getByText('Login').click()
    })
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).toBe('bob')
    })
    expect(sessionStorage.getItem('token')).toBe('new-token')
  })

  it('logout clears token and user', async () => {
    sessionStorage.setItem('token', 'valid-token')
    getMe.mockResolvedValue({ data: { username: 'alice', id: 1 } })
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('alice'))

    await act(async () => {
      screen.getByText('Logout').click()
    })
    expect(screen.getByTestId('user').textContent).toBe('none')
    expect(sessionStorage.getItem('token')).toBeNull()
  })

  it('register calls API but does not auto-login', async () => {
    getMe.mockRejectedValue(new Error('no token'))
    apiRegister.mockResolvedValue({ data: { message: 'Check email' } })
    render(<AuthProvider><TestConsumer /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('none'))

    await act(async () => { screen.getByText('Register').click() })
    expect(apiRegister).toHaveBeenCalledWith('new', 'new@test.com', 'Pass1234')
    // User should remain null — no auto-login after register
    expect(screen.getByTestId('user').textContent).toBe('none')
    expect(sessionStorage.getItem('token')).toBeNull()
  })
})
