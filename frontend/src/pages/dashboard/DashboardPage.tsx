import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../services/api'

interface Post {
  id: string; titulo: string; conteudo: string; pontuacao: number
  total_respostas: number; e_melhor: boolean; disciplina_codigo?: string
  autor_nome: string; created_at: string; post_pai: string | null
}
interface Oportunidade {
  id: string; titulo: string; area: string; area_display: string
  local: string; carga_horaria_total: number; vagas: number; vagas_disponiveis: number
}
interface Andamento {
  disciplina_codigo: string; disciplina_nome: string; total_posts: number
  total_respostas: number; total_melhores_respostas: number
}
interface Notificacao { id: string; titulo: string; lida: boolean; created_at: string }

const areaCores: Record<string, string> = {
  educacao: '#10B981', saude: '#3B82F6', meio_ambiente: '#22C55E',
  assistencia_social: '#F59E0B', direitos_humanos: '#EC4899',
  cultura: '#8B5CF6', tecnologia: '#6366F1', esporte: '#EF4444', outro: '#6B7280',
}

function tempoRelativo(d: string): string {
  const diff = Date.now() - new Date(d).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return min + 'min'
  const h = Math.floor(min / 60)
  if (h < 24) return h + 'h'
  const day = Math.floor(h / 24)
  return day < 30 ? day + 'd' : Math.floor(day / 30) + 'm'
}

/* ============================================================ */

function ProgressRing({ value, max, color, size = 48, stroke = 3 }: {
  value: number; max: number; color: string; size?: number; stroke?: number
}) {
  const r = (size - stroke) / 2
  const c = r * 2 * Math.PI
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
        style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
    </svg>
  )
}

function PostRow({ post, onClick }: { post: Post; onClick: () => void }) {
  const [h, setH] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      className="flex items-center cursor-pointer transition-all duration-200"
      style={{
        padding: '12px 14px', gap: '14px', borderRadius: '10px',
        background: h ? 'var(--bg-hover)' : 'transparent',
        transform: h ? 'translateX(4px)' : 'translateX(0)',
      }}>
      <div className="text-center flex-shrink-0" style={{ minWidth: '36px' }}>
        <div className="font-bold" style={{ fontSize: '15px', color: '#003087' }}>{post.pontuacao || 0}</div>
        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>votos</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium" style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: '4px' }}>
          {post.titulo || post.conteudo?.substring(0, 70)}
        </div>
        <div className="flex items-center" style={{ gap: '8px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
          {post.disciplina_codigo && <span style={{ color: '#003087', fontWeight: 500 }}>{post.disciplina_codigo}</span>}
          <span>{post.total_respostas || 0} resp.</span>
          <span>{tempoRelativo(post.created_at)}</span>
        </div>
      </div>
      {(post.total_respostas || 0) > 0 && (
        <div className="flex items-center justify-center rounded-full flex-shrink-0" style={{
          width: '24px', height: '24px', fontSize: '11px',
          background: 'rgba(16,185,129,0.1)', color: '#10B981', fontWeight: 600,
        }}>{post.total_respostas}</div>
      )}
    </div>
  )
}

function OpRow({ op, onClick }: { op: Oportunidade; onClick: () => void }) {
  const [h, setH] = useState(false)
  const cor = areaCores[op.area] || '#6B7280'
  const preenchidas = op.vagas - op.vagas_disponiveis
  const pct = op.vagas > 0 ? (preenchidas / op.vagas) * 100 : 0
  const [animPct, setAnimPct] = useState(0)
  useEffect(() => { const t = setTimeout(() => setAnimPct(pct), 300); return () => clearTimeout(t) }, [pct])

  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      className="cursor-pointer transition-all duration-200"
      style={{
        padding: '14px', borderRadius: '10px',
        background: h ? 'var(--bg-hover)' : 'transparent',
        transform: h ? 'translateX(4px)' : 'translateX(0)',
      }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
        <div className="flex items-center" style={{ gap: '8px' }}>
          <div style={{ width: '3px', height: '16px', borderRadius: '2px', background: cor }} />
          <span className="font-medium" style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{op.titulo}</span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{preenchidas}/{op.vagas}</span>
      </div>
      <div className="flex items-center" style={{ gap: '8px', paddingLeft: '11px' }}>
        <div className="flex-1 rounded-full" style={{ height: '3px', background: 'var(--border)' }}>
          <div className="rounded-full" style={{ height: '3px', background: cor, width: animPct + '%', transition: 'width 0.8s ease' }} />
        </div>
        <span style={{ fontSize: '10px', color: cor, fontWeight: 500 }}>{op.area_display}</span>
      </div>
    </div>
  )
}

function NotifRow({ notif }: { notif: Notificacao }) {
  return (
    <div className="flex items-center" style={{ padding: '10px 14px', gap: '10px', borderRadius: '10px' }}>
      <div className="rounded-full flex-shrink-0" style={{ width: '6px', height: '6px', background: '#003087' }} />
      <span className="flex-1" style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{notif.titulo}</span>
      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{tempoRelativo(notif.created_at)}</span>
    </div>
  )
}

function QuickLink({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      className="flex items-center w-full rounded-lg cursor-pointer transition-all duration-200"
      style={{
        padding: '10px 12px', gap: '10px', textAlign: 'left',
        background: h ? 'var(--bg-hover)' : 'var(--bg-input)',
        border: 'none', fontSize: '13px', color: 'var(--text-primary)',
        transform: h ? 'translateX(4px)' : 'translateX(0)',
      }}>
      <div className="flex items-center justify-center flex-shrink-0" style={{ width: '28px', height: '28px', color: 'var(--text-tertiary)' }}>
        {icon}
      </div>
      <span>{label}</span>
    </button>
  )
}

function TiltCard({ children, style: extraStyle }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
    const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)
    setTilt({ x: y * -2, y: x * 2 })
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setTilt({ x: 0, y: 0 }) }}
      onMouseMove={handleMove}
      className="rounded-2xl transition-shadow duration-300"
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        overflow: 'hidden',
        transform: hovered ? `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-2px)` : 'perspective(600px) rotateX(0) rotateY(0)',
        transition: hovered ? 'transform 0.1s ease, box-shadow 0.3s ease' : 'transform 0.4s ease, box-shadow 0.3s ease',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.08)' : 'none',
        ...extraStyle,
      }}
    >
      {children}
    </div>
  )
}

function SectionHeader({ title, linkText, onLink }: { title: string; linkText?: string; onLink?: () => void }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '16px 18px 12px' }}>
      <h3 className="font-semibold" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{title}</h3>
      {linkText && onLink && (
        <button onClick={onLink} className="cursor-pointer font-medium" style={{ fontSize: '12px', color: '#003087' }}>{linkText}</button>
      )}
    </div>
  )
}

/* ============================================================
   PAGINA
   ============================================================ */
export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [posts, setPosts] = useState<Post[]>([])
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [andamento, setAndamento] = useState<Andamento[]>([])
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [naoLidas, setNaoLidas] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function f() {
      try {
        const [p, o, r, n, nl] = await Promise.allSettled([
          api.get('/forum/posts/', { params: { ordering: '-created_at' } }),
          api.get('/voluntariado/oportunidades/', { params: { status: 'ativa', ordering: '-created_at' } }),
          api.get('/forum/andamento/'),
          api.get('/notificacoes/', { params: { ordering: '-created_at' } }),
          api.get('/notificacoes/nao-lidas/'),
        ])
        if (p.status === 'fulfilled') { const d = p.value.data; setPosts((Array.isArray(d) ? d : d.results || []).filter((x: Post) => !x.post_pai).slice(0, 6)) }
        if (o.status === 'fulfilled') {
          const d = o.value.data
          const list = (Array.isArray(d) ? d : d.results || []).slice(0, 5)
          list.sort((a: Oportunidade, b: Oportunidade) => {
            const pctA = a.vagas > 0 ? (a.vagas - a.vagas_disponiveis) / a.vagas : 0
            const pctB = b.vagas > 0 ? (b.vagas - b.vagas_disponiveis) / b.vagas : 0
            return pctB - pctA
          })
          setOportunidades(list)
        }
        if (r.status === 'fulfilled') setAndamento(Array.isArray(r.value.data) ? r.value.data : [])
        if (n.status === 'fulfilled') { const d = n.value.data; setNotificacoes((Array.isArray(d) ? d : d.results || []).filter((x: Notificacao) => !x.lida).slice(0, 4)) }
        if (nl.status === 'fulfilled') setNaoLidas(nl.value.data.total || nl.value.data.count || 0)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    f()
  }, [])

  const totalTopicos = andamento.reduce((s, r) => s + r.total_posts, 0)
  const totalRespostas = andamento.reduce((s, r) => s + r.total_respostas, 0)
  const totalMelhores = andamento.reduce((s, r) => s + r.total_melhores_respostas, 0)
  const firstName = user?.nome_completo?.split(' ')[0] || ''

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '60vh' }}>
        <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: 'var(--text-tertiary)' }}>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px' }}>

      <style>{`
        @keyframes pulse-dot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.5; } }
      `}</style>

      {/* ===== HERO ===== */}
      <div className="rounded-2xl" style={{
        padding: '28px 32px', marginBottom: '20px',
        background: 'linear-gradient(135deg, #001845 0%, #003087 60%, #0A4DA6 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-20px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
        <div style={{ position: 'absolute', bottom: '-60px', right: '100px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(255,255,255,0.02)' }} />

        <div className="relative z-10">
          <h1 className="font-bold text-white" style={{ fontSize: '22px', marginBottom: '6px' }}>
            Olá, {firstName}
          </h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>
            Aqui está o resumo da sua atividade na plataforma.
          </p>

          <div className="flex items-center" style={{ gap: '32px' }}>
            {/* Topicos abertos - ring */}
            <div className="flex items-center" style={{ gap: '12px' }}>
              <div className="relative flex items-center justify-center">
                <ProgressRing value={totalTopicos} max={20} color="#60A5FA" />
                <span className="absolute font-bold text-white" style={{ fontSize: '13px' }}>{totalTopicos}</span>
              </div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>Dúvidas</span>
            </div>

            {/* Respostas - ring */}
            <div className="flex items-center" style={{ gap: '12px' }}>
              <div className="relative flex items-center justify-center">
                <ProgressRing value={totalRespostas} max={20} color="#34D399" />
                <span className="absolute font-bold text-white" style={{ fontSize: '13px' }}>{totalRespostas}</span>
              </div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>Respostas</span>
            </div>

            {/* Melhor resposta - ring */}
            <div className="flex items-center" style={{ gap: '12px' }}>
              <div className="relative flex items-center justify-center">
                <ProgressRing value={totalMelhores} max={10} color="#FBBF24" />
                <span className="absolute font-bold text-white" style={{ fontSize: '13px' }}>{totalMelhores}</span>
              </div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>Ajudaram colegas</span>
            </div>

            {/* Notificacoes - alerta pulsante */}
            <div className="flex items-center" style={{ gap: '12px' }}>
              <div className="relative flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {naoLidas > 0 && (
                  <div className="absolute flex items-center justify-center" style={{
                    top: '6px', right: '6px', width: '18px', height: '18px',
                    borderRadius: '50%', background: '#F87171',
                    fontSize: '10px', fontWeight: 700, color: 'white',
                    animation: 'pulse-dot 2s ease-in-out infinite',
                  }}>{naoLidas}</div>
                )}
              </div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
                {naoLidas > 0 ? naoLidas + ' pendente(s)' : 'Tudo lido'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== GRID BENTO ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <TiltCard>
          <SectionHeader title="Tópicos recentes" linkText="Ver fórum" onLink={() => navigate('/forum')} />
          <div style={{ padding: '0 4px 8px' }}>
            {posts.length === 0
              ? <div className="text-center" style={{ padding: '24px', color: 'var(--text-tertiary)', fontSize: '13px' }}>Nenhum tópico ainda. Crie o primeiro!</div>
              : posts.map(p => <PostRow key={p.id} post={p} onClick={() => navigate('/forum/' + p.id)} />)
            }
          </div>
        </TiltCard>

        <TiltCard>
          <SectionHeader title="Voluntariado" linkText="Ver todas" onLink={() => navigate('/voluntariado')} />
          <div style={{ padding: '0 4px 8px' }}>
            {oportunidades.length === 0
              ? <div className="text-center" style={{ padding: '24px', color: 'var(--text-tertiary)', fontSize: '13px' }}>Nenhuma oportunidade disponível.</div>
              : oportunidades.map(o => <OpRow key={o.id} op={o} onClick={() => navigate('/voluntariado/' + o.id)} />)
            }
          </div>
        </TiltCard>
      </div>

      {/* ===== SEGUNDA LINHA ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <TiltCard>
          <SectionHeader title="Andamento" linkText="Ver tudo" onLink={() => navigate('/andamento')} />
          <div style={{ padding: '0 14px 12px' }}>
            {andamento.length === 0
              ? <div className="text-center" style={{ padding: '20px', color: 'var(--text-tertiary)', fontSize: '12px' }}>Participe do fórum para acompanhar seu percurso.</div>
              : andamento.map((r, i) => (
                <div key={i} className="flex items-center justify-between" style={{
                  padding: '10px 0', borderBottom: i < andamento.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div>
                    <span className="font-medium" style={{ fontSize: '13px', color: '#003087' }}>{r.disciplina_codigo}</span>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      {r.total_respostas} resp. / {r.total_melhores_respostas} ajudaram
                    </div>
                  </div>
                  <span className="font-bold" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{r.total_posts}</span>
                </div>
              ))
            }
          </div>
        </TiltCard>

        <TiltCard>
          <SectionHeader title="Notificações" linkText={naoLidas > 0 ? naoLidas + ' novas' : undefined} onLink={() => navigate('/notificacoes')} />
          <div style={{ padding: '0 4px 8px' }}>
            {notificacoes.length === 0
              ? <div className="text-center" style={{ padding: '20px', color: 'var(--text-tertiary)', fontSize: '12px' }}>Tudo lido. Nenhuma notificação pendente.</div>
              : notificacoes.map(n => <NotifRow key={n.id} notif={n} />)
            }
          </div>
        </TiltCard>

        <TiltCard>
          <div style={{ padding: '16px 18px 12px' }}>
            <h3 className="font-semibold" style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '14px' }}>Acesso rápido</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <QuickLink label="Criar novo tópico" onClick={() => navigate('/forum')}
                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" /></svg>} />
              <QuickLink label="Meus certificados" onClick={() => navigate('/certificados')}
                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>} />
              <QuickLink label="Meu perfil" onClick={() => navigate('/perfil')}
                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>} />
              <QuickLink label="Meu andamento" onClick={() => navigate('/andamento')}
                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>} />
            </div>
          </div>
        </TiltCard>
      </div>
    </div>
  )
}
