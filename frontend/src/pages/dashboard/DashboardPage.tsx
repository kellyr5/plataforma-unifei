/**
 * DashboardPage — Visao geral com dados reais da API.
 * Versao polida com hover effects, cores e dark mode.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../services/api'

interface Post {
  id: string
  titulo: string
  conteudo: string
  total_votos: number
  total_respostas: number
  e_melhor: boolean
  disciplina_codigo?: string
  disciplina_nome?: string
  autor_nome: string
  created_at: string
  post_pai: string | null
}

interface Oportunidade {
  id: string
  titulo: string
  area: string
  area_display: string
  local: string
  carga_horaria_total: number
  vagas: number
  vagas_disponiveis: number
}

interface Reputacao {
  disciplina_codigo: string
  disciplina_nome: string
  pontos: number
  total_respostas: number
  total_melhores_respostas: number
}

interface Notificacao {
  id: string
  titulo: string
  lida: boolean
  created_at: string
}

const areaCores: Record<string, string> = {
  educacao: '#10B981', saude: '#3B82F6', meio_ambiente: '#22C55E',
  assistencia_social: '#F59E0B', direitos_humanos: '#EC4899',
  cultura: '#8B5CF6', tecnologia: '#6366F1', esporte: '#EF4444', outro: '#6B7280',
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

/* ============================================================
   COMPONENTES INTERNOS DO DASHBOARD
   ============================================================ */

function StatCard({ label, value, subtitle, color, icon }: {
  label: string; value: string; subtitle: string; color: string; icon: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="rounded-xl cursor-default transition-all duration-200"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '20px',
        background: 'var(--bg-card)',
        border: `1px solid ${hovered ? color + '40' : 'var(--border)'}`,
        boxShadow: hovered ? `0 4px 12px ${color}15` : 'none',
        transition: 'all 0.2s ease',
      }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
        <div className="flex items-center justify-center rounded-lg"
          style={{ width: '36px', height: '36px', background: `${color}12`, color }}>
          {icon}
        </div>
      </div>
      <div className="font-bold" style={{ fontSize: '28px', color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      {subtitle && <div style={{ fontSize: '12px', color, marginTop: '8px' }}>{subtitle}</div>}
    </div>
  )
}

function PostCard({ post, onClick }: { post: Post; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="flex rounded-xl cursor-pointer transition-all duration-200"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '16px', gap: '16px',
        background: 'var(--bg-card)',
        border: `1px solid ${hovered ? '#003087' + '40' : 'var(--border)'}`,
        boxShadow: hovered ? '0 2px 8px rgba(0,48,135,0.06)' : 'none',
      }}
    >
      <div className="text-center flex-shrink-0" style={{ minWidth: '48px' }}>
        <div className="font-bold" style={{ fontSize: '20px', color: '#003087' }}>{post.total_votos || 0}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>votos</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px', lineHeight: 1.4 }}>
          {post.titulo || post.conteudo?.substring(0, 80)}
        </div>
        <div className="flex items-center flex-wrap" style={{ gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {post.disciplina_codigo && (
            <span className="rounded-md" style={{ padding: '3px 10px', background: 'rgba(0,48,135,0.06)', color: '#003087', fontSize: '11px', fontWeight: 500 }}>
              {post.disciplina_codigo}
            </span>
          )}
          {post.e_melhor && (
            <span className="rounded-md flex items-center" style={{ padding: '3px 10px', background: 'rgba(16,185,129,0.06)', color: '#10B981', fontSize: '11px', fontWeight: 500, gap: '4px' }}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              Resolvido
            </span>
          )}
          <span>{post.total_respostas || 0} respostas</span>
          <span>{tempoRelativo(post.created_at)}</span>
          <span style={{ color: 'var(--text-tertiary)' }}>por {post.autor_nome}</span>
        </div>
      </div>
    </div>
  )
}

function OpCard({ op }: { op: Oportunidade }) {
  const [hovered, setHovered] = useState(false)
  const cor = areaCores[op.area] || '#6B7280'
  const preenchidas = op.vagas - op.vagas_disponiveis
  const porcent = op.vagas > 0 ? (preenchidas / op.vagas) * 100 : 0

  return (
    <div
      className="rounded-xl cursor-pointer transition-all duration-200"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '20px',
        background: 'var(--bg-card)',
        border: `1px solid ${hovered ? cor + '40' : 'var(--border)'}`,
        boxShadow: hovered ? `0 2px 8px ${cor}10` : 'none',
      }}
    >
      <span className="rounded-md" style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 500, background: `${cor}12`, color: cor }}>
        {op.area_display}
      </span>
      <div className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '10px 0 8px', lineHeight: 1.4 }}>{op.titulo}</div>
      <div className="flex items-center" style={{ gap: '4px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
        {op.local}
      </div>
      <div className="flex items-center" style={{ gap: '4px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        {op.carga_horaria_total} horas
      </div>
      <div className="flex items-center" style={{ gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
        {preenchidas} de {op.vagas} vagas
      </div>
      <div className="rounded-full" style={{ height: '4px', background: 'var(--border)', marginTop: '12px' }}>
        <div className="rounded-full transition-all duration-500" style={{ height: '4px', background: cor, width: `${porcent}%` }} />
      </div>
    </div>
  )
}

function SectionHeader({ title, linkText, onClick }: { title: string; linkText: string; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: '14px' }}>
      <h2 className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{title}</h2>
      <button onClick={onClick} className="cursor-pointer font-medium transition-all duration-150"
        style={{ fontSize: '13px', color: '#003087' }}>{linkText}</button>
    </div>
  )
}

function RepCard({ rep }: { rep: Reputacao }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className="rounded-xl cursor-pointer transition-all duration-200"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        padding: '20px',
        background: 'var(--bg-card)',
        border: `1px solid ${hovered ? '#00308740' : 'var(--border)'}`,
        boxShadow: hovered ? '0 2px 8px rgba(0,48,135,0.06)' : 'none',
      }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
        <span className="rounded-md" style={{ padding: '3px 10px', fontSize: '12px', fontWeight: 500, background: 'rgba(0,48,135,0.06)', color: '#003087' }}>
          {rep.disciplina_codigo}
        </span>
      </div>
      <div className="font-bold" style={{ fontSize: '24px', color: '#003087', marginBottom: '4px' }}>{rep.pontos} pts</div>
      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
        {rep.total_respostas} respostas · {rep.total_melhores_respostas} melhores
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl text-center" style={{ padding: '40px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>{text}</p>
    </div>
  )
}

/* ============================================================
   PAGINA PRINCIPAL
   ============================================================ */
export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<Post[]>([])
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [reputacoes, setReputacoes] = useState<Reputacao[]>([])
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [naoLidas, setNaoLidas] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [postsRes, opsRes, repRes, notifRes, naoLidasRes] = await Promise.allSettled([
          api.get('/forum/posts/', { params: { ordering: '-created_at' } }),
          api.get('/voluntariado/oportunidades/', { params: { status: 'ativa', ordering: '-created_at' } }),
          api.get('/reputacao/minha/'),
          api.get('/notificacoes/', { params: { ordering: '-created_at' } }),
          api.get('/notificacoes/nao-lidas/'),
        ])

        if (postsRes.status === 'fulfilled') {
          const data = postsRes.value.data
          const lista = Array.isArray(data) ? data : data.results || []
          setPosts(lista.filter((p: Post) => !p.post_pai).slice(0, 5))
        }
        if (opsRes.status === 'fulfilled') {
          const data = opsRes.value.data
          setOportunidades((Array.isArray(data) ? data : data.results || []).slice(0, 4))
        }
        if (repRes.status === 'fulfilled') setReputacoes(Array.isArray(repRes.value.data) ? repRes.value.data : [])
        if (notifRes.status === 'fulfilled') {
          const data = notifRes.value.data
          setNotificacoes((Array.isArray(data) ? data : data.results || []).filter((n: Notificacao) => !n.lida).slice(0, 3))
        }
        if (naoLidasRes.status === 'fulfilled') setNaoLidas(naoLidasRes.value.data.total || naoLidasRes.value.data.count || 0)
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  const totalPontos = reputacoes.reduce((sum, r) => sum + r.pontos, 0)
  const totalRespostas = reputacoes.reduce((sum, r) => sum + r.total_respostas, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '60vh' }}>
        <div className="flex items-center" style={{ gap: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
          Carregando dados...
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px' }}>

      {/* Saudacao */}
      <div style={{ marginBottom: '28px' }}>
        <h1 className="font-bold tracking-tight" style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '6px' }}>
          Olá{user?.nome_completo ? `, ${user.nome_completo.split(' ')[0]}` : ''} 
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Aqui esta o resumo da sua atividade na plataforma.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4" style={{ gap: '14px', marginBottom: '28px' }}>
        <StatCard label="Reputacao total" value={totalPontos.toString()} subtitle={`${reputacoes.length} disciplina(s)`} color="#003087"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>} />
        <StatCard label="Respostas dadas" value={totalRespostas.toString()} subtitle="no forum" color="#10B981"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>} />
        <StatCard label="Notificacoes" value={naoLidas.toString()} subtitle={naoLidas > 0 ? 'nao lidas' : 'tudo lido'} color="#F59E0B"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>} />
        <StatCard label="Oportunidades" value={oportunidades.length.toString()} subtitle="de voluntariado" color="#C8102E"
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>} />
      </div>

      {/* Notificacoes */}
      {notificacoes.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <SectionHeader title="Notificacoes recentes" linkText="Ver todas" onClick={() => navigate('/notificacoes')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {notificacoes.map(n => (
              <div key={n.id} className="flex items-center rounded-xl transition-all duration-150 cursor-pointer"
                style={{ padding: '12px 16px', gap: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="rounded-full flex-shrink-0" style={{ width: '8px', height: '8px', background: '#003087' }} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium" style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{n.titulo}</span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{tempoRelativo(n.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forum */}
      <div style={{ marginBottom: '28px' }}>
        <SectionHeader title="Topicos recentes no forum" linkText="Ver todos" onClick={() => navigate('/forum')} />
        {posts.length === 0
          ? <EmptyState text="Nenhum topico encontrado. Seja o primeiro a criar um!" />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {posts.map(post => <PostCard key={post.id} post={post} onClick={() => {}} />)}
            </div>
        }
      </div>

      {/* Voluntariado */}
      <div style={{ marginBottom: '28px' }}>
        <SectionHeader title="Oportunidades de voluntariado" linkText="Ver todas" onClick={() => navigate('/voluntariado')} />
        {oportunidades.length === 0
          ? <EmptyState text="Nenhuma oportunidade disponivel no momento." />
          : <div className="grid grid-cols-2" style={{ gap: '14px' }}>
              {oportunidades.map(op => <OpCard key={op.id} op={op} />)}
            </div>
        }
      </div>

      {/* Reputacao */}
      {reputacoes.length > 0 && (
        <div>
          <SectionHeader title="Sua reputacao por disciplina" linkText="Ver ranking" onClick={() => navigate('/ranking')} />
          <div className="grid grid-cols-3" style={{ gap: '14px' }}>
            {reputacoes.map((r, i) => <RepCard key={i} rep={r} />)}
          </div>
        </div>
      )}
    </div>
  )
}
