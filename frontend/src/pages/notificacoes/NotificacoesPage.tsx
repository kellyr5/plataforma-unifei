/**
 * NotificaçõesPage — Lista de notificacoes do usuario.
 *
 * Funcionalidades:
 * - Lista todas as notificacoes (lidas e nao lidas)
 * - Marcar individual como lida
 * - Marcar todas como lidas
 * - Icone e cor por tipo de notificacao
 * - Tempo relativo
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast, { Toaster } from 'react-hot-toast'
import { useNotificacoes } from '../../contexts/NotificacoesContext'

interface Notificacao {
  id: string
  titulo: string
  mensagem: string
  tipo: string
  lida: boolean
  created_at: string
  objeto_tipo: string | null
  objeto_id: string | null
}

/**
 * Para onde a notificação leva.
 *
 * O destino é decidido pelo objeto relacionado, e não pelo tipo do aviso:
 * vários tipos diferentes apontam para a mesma publicação, e o dia em que
 * surgir um tipo novo ele já chega com o caminho certo. Sem objeto conhecido,
 * a notificação continua clicável apenas para marcar leitura.
 */
function destino(notif: Notificacao): string | null {
  if (!notif.objeto_id) return null

  switch (notif.objeto_tipo) {
    case 'post':
      return `/forum/${notif.objeto_id}`
    case 'conversa':
      return `/conversas/${notif.objeto_id}`
    case 'oportunidade':
      return `/voluntariado/${notif.objeto_id}`
    case 'disciplina':
      return `/forum?disciplina=${notif.objeto_id}`
    default:
      return null
  }
}

/**
 * Ícone por tipo de notificação.
 *
 * Sem cor por categoria, de propósito. A cor era usada para classificar o
 * aviso em bom, atenção e ruim, o que não corresponde ao que uma notificação
 * é: informação sobre algo que aconteceu. Uma denúncia resolvida não é uma
 * boa notícia nem uma má, e pintá-la de verde ou vermelho induz uma leitura
 * que o sistema não tem como sustentar. O que distingue os itens agora é o
 * ícone, e o que marca urgência é apenas a condição de não lida.
 */
const tipoConfig: Record<string, { cor: string; icon: React.ReactNode }> = {
  nova_resposta: {
    cor: 'var(--accent-blue)',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>,
  },
  voto_recebido: {
    cor: 'var(--accent-blue)',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>,
  },
  melhor_resposta: {
    cor: 'var(--accent-blue)',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  reacao_persiste: {
    cor: 'var(--accent-blue)',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>,
  },
  denuncia_resolvida: {
    cor: 'var(--accent-blue)',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" /></svg>,
  },
  inscricao_aprovada: {
    cor: 'var(--accent-blue)',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>,
  },
  inscricao_rejeitada: {
    cor: 'var(--accent-blue)',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  },
  voluntariado_concluido: {
    cor: 'var(--accent-blue)',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.54 0" /></svg>,
  },
  mensagem_grupo: {
    cor: 'var(--accent-blue)',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>,
  },
  ajuda_solicitada: {
    cor: 'var(--accent-blue)',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>,
  },
  ajuda_respondida: {
    cor: 'var(--accent-blue)',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  grupo_formado: {
    cor: 'var(--accent-blue)',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  },
  post_restrito: {
    cor: 'var(--accent-blue)',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>,
  },
  papel_disciplina: {
    cor: 'var(--accent-blue)',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342" /></svg>,
  },
}

const defaultConfig = {
  cor: 'var(--text-secondary)',
  icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>,
}

function tempoRelativo(valor: string): string {
  const minutos = Math.floor((Date.now() - new Date(valor).getTime()) / 60000)

  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} h`

  return new Date(valor).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Rótulo do dia, usado para agrupar a lista.
 *
 * A caixa de notificações é lida de cima para baixo procurando "o que mudou
 * desde ontem". Sem a separação por dia, vinte avisos formam um bloco único e
 * a pessoa precisa comparar horários item a item para descobrir onde parou.
 */
function diaDe(valor: string): string {
  const data = new Date(valor)
  const hoje = new Date()

  if (data.toDateString() === hoje.toDateString()) return 'Hoje'

  const ontem = new Date(hoje)
  ontem.setDate(ontem.getDate() - 1)
  if (data.toDateString() === ontem.toDateString()) return 'Ontem'

  return data.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: data.getFullYear() === hoje.getFullYear() ? undefined : 'numeric',
  })
}

function NotifCard({ notif, onMarcarLida, onExcluir }: {
  notif: Notificacao
  onMarcarLida: (id: string) => void
  onExcluir: (id: string) => void
}) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const config = tipoConfig[notif.tipo] || defaultConfig
  const caminho = destino(notif)

  /* Abrir e marcar como lida são a mesma ação do ponto de vista de quem
     clica: a pessoa foi ver do que se tratava. Exigir os dois gestos deixaria
     a caixa cheia de avisos já resolvidos. */
  function abrir() {
    if (!notif.lida) onMarcarLida(notif.id)
    if (caminho) navigate(caminho)
  }

  return (
    /* Linha de lista, não cartão solto.
       Cada aviso era um bloco com fundo tingido, borda própria e um ponto à
       direita — três marcas dizendo a mesma coisa, "não lida". Com a caixa
       toda por ler, a tela virava uma mancha azul uniforme e nada se
       destacava. Agora o que distingue o não lido é uma barra fina à
       esquerda, e o lido apenas esmaece. */
    <div
      className="flex items-start cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={abrir}
      style={{
        padding: '13px 18px 13px 15px', gap: '13px',
        borderBottom: '1px solid var(--border)',
        borderLeft: `3px solid ${notif.lida ? 'transparent' : 'var(--accent-blue)'}`,
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        opacity: notif.lida ? 0.62 : 1,
        transition: 'background 0.15s ease',
      }}
    >
      {/* Icone */}
      <div className="flex items-center justify-center rounded-lg flex-shrink-0"
        style={{
          width: '30px', height: '30px', marginTop: '1px',
          background: 'var(--accent-blue-soft)', color: 'var(--accent-blue-text)',
        }}>
        {config.icon}
      </div>

      {/* Conteudo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between" style={{ gap: '12px' }}>
          <div>
            <div
              style={{
                fontSize: '13.5px', color: 'var(--text-primary)', marginBottom: '2px',
                fontWeight: notif.lida ? 400 : 600,
              }}
            >
              {notif.titulo}
            </div>
            {notif.mensagem && (
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {notif.mensagem}
              </div>
            )}
          </div>
          <span className="flex-shrink-0" style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            {tempoRelativo(notif.created_at)}
          </span>
        </div>
      </div>

      {/* Excluir — aparece no hover para não poluir a lista */}
      <button
        onClick={(e) => { e.stopPropagation(); onExcluir(notif.id) }}
        aria-label="Excluir notificação"
        className="flex-shrink-0 cursor-pointer"
        style={{
          background: 'none', border: 'none', padding: '2px',
          color: 'var(--text-tertiary)',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default function NotificaçõesPage() {
  const [notificacoes, setNotificações] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todas' | 'nao_lidas' | 'lidas'>('todas')

  // O badge do sino vive no contexto do WebSocket. Como a marcação de leitura
  // acontece pela API REST, avisamos o contexto para ele recontar.
  const { ultimas, atualizarContador } = useNotificacoes()

  async function fetchNotificações() {
    try {
      const res = await api.get('/notificacoes/', { params: { ordering: '-created_at' } })
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      setNotificações(data)
    } catch (err) {
      console.error('Erro ao carregar notificacoes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchNotificações() }, [])

  // Notificação que chega pelo WebSocket entra na lista sem recarregar a tela.
  useEffect(() => {
    if (ultimas.length > 0) fetchNotificações()
  }, [ultimas.length])

  async function marcarLida(id: string) {
    try {
      await api.post(`/notificacoes/${id}/marcar-lida/`)
      setNotificações(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n))
      atualizarContador()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao marcar como lida')
    }
  }

  async function marcarTodasLidas() {
    try {
      await api.post('/notificacoes/marcar-todas-lidas/')
      setNotificações(prev => prev.map(n => ({ ...n, lida: true })))
      atualizarContador()
      toast.success('Todas as notificações marcadas como lidas')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro')
    }
  }

  async function excluir(id: string) {
    try {
      await api.delete(`/notificacoes/${id}/`)
      setNotificações(prev => prev.filter(n => n.id !== id))
      atualizarContador()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao excluir a notificação')
    }
  }

  /* Remove apenas as já lidas. É o caso comum de arrumar a caixa sem correr
     o risco de perder algo que ainda não foi visto. */
  async function limparLidas() {
    try {
      const { data } = await api.post('/notificacoes/limpar/')
      setNotificações(prev => prev.filter(n => !n.lida))
      atualizarContador()
      toast.success(data.detail || 'Notificações lidas removidas')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao limpar')
    }
  }

  const naoLidas = notificacoes.filter(n => !n.lida).length
  const filtered = filtro === 'todas' ? notificacoes
    : filtro === 'nao_lidas' ? notificacoes.filter(n => !n.lida)
    : notificacoes.filter(n => n.lida)

  return (
    <div style={{ maxWidth: '700px' }}>
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="font-bold tracking-tight" style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Notificações
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            {naoLidas > 0
              ? `${naoLidas} não ${naoLidas === 1 ? 'lida' : 'lidas'}`
              : 'Tudo lido'}
          </p>
        </div>

        <div className="flex items-center" style={{ gap: '8px' }}>
        {notificacoes.length - naoLidas > 0 && (
          <button
            onClick={limparLidas}
            className="flex items-center rounded-xl font-medium cursor-pointer transition-all duration-200"
            style={{
              padding: '8px 16px', gap: '6px', fontSize: '13px',
              background: 'var(--bg-input)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Limpar lidas
          </button>
        )}

        {naoLidas > 0 && (
          <button
            onClick={marcarTodasLidas}
            className="flex items-center rounded-xl font-medium cursor-pointer transition-all duration-200"
            style={{
              padding: '8px 16px', gap: '6px', fontSize: '13px',
              background: 'var(--bg-input)', color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Marcar todas como lidas
          </button>
        )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center" style={{ gap: '6px', marginBottom: '20px' }}>
        {[
          { value: 'todas' as const, label: 'Todas', count: notificacoes.length },
          { value: 'nao_lidas' as const, label: 'Não lidas', count: naoLidas },
          { value: 'lidas' as const, label: 'Lidas', count: notificacoes.length - naoLidas },
        ].map(f => (
          <button key={f.value} onClick={() => setFiltro(f.value)}
            className="flex items-center rounded-lg font-medium cursor-pointer transition-all duration-150"
            style={{
              padding: '8px 14px', gap: '6px', fontSize: '13px',
              background: filtro === f.value ? 'var(--accent-blue)' : 'var(--bg-input)',
              color: filtro === f.value ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${filtro === f.value ? 'var(--accent-blue)' : 'var(--border)'}`,
            }}>
            {f.label}
            <span style={{
              padding: '0 6px', borderRadius: '10px', fontSize: '11px',
              background: filtro === f.value ? 'rgba(255,255,255,0.2)' : 'var(--bg-hover)',
            }}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ height: '200px' }}>
          <div className="flex items-center" style={{ gap: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Carregando notificações...
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl text-center" style={{ padding: '48px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Nenhuma notificação
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            {filtro === 'nao_lidas' ? 'Você leu todas as notificações.' : 'Você ainda não recebeu notificações.'}
          </p>
        </div>
      ) : (
        /* Um contêiner só, com as linhas separadas por divisória e agrupadas
           por dia. Antes eram cartões independentes com espaço entre si, o que
           multiplicava as bordas e fazia a lista ocupar quase o dobro da altura
           para a mesma informação. */
        <div className="rounded-xl" style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          {filtered.map((n, indice) => {
            const dia = diaDe(n.created_at)
            const abreGrupo = indice === 0 || diaDe(filtered[indice - 1].created_at) !== dia

            return (
              <div key={n.id}>
                {abreGrupo && (
                  <div style={{
                    padding: '10px 18px 8px',
                    background: 'var(--bg-input)',
                    borderBottom: '1px solid var(--border)',
                    borderTop: indice === 0 ? 'none' : '1px solid var(--border)',
                    fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--text-tertiary)',
                  }}>
                    {dia}
                  </div>
                )}
                <NotifCard notif={n} onMarcarLida={marcarLida} onExcluir={excluir} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
