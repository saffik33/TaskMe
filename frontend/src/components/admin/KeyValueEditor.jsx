import { Plus, Trash2 } from 'lucide-react'

export default function KeyValueEditor({ value = {}, onChange }) {
  const pairs = Object.entries(value)

  const updateKey = (oldKey, newKey) => {
    const entries = Object.entries(value)
    const updated = {}
    for (const [k, v] of entries) {
      if (k === oldKey) {
        updated[newKey] = v
      } else {
        updated[k] = v
      }
    }
    onChange(updated)
  }

  const updateValue = (key, newVal) => {
    onChange({ ...value, [key]: newVal })
  }

  const addPair = () => {
    let newKey = ''
    let i = 0
    while (newKey in value || newKey === '') {
      newKey = `key-${i++}`
    }
    onChange({ ...value, [newKey]: '' })
  }

  const removePair = (key) => {
    const copy = { ...value }
    delete copy[key]
    onChange(copy)
  }

  return (
    <div className="space-y-2">
      {pairs.map(([k, v], idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="text"
            value={k}
            onChange={(e) => updateKey(k, e.target.value)}
            placeholder="Key"
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <input
            type="text"
            value={v}
            onChange={(e) => updateValue(k, e.target.value)}
            placeholder="Value"
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
          <button
            type="button"
            onClick={() => removePair(k)}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addPair}
        className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-medium"
      >
        <Plus className="w-4 h-4" /> Add
      </button>
    </div>
  )
}
