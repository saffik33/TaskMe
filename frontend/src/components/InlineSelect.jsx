import { useState, useEffect, useRef } from 'react'

export default function InlineSelect({ value, options, onSelect, renderBadge }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = (val) => {
    setOpen(false)
    if (val !== value) onSelect(val)
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        className="cursor-pointer hover:ring-2 hover:ring-indigo-200 rounded-full transition-shadow"
      >
        {renderBadge(value)}
      </button>
      {open && (
        <div className="absolute z-10 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-purple-50 flex items-center gap-2 ${
                opt.value === value ? 'font-semibold bg-purple-50' : ''
              } ${opt.color?.match(/text-\S+/)?.[0] || ''}`}
            >
              <span className={`inline-block w-2 h-2 rounded-full ${opt.color?.split(' ')[0] || 'bg-gray-300'}`} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
