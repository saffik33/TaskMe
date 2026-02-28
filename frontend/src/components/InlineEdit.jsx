import { useState, useRef, useEffect } from 'react'
import { Pencil } from 'lucide-react'

export default function InlineEdit({
  value,
  onSave,
  type = 'text',
  required = false,
  maxLength,
  placeholder = '—',
  formatDisplay,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [error, setError] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  useEffect(() => {
    setDraft(value ?? '')
  }, [value])

  const displayValue = formatDisplay ? formatDisplay(value) : (value || placeholder)
  const isEmpty = !value && !formatDisplay

  const handleStart = (e) => {
    e.stopPropagation()
    setEditing(true)
    setError(false)
  }

  const handleSave = () => {
    const trimmed = typeof draft === 'string' ? draft.trim() : draft
    if (required && !trimmed) {
      setError(true)
      return
    }
    setEditing(false)
    setError(false)
    const newValue = trimmed || null
    if (newValue !== (value || null)) {
      onSave(newValue)
    }
  }

  const handleCancel = () => {
    setEditing(false)
    setDraft(value ?? '')
    setError(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && type !== 'textarea') handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  const inputClass = `w-full px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
    error ? 'border-red-400 focus:ring-red-400' : 'border-gray-300'
  }`

  if (editing) {
    const InputTag = type === 'textarea' ? 'textarea' : 'input'
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <InputTag
          ref={inputRef}
          type={type === 'textarea' ? undefined : type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          maxLength={maxLength}
          rows={type === 'textarea' ? 2 : undefined}
          className={inputClass}
        />
      </div>
    )
  }

  return (
    <div
      onClick={handleStart}
      className="group/edit flex items-center gap-1 cursor-pointer min-h-[28px] min-w-0"
    >
      <span className={`truncate ${isEmpty ? 'text-gray-400' : ''}`}>
        {displayValue}
      </span>
      <Pencil className="w-3 h-3 shrink-0 text-gray-300 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
    </div>
  )
}
