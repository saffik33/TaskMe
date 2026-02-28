import { format, parseISO, isValid } from 'date-fns'

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
    return isValid(d) ? format(d, 'MMM d, yyyy') : '—'
  } catch {
    return '—'
  }
}

export function toInputDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr
    return isValid(d) ? format(d, 'yyyy-MM-dd') : ''
  } catch {
    return ''
  }
}
