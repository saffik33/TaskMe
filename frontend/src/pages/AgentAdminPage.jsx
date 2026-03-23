import { useState } from 'react'
import { useAgentAdmin } from '../context/AgentAdminContext'
import AgentList from '../components/admin/AgentList'
import McpServerList from '../components/admin/McpServerList'
import ModelCatalog from '../components/admin/ModelCatalog'
import SessionList from '../components/admin/SessionList'

const TABS = ['Agents', 'MCP Servers', 'Sessions', 'Models']

export default function AgentAdminPage() {
  const [activeTab, setActiveTab] = useState('Agents')
  const { loading } = useAgentAdmin()

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Agent Management</h1>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-purple-600 text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'Agents' && <AgentList />}
      {activeTab === 'MCP Servers' && <McpServerList />}
      {activeTab === 'Sessions' && <SessionList />}
      {activeTab === 'Models' && <ModelCatalog />}
    </div>
  )
}
