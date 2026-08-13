import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { NotificacoesProvider } from './contexts/NotificacoesContext'
import { AppLayout } from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import PainelCoordenacao from './pages/coordenacao/PainelCoordenacao'
import DisciplinaCoordenacao from './pages/coordenacao/DisciplinaCoordenacao'
import PainelDocente from './pages/docente/PainelDocente'
import PainelOrganizacao from './pages/organizacao/PainelOrganizacao'
import NovaOportunidade from './pages/organizacao/NovaOportunidade'
import ParticipantesOportunidade from './pages/organizacao/ParticipantesOportunidade'
import ForumPage from './pages/forum/ForumPage'
import TopicPage from './pages/forum/TopicPage'
import NovoTopicoPage from './pages/forum/NovoTopicoPage'
import VoluntariadoPage from './pages/voluntariado/VoluntariadoPage'
import OportunidadePage from './pages/voluntariado/OportunidadePage'
import NotificacoesPage from './pages/notificacoes/NotificacoesPage'
import ModeracaoPage from './pages/moderacao/ModeracaoPage'
import PerfilPage from './pages/perfil/PerfilPage'
import AndamentoPage from './pages/andamento/AndamentoPage'
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

/**
 * A página inicial muda conforme o papel de quem entra. Quem coordena precisa
 * do curso inteiro; quem estuda precisa do próprio percurso. Mantemos a mesma
 * rota para que todo link para /dashboard continue funcionando e ninguém
 * precise saber qual é a home de cada perfil.
 */
function PaginaInicial() {
  const { user } = useAuth()

  if (user?.e_coordenacao) return <PainelCoordenacao />

  /* O professor abre no que precisa de resposta. O monitor não: ele é
     estudante em primeiro lugar, e a monitoria tem aba própria. */
  if (user?.e_professor) return <PainelDocente />

  /* A organização não participa do fórum: publica vagas, avalia inscrições
     e emite certificados. O painel de estudante não diria nada a ela. */
  if (user?.e_organizacao) return <PainelOrganizacao />

  return <DashboardPage />
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
              <Route path="/dashboard" element={<PaginaInicial />} />
              <Route path="/forum" element={<ForumPage />} />
              {/* A rota de criação vem antes da rota com parâmetro, senão
                  "novo" seria interpretado como identificador de tópico. */}
              <Route path="/forum/novo" element={<NovoTopicoPage />} />
              <Route path="/forum/:id" element={<TopicPage />} />
              <Route path="/voluntariado" element={<VoluntariadoPage />} />
              <Route path="/voluntariado/:id" element={<OportunidadePage />} />
              <Route path="/notificacoes" element={<NotificacoesPage />} />
              <Route path="/moderacao" element={<ModeracaoPage />} />
              <Route
                path="/coordenacao/disciplina/:id"
                element={<DisciplinaCoordenacao />}
              />

              {/* A rota de criação vem antes da que tem parâmetro, senão
                  "nova-oportunidade" seria lido como identificador. */}
              <Route path="/organizacao/nova-oportunidade" element={<NovaOportunidade />} />
              <Route path="/organizacao/oportunidade/:id/editar" element={<NovaOportunidade />} />
              <Route path="/organizacao/oportunidade/:id" element={<ParticipantesOportunidade />} />
              <Route path="/perfil" element={<PerfilPage />} />
              <Route path="/andamento" element={<AndamentoPage />} />
              <Route path="/monitoria" element={<PainelDocente papel="monitor" />} />
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
