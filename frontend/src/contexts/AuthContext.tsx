import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import api, { getAccessToken, getRefreshToken, clearTokens } from '../services/api'

interface PapelDisciplina {
  disciplina_id: string
  disciplina_codigo: string
  disciplina_nome: string
  papel: 'aluno' | 'monitor' | 'professor'
}

interface User {
  id: string
  cpf: string
  nome_completo: string
  email: string
  is_admin: boolean
  bio: string
  avatar_url: string

  papeis_globais: string[]
  papeis_disciplina: PapelDisciplina[]

  /* Atalhos calculados no backend, usados para decidir o que a interface
     exibe. A permissão de verdade continua sendo verificada a cada
     requisição; isto aqui evita mostrar um caminho que levaria a um erro. */
  e_coordenacao: boolean
  e_monitor: boolean
  e_professor: boolean
  e_organizacao: boolean
  pode_moderar: boolean

  /* Nome do perfil já flexionado pelo backend, como "Coordenadora" ou
     "Professor". Vem pronto para que a interface não precise conhecer as
     regras de concordância. */
  rotulo_perfil: string
  genero: 'f' | 'm' | 'n'
  matricula: string

  /* Curso e período são derivados das disciplinas em que a pessoa está
     matriculada, e não de campos do cadastro: matrícula muda a cada semestre,
     e um dado copiado fica velho no dia seguinte. */
  curso_nome: string
  curso_codigo: string
  periodo_atual: number | null

  /* Preenchidos apenas para a organização parceira, e usados na assinatura
     do certificado que ela emite. */
  nome_responsavel?: string
  cargo_responsavel?: string
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
