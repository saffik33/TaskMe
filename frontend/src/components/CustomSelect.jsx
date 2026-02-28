import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

export default function CustomSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selected = options.find((o) => o.value === value)

  // Extract just the text color class from a color string like "bg-blue-100 text-blue-700"
  const getTextClass = (color) => {
    if (!color) return ''
    const match = color.match(/text-\S+/)
    return match ? match[0] : ''
  }

  // Extract just the bg color class
  const getBgClass = (color) => {
    if (!color) return ''
    const match = color.match(/bg-\S+/)
    return match ? match[0] : ''
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-2 border border-purple-300 rounded-lg text-sm bg-white hover:bg-purple-50 transition-colors min-w-[130px] justify-between ${
          selected && selected.color ? getTextClass(selected.color) : 'text-purple-700'
        }`}
      >
        {selected && selected.color && (
          <span className={`w-2 h-2 rounded-full ${getBgClass(selected.color)}`} />
        )}
        <span className="flex-1 text-left">{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-purple-200 rounded-lg shadow-lg py-1 max-h-60 overflow-auto">
          <div
            onClick={() => { onChange(''); setOpen(false) }}
            className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
              !value ? 'bg-purple-50 text-purple-700 font-medium' : 'text-purple-600 hover:bg-purple-50 hover:text-purple-900'
            }`}
          >
            {placeholder}
          </div>
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors flex items-center gap-2 ${
                value === opt.value
                  ? `font-medium ${opt.color ? getBgClass(opt.color) + '/20 ' + getTextClass(opt.color) : 'bg-purple-50 text-purple-700'}`
                  : `${opt.color ? getTextClass(opt.color) : 'text-purple-600'} hover:bg-purple-50`
              }`}
            >
              {opt.color && (
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getBgClass(opt.color)}`} />
              )}
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
