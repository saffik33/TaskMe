import { useState, useMemo } from 'react'
import { useAgentAdmin } from '../../context/AgentAdminContext'

const VENDOR_COLORS = {
  Anthropic: 'bg-purple-100 text-purple-700',
  OpenAI: 'bg-green-100 text-green-700',
}

function VendorBadge({ vendor }) {
  const color = VENDOR_COLORS[vendor] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {vendor}
    </span>
  )
}

function CapabilityBadge({ label }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      {label}
    </span>
  )
}

function formatTokens(n) {
  if (!n && n !== 0) return '--'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`
  return String(n)
}

function formatPrice(price) {
  if (!price && price !== 0) return '--'
  return `$${Number(price).toFixed(2)}`
}

export default function ModelCatalog() {
  const { models } = useAgentAdmin()
  const [vendorFilter, setVendorFilter] = useState('All')

  const vendors = useMemo(() => {
    const set = new Set(models.map((m) => m.vendor))
    return ['All', ...Array.from(set).sort()]
  }, [models])

  const filtered = useMemo(() => {
    if (vendorFilter === 'All') return models
    return models.filter((m) => m.vendor === vendorFilter)
  }, [models, vendorFilter])

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600">Vendor:</label>
        <select
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        >
          {vendors.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((model) => (
          <div
            key={model.model_id}
            className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-3"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900 leading-tight">
                {model.display_name || model.name}
              </h3>
              <VendorBadge vendor={model.vendor} />
            </div>

            {/* Token Info */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-400">Context Window</p>
                <p className="font-medium text-gray-700">{formatTokens(model.context_window)}</p>
              </div>
              <div>
                <p className="text-gray-400">Max Output</p>
                <p className="font-medium text-gray-700">{formatTokens(model.max_output_tokens)}</p>
              </div>
            </div>

            {/* Pricing */}
            {(model.input_price_per_1m || model.output_price_per_1m) && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-400">Input / 1M</p>
                  <p className="font-medium text-gray-700">{formatPrice(model.input_price_per_1m)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Output / 1M</p>
                  <p className="font-medium text-gray-700">{formatPrice(model.output_price_per_1m)}</p>
                </div>
              </div>
            )}

            {/* Capabilities */}
            <div className="flex flex-wrap gap-1.5">
              {model.tool_use && <CapabilityBadge label="Tool Use" />}
              {model.vision && <CapabilityBadge label="Vision" />}
              {model.thinking_support && <CapabilityBadge label="Thinking" />}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">No models found</div>
      )}
    </div>
  )
}
