import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

let mockModels = []

vi.mock('../../../context/AgentAdminContext', () => ({
  useAgentAdmin: () => ({
    models: mockModels,
  }),
}))

import ModelCatalog from '../../../components/admin/ModelCatalog'

describe('ModelCatalog', () => {
  beforeEach(() => {
    mockModels = [
      {
        model_id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        display_name: 'Claude 3 Opus',
        vendor: 'Anthropic',
        context_window: 200000,
        max_output_tokens: 4096,
        input_price_per_1m: 15.0,
        output_price_per_1m: 75.0,
        tool_use: true,
        vision: true,
        thinking_support: true,
      },
      {
        model_id: 'gpt-4',
        name: 'GPT-4',
        display_name: 'GPT-4',
        vendor: 'OpenAI',
        context_window: 128000,
        max_output_tokens: 8192,
        input_price_per_1m: 10.0,
        output_price_per_1m: 30.0,
        tool_use: true,
        vision: false,
        thinking_support: false,
      },
    ]
  })

  it('renders model cards', () => {
    render(<ModelCatalog />)
    expect(screen.getByText('Claude 3 Opus')).toBeInTheDocument()
    expect(screen.getByText('GPT-4')).toBeInTheDocument()
  })

  it('shows vendor badges', () => {
    render(<ModelCatalog />)
    // Vendor text appears in badges and in filter dropdown options
    expect(screen.getAllByText('Anthropic').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('OpenAI').length).toBeGreaterThanOrEqual(1)
  })

  it('filter by vendor shows only matching models', () => {
    render(<ModelCatalog />)
    const select = screen.getByDisplayValue('All')
    fireEvent.change(select, { target: { value: 'Anthropic' } })
    expect(screen.getByText('Claude 3 Opus')).toBeInTheDocument()
    expect(screen.queryByText('GPT-4')).not.toBeInTheDocument()
  })

  it('shows capabilities badges', () => {
    render(<ModelCatalog />)
    // Both models have tool_use, so "Tool Use" appears twice
    expect(screen.getAllByText('Tool Use').length).toBe(2)
    // Only Anthropic model has vision and thinking
    expect(screen.getByText('Vision')).toBeInTheDocument()
    expect(screen.getByText('Thinking')).toBeInTheDocument()
  })

  it('shows pricing information', () => {
    render(<ModelCatalog />)
    expect(screen.getByText('$15.00')).toBeInTheDocument()
    expect(screen.getByText('$75.00')).toBeInTheDocument()
  })

  it('shows context window formatted', () => {
    render(<ModelCatalog />)
    expect(screen.getByText('200K')).toBeInTheDocument()
    expect(screen.getByText('128K')).toBeInTheDocument()
  })

  it('shows empty state when no models', () => {
    mockModels = []
    render(<ModelCatalog />)
    expect(screen.getByText('No models found')).toBeInTheDocument()
  })

  it('filter dropdown includes all vendors', () => {
    render(<ModelCatalog />)
    const select = screen.getByDisplayValue('All')
    const options = select.querySelectorAll('option')
    expect(options.length).toBe(3) // All + Anthropic + OpenAI
  })
})
