import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmDialog from '../../components/ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <ConfirmDialog open={false} title="Delete?" message="Are you sure?" onConfirm={() => {}} onCancel={() => {}} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders title and message when open', () => {
    render(
      <ConfirmDialog open={true} title="Delete Task" message="This cannot be undone" onConfirm={() => {}} onCancel={() => {}} />
    )
    expect(screen.getByText('Delete Task')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone')).toBeInTheDocument()
  })

  it('calls onConfirm when Delete is clicked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog open={true} title="Delete?" message="Sure?" onConfirm={onConfirm} onCancel={() => {}} />
    )
    await user.click(screen.getByText('Delete'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog open={true} title="Delete?" message="Sure?" onConfirm={() => {}} onCancel={onCancel} />
    )
    await user.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
