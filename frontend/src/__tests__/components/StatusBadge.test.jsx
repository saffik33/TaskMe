import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusBadge from '../../components/StatusBadge'

describe('StatusBadge', () => {
  it('renders the status text', () => {
    render(<StatusBadge status="Done" />)
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('renders different statuses', () => {
    const { rerender } = render(<StatusBadge status="To Do" />)
    expect(screen.getByText('To Do')).toBeInTheDocument()

    rerender(<StatusBadge status="In Progress" />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()

    rerender(<StatusBadge status="Blocked" />)
    expect(screen.getByText('Blocked')).toBeInTheDocument()
  })
})
