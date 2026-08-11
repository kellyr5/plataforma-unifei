import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import api, { getAccessToken, getRefreshToken, clearTokens } from '../services/api'

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
  logout: () => Promise<void>
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

  /**
   * Encerra a sessão avisando o backend, para que o refresh token entre na
   * lista de invalidados. Se a chamada falhar, os tokens locais são apagados
   * mesmo assim: o usuário pediu para sair e precisa sair.
   */
  async function logout() {
    const refresh = getRefreshToken()

    try {
      if (refresh) await api.post('/auth/logout/', { refresh })
    } catch {
      // Sessão já expirada ou servidor fora do ar: segue com a limpeza local.
    } finally {
      clearTokens()
      setUser(null)
    }
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
