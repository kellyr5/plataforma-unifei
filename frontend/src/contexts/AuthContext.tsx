import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import api, { getAccessToken, clearTokens } from '../services/api'

interface User {
  id: string
  cpf: string
  nome_completo: string
  email: string
  is_admin: boolean
  bio: string
  reputacao: number
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  logout: () => void
  fetchMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchMe() {
    try {
      const { data } = await api.get('/auth/me/')
      setUser(data)
    } catch {
      clearTokens()
      setUser(null)
    }
  }

  useEffect(() => {
    async function checkAuth() {
      const token = getAccessToken()
      if (!token) {
        setLoading(false)
        return
      }
      await fetchMe()
      setLoading(false)
    }
    checkAuth()
  }, [])

  function logout() {
    clearTokens()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user, loading, isAuthenticated: !!user,
      setUser, logout, fetchMe,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
