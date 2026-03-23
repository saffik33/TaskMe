import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import * as api from '../api/agentAdmin'

const AgentAdminContext = createContext(null)

export function AgentAdminProvider({ children }) {
  const [agents, setAgents] = useState([])
  const [mcpServers, setMcpServers] = useState([])
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)

  const loadAgents = useCallback(async () => {
    try {
      const { data } = await api.listAgents()
      setAgents(data)
    } catch (err) {
      // silently fail — service may be unavailable
    }
  }, [])

  const loadMcpServers = useCallback(async () => {
    try {
      const { data } = await api.listMcpServers()
      setMcpServers(data)
    } catch { /* ignore */ }
  }, [])

  const loadModels = useCallback(async () => {
    try {
      const { data } = await api.listModels()
      setModels(data)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    Promise.all([loadAgents(), loadMcpServers(), loadModels()]).finally(() => setLoading(false))
  }, [loadAgents, loadMcpServers, loadModels])

  const createAgent = async (data) => {
    const { data: agent } = await api.createAgent(data)
    setAgents(prev => [...prev, agent])
    toast.success(`Agent "${agent.name}" created`)
    return agent
  }

  const updateAgent = async (id, data) => {
    const { data: agent } = await api.updateAgent(id, data)
    setAgents(prev => prev.map(a => a.agent_id === id ? agent : a))
    toast.success(`Agent "${agent.name}" updated`)
    return agent
  }

  const deleteAgent = async (id) => {
    await api.deleteAgent(id)
    setAgents(prev => prev.filter(a => a.agent_id !== id))
    toast.success('Agent deleted')
  }

  const createMcpServer = async (data) => {
    const { data: server } = await api.createMcpServer(data)
    setMcpServers(prev => [...prev, server])
    toast.success(`MCP server "${server.name}" created`)
    return server
  }

  const updateMcpServer = async (id, data) => {
    const { data: server } = await api.updateMcpServer(id, data)
    setMcpServers(prev => prev.map(s => s.mcp_server_id === id ? server : s))
    toast.success(`MCP server "${server.name}" updated`)
    return server
  }

  const deleteMcpServer = async (id) => {
    await api.deleteMcpServer(id)
    setMcpServers(prev => prev.filter(s => s.mcp_server_id !== id))
    toast.success('MCP server deleted')
  }

  return (
    <AgentAdminContext.Provider value={{
      agents, mcpServers, models, loading,
      loadAgents, loadMcpServers,
      createAgent, updateAgent, deleteAgent,
      createMcpServer, updateMcpServer, deleteMcpServer,
    }}>
      {children}
    </AgentAdminContext.Provider>
  )
}

export function useAgentAdmin() {
  const ctx = useContext(AgentAdminContext)
  if (!ctx) throw new Error('useAgentAdmin must be used within AgentAdminProvider')
  return ctx
}
