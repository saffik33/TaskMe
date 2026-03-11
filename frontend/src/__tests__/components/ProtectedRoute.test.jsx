import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProtectedRoute from '../../components/ProtectedRoute'

vi.mock('../../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../../context/AuthContext'

describe('ProtectedRoute', () => {
  it('renders children when user is authenticated', () => {
    useAuth.mockReturnValue({ user: { id: 1, username: 'alice' }, loading: false })
    render(
      <MemoryRouter>
        <ProtectedRoute><div>Protected Content</div></ProtectedRoute>
      </MemoryRouter>
    )
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects to /login when no user', () => {
    useAuth.mockReturnValue({ user: null, loading: false })
    const { container } = render(
      <MemoryRouter>
        <ProtectedRoute><div>Protected Content</div></ProtectedRoute>
      </MemoryRouter>
    )
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('shows spinner while loading', () => {
    useAuth.mockReturnValue({ user: null, loading: true })
    const { container } = render(
      <MemoryRouter>
        <ProtectedRoute><div>Protected Content</div></ProtectedRoute>
      </MemoryRouter>
    )
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('does not render children while loading', () => {
    useAuth.mockReturnValue({ user: null, loading: true })
    render(
      <MemoryRouter>
        <ProtectedRoute><div>Protected Content</div></ProtectedRoute>
      </MemoryRouter>
    )
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })
})
