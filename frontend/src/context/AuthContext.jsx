import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { login as apiLogin, register as apiRegister, getMe, resendVerification as apiResend } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // One-time migration: localStorage → sessionStorage
    if (!sessionStorage.getItem('token') && localStorage.getItem('token')) {
      sessionStorage.setItem('token', localStorage.getItem('token'))
      localStorage.removeItem('token')
    }
    const token = sessionStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    getMe()
      .then((res) => setUser(res.data))
      .catch(() => {
        sessionStorage.removeItem('token')
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (username, password) => {
    const res = await apiLogin(username, password)
    sessionStorage.setItem('token', res.data.access_token)
    setUser(res.data.user)
    return res.data
  }, [])

  const register = useCallback(async (username, email, password) => {
    const res = await apiRegister(username, email, password)
    // Don't auto-login — user needs to verify email first
    return res.data
  }, [])

  const resendVerification = useCallback(async (email) => {
    const res = await apiResend(email)
    return res.data
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem('token')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, resendVerification, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
