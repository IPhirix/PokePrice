import { createContext, useContext, useState, useEffect } from 'react'
import { clearTcgCache } from '../pages/CardDetail'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [isSetup, setIsSetup] = useState(null)       // null = loading
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    async function check() {
      const setup = await window.api.auth.isSetup()
      if (!setup) { setIsSetup(false); return }
      setIsSetup(true)
      const valid = await window.api.auth.isSessionValid()
      setIsAuthenticated(valid)
    }
    check()
  }, [])

  async function login(username, password) {
    const result = await window.api.auth.login({ username, password })
    if (result.ok) setIsAuthenticated(true)
    return result
  }

  async function createAccount(data) {
    const result = await window.api.auth.createUser(data)
    if (result.ok) { setIsSetup(true); setIsAuthenticated(true) }
    return result
  }

  async function logout() {
    await window.api.auth.logout()
    clearTcgCache()
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ isSetup, isAuthenticated, login, createAccount, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
