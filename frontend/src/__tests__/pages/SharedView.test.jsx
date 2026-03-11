import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SharedView from '../../pages/SharedView'

vi.mock('../../api/tasks', () => ({
  getSharedTasks: vi.fn(),
}))

import { getSharedTasks } from '../../api/tasks'

function renderSharedView(token = 'test-token') {
  return render(
    <MemoryRouter initialEntries={[`/shared/${token}`]}>
      <Routes>
        <Route path="/shared/:token" element={<SharedView />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('SharedView', () => {
  it('renders shared tasks on success', async () => {
    getSharedTasks.mockResolvedValue({
      data: [
        { id: 1, task_name: 'Shared Task', owner: 'Alice', due_date: null, status: 'To Do', priority: 'High' },
      ],
    })
    renderSharedView()
    await waitFor(() => {
      expect(screen.getByText('Shared Task')).toBeInTheDocument()
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
  })

  it('shows error on invalid/expired token', async () => {
    getSharedTasks.mockRejectedValue(new Error('Not found'))
    renderSharedView('bad-token')
    await waitFor(() => {
      expect(screen.getByText(/invalid or has expired/)).toBeInTheDocument()
    })
  })
})
