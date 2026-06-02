/**
 * Contexto de autenticacao.
 *
 * Gerencia o estado do usuario logado, verifica se o token
 * e valido ao carregar a pagina, e expoe funcoes de login/logout.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import api, { getAccessToken, clearTokens } from '../services/api'

interface User {
  id: string
  cpf: string
  nome_completo: string
  email: string
  is_admin: boolean
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  /* Ao carregar, verifica se tem token valido */
  useEffect(() => {
    async function checkAuth() {
      const token = getAccessToken()
      if (!token) {
        setLoading(false)
        return
      }

      try {
        /* Tenta buscar dados do usuario autenticado */
        const { data } = await api.post('/auth/verify/', { token })
        /* Se o verify retorna 200, o token e valido */
        /* Por ora, decodificamos o payload do JWT pra pegar dados basicos */
        const payload = JSON.parse(atob(token.split('.')[1]))
        setUser({
          id: payload.user_id,
          cpf: '',
          nome_completo: '',
          email: '',
          is_admin: false,
        })
      } catch {
        clearTokens()
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  function logout() {
    clearTokens()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user,
      setUser,
      logout,
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
