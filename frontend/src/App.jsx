import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import { ColumnProvider } from './context/ColumnContext'
import { TaskProvider } from './context/TaskContext'
import { AgentProvider } from './context/AgentContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import LoginPage from './pages/LoginPage'
import SharedView from './pages/SharedView'
import AgentAdminPage from './pages/AgentAdminPage'
import { AgentAdminProvider } from './context/AgentAdminContext'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { fontSize: '14px' },
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <WorkspaceProvider>
                  <ColumnProvider>
                    <TaskProvider>
                      <AgentProvider>
                        <Layout>
                          <Dashboard />
                        </Layout>
                      </AgentProvider>
                    </TaskProvider>
                  </ColumnProvider>
                </WorkspaceProvider>
              </ProtectedRoute>
            }
          />
          <Route path="/shared/:token" element={<SharedView />} />
          <Route
            path="/admin/agents"
            element={
              <ProtectedRoute>
                <WorkspaceProvider>
                  <AgentAdminProvider>
                    <Layout><AgentAdminPage /></Layout>
                  </AgentAdminProvider>
                </WorkspaceProvider>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
