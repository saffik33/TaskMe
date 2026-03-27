import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ToolBuilder from '../../../components/admin/ToolBuilder'

describe('ToolBuilder', () => {
  let tools
  let onChange

  beforeEach(() => {
    tools = []
    onChange = vi.fn()
  })

  it('renders with no tools', () => {
    render(<ToolBuilder tools={[]} onChange={onChange} />)
    expect(screen.getByText('Client Tools (0)')).toBeInTheDocument()
    expect(screen.getByText('Add Tool')).toBeInTheDocument()
  })

  it('renders existing tools', () => {
    tools = [
      { name: 'update_task', description: 'Updates a task', parameters: [] },
      { name: 'create_note', description: 'Creates a note', parameters: [] },
    ]
    render(<ToolBuilder tools={tools} onChange={onChange} />)
    expect(screen.getByText('Client Tools (2)')).toBeInTheDocument()
    expect(screen.getByText('update_task')).toBeInTheDocument()
    expect(screen.getByText('create_note')).toBeInTheDocument()
  })

  it('add tool calls onChange with new empty tool', () => {
    render(<ToolBuilder tools={[]} onChange={onChange} />)
    fireEvent.click(screen.getByText('Add Tool'))
    expect(onChange).toHaveBeenCalledWith([{ name: '', description: '', parameters: [] }])
  })

  it('remove tool calls onChange without removed tool', () => {
    tools = [
      { name: 'tool_a', description: 'A', parameters: [] },
      { name: 'tool_b', description: 'B', parameters: [] },
    ]
    const { container } = render(<ToolBuilder tools={tools} onChange={onChange} />)
    // Each tool header row has a remove button with a Trash2 SVG
    const toolHeaders = container.querySelectorAll('.bg-gray-50')
    // The first tool header's last button is the remove button
    const firstRemoveBtn = toolHeaders[0].querySelectorAll('button')[1]
    fireEvent.click(firstRemoveBtn)
    expect(onChange).toHaveBeenCalledWith([{ name: 'tool_b', description: 'B', parameters: [] }])
  })

  it('add parameter calls onChange with new param', () => {
    tools = [{ name: 'my_tool', description: 'Does stuff', parameters: [] }]
    render(<ToolBuilder tools={tools} onChange={onChange} />)
    // Expand the tool first
    fireEvent.click(screen.getByText('my_tool'))
    // Click "Add" parameter button
    fireEvent.click(screen.getByText('Add'))
    expect(onChange).toHaveBeenCalledWith([{
      name: 'my_tool',
      description: 'Does stuff',
      parameters: [{ name: '', type: 'string', description: '', required: false }],
    }])
  })

  it('raw JSON toggle switches modes', () => {
    render(<ToolBuilder tools={[]} onChange={onChange} />)
    expect(screen.getByText('Raw JSON')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Raw JSON'))
    expect(screen.getByText('Visual Editor')).toBeInTheDocument()
  })

  it('shows no parameters message when tool has none', () => {
    tools = [{ name: 'empty_tool', description: 'No params', parameters: [] }]
    render(<ToolBuilder tools={tools} onChange={onChange} />)
    fireEvent.click(screen.getByText('empty_tool'))
    expect(screen.getByText('No parameters defined')).toBeInTheDocument()
  })

  it('renders parameter table when tool has parameters', () => {
    tools = [{
      name: 'my_tool',
      description: 'Test',
      parameters: [{ name: 'query', type: 'string', description: 'Search query', required: true }],
    }]
    render(<ToolBuilder tools={tools} onChange={onChange} />)
    fireEvent.click(screen.getByText('my_tool'))
    expect(screen.getByDisplayValue('query')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Search query')).toBeInTheDocument()
  })
})
