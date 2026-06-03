/**
 * NotificacoesPage — Lista de notificacoes do usuario.
 *
 * Funcionalidades:
 * - Lista todas as notificacoes (lidas e nao lidas)
 * - Marcar individual como lida
 * - Marcar todas como lidas
 * - Icone e cor por tipo de notificacao
 * - Tempo relativo
 */

import { useState, useEffect } from 'react'
import api from '../../services/api'
import toast, { Toaster } from 'react-hot-toast'

interface Notificacao {
  id: string
  titulo: string
  mensagem: string
  tipo: string
  lida: boolean
  created_at: string
}

const tipoConfig: Record<string, { cor: string; icon: React.ReactNode }> = {
  nova_resposta: {
    cor: '#003087',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>,
  },
  voto_recebido: {
    cor: '#10B981',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>,
  },
  melhor_resposta: {
    cor: '#10B981',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  reacao_persiste: {
    cor: '#F59E0B',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>,
  },
  denuncia_resolvida: {
    cor: '#8B5CF6',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" /></svg>,
  },
  inscricao_aprovada: {
    cor: '#10B981',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>,
  },
  inscricao_rejeitada: {
    cor: '#EF4444',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  },
  voluntariado_concluido: {
    cor: '#003087',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.54 0" /></svg>,
  },
}

const defaultConfig = {
  cor: '#6B7280',
  icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>,
}

function tempoRelativo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `ha ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `ha ${h}h`
  const d = Math.floor(h / 24)
  return d < 30 ? `ha ${d}d` : `ha ${Math.floor(d / 30)} mes(es)`
}

function NotifCard({ notif, onMarcarLida }: { notif: Notificacao; onMarcarLida: (id: string) => void }) {
  const [hovered, setHovered] = useState(false)
  const config = tipoConfig[notif.tipo] || defaultConfig

  return (
    <div
      className="flex items-start rounded-xl cursor-pointer transition-all duration-200"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !notif.lida && onMarcarLida(notif.id)}
      style={{
        padding: '16px 20px', gap: '14px',
        background: notif.lida ? 'var(--bg-card)' : `${config.cor}04`,
        border: `1px solid ${hovered ? config.cor + '30' : 'var(--border)'}`,
        opacity: notif.lida ? 0.6 : 1,
      }}
    >
      {/* Icone */}
      <div className="flex items-center justify-center rounded-lg flex-shrink-0"
        style={{ width: '36px', height: '36px', background: `${config.cor}10`, color: config.cor }}>
        {config.icon}
      </div>

      {/* Conteudo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between" style={{ gap: '12px' }}>
          <div>
            <div className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '3px' }}>
              {notif.titulo}
            </div>
            {notif.mensagem && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {notif.mensagem}
              </div>
            )}
          </div>
          <span className="flex-shrink-0" style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            {tempoRelativo(notif.created_at)}
          </span>
        </div>
      </div>

      {/* Indicador nao lida */}
      {!notif.lida && (
        <div className="flex-shrink-0" style={{ marginTop: '6px' }}>
          <div className="rounded-full" style={{ width: '8px', height: '8px', background: config.cor }} />
        </div>
      )}
    </div>
  )
}

export default function NotificacoesPage() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todas' | 'nao_lidas' | 'lidas'>('todas')

  async function fetchNotificacoes() {
    try {
      const res = await api.get('/notificacoes/', { params: { ordering: '-created_at' } })
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      setNotificacoes(data)
    } catch (err) {
      console.error('Erro ao carregar notificacoes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchNotificacoes() }, [])

  async function marcarLida(id: string) {
    try {
      await api.post(`/notificacoes/${id}/marcar-lida/`)
      setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n))
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao marcar como lida')
    }
  }

  async function marcarTodasLidas() {
    try {
      await api.post('/notificacoes/marcar-todas-lidas/')
      setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })))
      toast.success('Todas as notificacoes marcadas como lidas')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro')
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
            Notificacoes
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            {naoLidas > 0 ? `${naoLidas} nao lida(s)` : 'Tudo lido'}
          </p>
        </div>

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

      {/* Filtros */}
      <div className="flex items-center" style={{ gap: '6px', marginBottom: '20px' }}>
        {[
          { value: 'todas' as const, label: 'Todas', count: notificacoes.length },
          { value: 'nao_lidas' as const, label: 'Nao lidas', count: naoLidas },
          { value: 'lidas' as const, label: 'Lidas', count: notificacoes.length - naoLidas },
        ].map(f => (
          <button key={f.value} onClick={() => setFiltro(f.value)}
            className="flex items-center rounded-lg font-medium cursor-pointer transition-all duration-150"
            style={{
              padding: '8px 14px', gap: '6px', fontSize: '13px',
              background: filtro === f.value ? '#003087' : 'var(--bg-input)',
              color: filtro === f.value ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${filtro === f.value ? '#003087' : 'var(--border)'}`,
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
            Carregando notificacoes...
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl text-center" style={{ padding: '48px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Nenhuma notificacao
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            {filtro === 'nao_lidas' ? 'Voce leu todas as notificacoes.' : 'Voce ainda nao recebeu notificacoes.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(n => <NotifCard key={n.id} notif={n} onMarcarLida={marcarLida} />)}
        </div>
      )}
    </div>
  )
}
