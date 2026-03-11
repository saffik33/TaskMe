import { describe, it, expect } from 'vitest'
import { formatDate, toInputDate } from '../../utils/dateHelpers'

describe('formatDate', () => {
  it('formats a valid ISO date string', () => {
    expect(formatDate('2024-03-15')).toBe('Mar 15, 2024')
  })

  it('returns dash for null', () => {
    expect(formatDate(null)).toBe('—')
  })

  it('returns dash for undefined', () => {
    expect(formatDate(undefined)).toBe('—')
  })

  it('returns dash for empty string', () => {
    expect(formatDate('')).toBe('—')
  })

  it('returns dash for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('—')
  })
})

describe('toInputDate', () => {
  it('converts ISO date to input format', () => {
    expect(toInputDate('2024-03-15')).toBe('2024-03-15')
  })

  it('returns empty string for null', () => {
    expect(toInputDate(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(toInputDate(undefined)).toBe('')
  })
})
