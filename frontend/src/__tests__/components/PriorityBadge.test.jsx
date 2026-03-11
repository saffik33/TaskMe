import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PriorityBadge from '../../components/PriorityBadge'

describe('PriorityBadge', () => {
  it('renders the priority text', () => {
    render(<PriorityBadge priority="High" />)
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('renders all priority levels', () => {
    const { rerender } = render(<PriorityBadge priority="Low" />)
    expect(screen.getByText('Low')).toBeInTheDocument()

    rerender(<PriorityBadge priority="Medium" />)
    expect(screen.getByText('Medium')).toBeInTheDocument()

    rerender(<PriorityBadge priority="Critical" />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })
})
