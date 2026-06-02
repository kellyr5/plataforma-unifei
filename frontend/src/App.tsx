import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/auth/LoginPage'

/**
 * Rota protegida: redireciona pro login se nao autenticado.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-main)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>
      </div>
    )
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />
}

/**
 * Pagina temporaria do dashboard (placeholder).
 */
function DashboardPlaceholder() {
  const { user, logout } = useAuth()
  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'var(--bg-main)', gap: '16px' }}>
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Bem-vindo a Plataforma UNIFEI
      </h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        Voce esta autenticado (ID: {user?.id?.substring(0, 8)}...)
      </p>
      <button
        onClick={logout}
        className="rounded-xl font-medium cursor-pointer transition-all duration-200"
        style={{ padding: '10px 24px', background: 'var(--accent-red)', color: 'white' }}
      >
        Sair
      </button>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardPlaceholder />
              </ProtectedRoute>
            } />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
