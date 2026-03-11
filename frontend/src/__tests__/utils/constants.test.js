import { describe, it, expect } from 'vitest'
import { TASK_STATUSES, TASK_PRIORITIES, getStatusColor, getPriorityColor } from '../../utils/constants'

describe('TASK_STATUSES', () => {
  it('has 4 statuses', () => {
    expect(TASK_STATUSES).toHaveLength(4)
  })

  it('includes To Do, In Progress, Done, Blocked', () => {
    const values = TASK_STATUSES.map(s => s.value)
    expect(values).toEqual(['To Do', 'In Progress', 'Done', 'Blocked'])
  })
})

describe('TASK_PRIORITIES', () => {
  it('has 4 priorities', () => {
    expect(TASK_PRIORITIES).toHaveLength(4)
  })

  it('includes Low, Medium, High, Critical', () => {
    const values = TASK_PRIORITIES.map(p => p.value)
    expect(values).toEqual(['Low', 'Medium', 'High', 'Critical'])
  })
})

describe('getStatusColor', () => {
  it('returns correct color for Done', () => {
    expect(getStatusColor('Done')).toContain('green')
  })

  it('returns fallback for unknown status', () => {
    expect(getStatusColor('Unknown')).toContain('gray')
  })
})

describe('getPriorityColor', () => {
  it('returns correct color for Critical', () => {
    expect(getPriorityColor('Critical')).toContain('red')
  })

  it('returns fallback for unknown priority', () => {
    expect(getPriorityColor('Unknown')).toContain('gray')
  })
})
