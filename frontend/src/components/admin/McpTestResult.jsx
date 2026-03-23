import { X, CheckCircle, XCircle } from 'lucide-react'

export default function McpTestResult({ result, onClose }) {
  if (!result) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Connection Test Result</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            {result.connected ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                  Connected
                </span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="text-sm font-medium text-red-700 bg-red-50 px-2.5 py-1 rounded-full">
                  Failed
                </span>
              </>
            )}
          </div>

          {/* Error message */}
          {result.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{result.error}</p>
            </div>
          )}

          {/* Discovered tools */}
          {result.connected && result.tools && result.tools.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-2">
                Discovered Tools ({result.tools.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {result.tools.map((tool, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{tool.name}</p>
                    {tool.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.connected && (!result.tools || result.tools.length === 0) && (
            <p className="text-sm text-gray-500">No tools discovered on this server.</p>
          )}
        </div>

        <div className="flex justify-end px-5 py-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
