import { useState, useEffect } from 'react'
import { X, Copy, Check, Link } from 'lucide-react'
import { createShareLink } from '../api/tasks'
import toast from 'react-hot-toast'

export default function ShareDialog({ open, taskIds, onClose }) {
  const [shareUrl, setShareUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setShareUrl('')
      setCopied(false)
    }
  }, [open, taskIds])

  if (!open) return null

  const handleCreate = async () => {
    setLoading(true)
    try {
      const res = await createShareLink(taskIds)
      setShareUrl(res.data.url)
    } catch {
      toast.error('Failed to create share link')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
            <Link className="w-5 h-5 text-indigo-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Share Tasks</h3>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Create a shareable link for {taskIds.length} task(s). Anyone with the link can view these tasks.
        </p>

        {!shareUrl ? (
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Share Link'}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={shareUrl}
              readOnly
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
            />
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
