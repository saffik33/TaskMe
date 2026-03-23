import { Bot, LogOut, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout({ children }) {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src="/taskme-header.png" alt="TaskMe" className="h-12" />
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <>
                  <Link to="/admin/agents" className="text-gray-500 hover:text-purple-600 transition-colors" title="Agent Management">
                    <Bot className="w-5 h-5" />
                  </Link>
                  <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <User className="w-4 h-4" />
                    <span className="hidden sm:inline font-medium">{user.username}</span>
                  </div>
                  <button
                    onClick={logout}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  )
}
