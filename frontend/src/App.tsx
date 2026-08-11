import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { NotificacoesProvider } from './contexts/NotificacoesContext'
import { AppLayout } from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import ForumPage from './pages/forum/ForumPage'
import TopicPage from './pages/forum/TopicPage'
import VoluntariadoPage from './pages/voluntariado/VoluntariadoPage'
import OportunidadePage from './pages/voluntariado/OportunidadePage'
import NotificacoesPage from './pages/notificacoes/NotificacoesPage'
import ModeracaoPage from './pages/moderacao/ModeracaoPage'
import PerfilPage from './pages/perfil/PerfilPage'
import RankingPage from './pages/ranking/RankingPage'
import CertificadosPage from './pages/certificados/CertificadosPage'

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

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <NotificacoesProvider>
          <Routes>
            {/* Rota publica */}
            <Route path="/" element={<LoginPage />} />

            {/* Rotas protegidas (com layout compartilhado) */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/forum" element={<ForumPage />} />
              <Route path="/forum/:id" element={<TopicPage />} />
              <Route path="/voluntariado" element={<VoluntariadoPage />} />
              <Route path="/voluntariado/:id" element={<OportunidadePage />} />
              <Route path="/notificacoes" element={<NotificacoesPage />} />
              <Route path="/moderacao" element={<ModeracaoPage />} />
              <Route path="/perfil" element={<PerfilPage />} />
              <Route path="/ranking" element={<RankingPage />} />
              <Route path="/certificados" element={<CertificadosPage />} />
              {/* Proximas telas virao aqui */}
            </Route>
          </Routes>
          </NotificacoesProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
