/**
 * DashboardPage — Visao geral com dados reais da API.
 *
 * Busca:
 * - Topicos recentes do forum
 * - Oportunidades de voluntariado ativas
 * - Reputacao do usuario
 * - Notificacoes nao lidas
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
  data_inicio: string
  data_fim: string
  esta_aberta_inscricao: boolean
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
  mensagem: string
  lida: boolean
  created_at: string
  tipo: string
}

const areaCores: Record<string, string> = {
  educacao: '#10B981',
  saude: '#3B82F6',
  meio_ambiente: '#22C55E',
  assistencia_social: '#F59E0B',
  direitos_humanos: '#EC4899',
  cultura: '#8B5CF6',
  tecnologia: '#6366F1',
  esporte: '#EF4444',
  outro: '#6B7280',
}

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

        if (repRes.status === 'fulfilled') {
          setReputacoes(Array.isArray(repRes.value.data) ? repRes.value.data : [])
        }

        if (notifRes.status === 'fulfilled') {
          const data = notifRes.value.data
          setNotificacoes((Array.isArray(data) ? data : data.results || []).filter((n: Notificacao) => !n.lida).slice(0, 5))
        }

        if (naoLidasRes.status === 'fulfilled') {
          setNaoLidas(naoLidasRes.value.data.total || naoLidasRes.value.data.count || 0)
        }
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [])

  /* Calcula estatisticas a partir dos dados reais */
  const totalPontos = reputacoes.reduce((sum, r) => sum + r.pontos, 0)
  const totalRespostas = reputacoes.reduce((sum, r) => sum + r.total_respostas, 0)

  /* Formata tempo relativo */
  function tempoRelativo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const min = Math.floor(diff / 60000)
    if (min < 60) return `ha ${min} min`
    const h = Math.floor(min / 60)
    if (h < 24) return `ha ${h}h`
    const d = Math.floor(h / 24)
    if (d < 30) return `ha ${d}d`
    return `ha ${Math.floor(d / 30)} mes(es)`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '60vh' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Carregando dados...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Saudacao */}
      <div style={{ marginBottom: '24px' }}>
        <h1 className="font-bold tracking-tight" style={{ fontSize: '22px', color: 'var(--text-primary)', marginBottom: '4px' }}>
          Ola{user?.nome_completo ? `, ${user.nome_completo.split(' ')[0]}` : ''}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Bem-vindo de volta. Aqui esta o resumo da sua atividade.
        </p>
      </div>

      {/* Cards de estatisticas */}
      <div className="grid grid-cols-4" style={{ gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Reputacao total', value: totalPontos.toString(), change: `${reputacoes.length} disciplina(s)`, color: '#003087' },
          { label: 'Respostas dadas', value: totalRespostas.toString(), change: '', color: '#10B981' },
          { label: 'Notificacoes', value: naoLidas.toString(), change: naoLidas > 0 ? 'nao lidas' : 'tudo lido', color: '#F59E0B' },
          { label: 'Oportunidades ativas', value: oportunidades.length.toString(), change: 'de voluntariado', color: '#C8102E' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl" style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{s.label}</div>
            <div className="font-bold" style={{ fontSize: '22px', color: 'var(--text-primary)' }}>{s.value}</div>
            {s.change && <div style={{ fontSize: '12px', color: s.color, marginTop: '4px' }}>{s.change}</div>}
          </div>
        ))}
      </div>

      {/* Notificacoes recentes */}
      {notificacoes.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
            <h2 className="font-medium" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Notificacoes recentes</h2>
            <button onClick={() => navigate('/notificacoes')} className="cursor-pointer" style={{ fontSize: '13px', color: '#003087' }}>Ver todas</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {notificacoes.map(n => (
              <div key={n.id} className="flex items-start rounded-xl" style={{ padding: '12px 16px', gap: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="rounded-full flex-shrink-0" style={{ width: '8px', height: '8px', marginTop: '6px', background: '#003087' }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium" style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '2px' }}>{n.titulo}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{tempoRelativo(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topicos recentes do forum */}
      <div style={{ marginBottom: '24px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
          <h2 className="font-medium" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Topicos recentes no forum</h2>
          <button onClick={() => navigate('/forum')} className="cursor-pointer" style={{ fontSize: '13px', color: '#003087' }}>Ver todos</button>
        </div>

        {posts.length === 0 ? (
          <div className="rounded-xl text-center" style={{ padding: '32px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Nenhum topico encontrado. Seja o primeiro a criar um!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {posts.map(post => (
              <div key={post.id} className="flex rounded-xl cursor-pointer transition-all duration-150"
                style={{ padding: '14px 16px', gap: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="text-center" style={{ minWidth: '40px' }}>
                  <div className="font-medium" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{post.total_votos || 0}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>votos</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '6px' }}>
                    {post.titulo || post.conteudo?.substring(0, 80)}
                  </div>
                  <div className="flex items-center flex-wrap" style={{ gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {post.disciplina_codigo && (
                      <span className="rounded" style={{ padding: '2px 8px', background: 'rgba(0,48,135,0.08)', color: '#003087', fontSize: '11px' }}>
                        {post.disciplina_codigo}{post.disciplina_nome ? ` - ${post.disciplina_nome}` : ''}
                      </span>
                    )}
                    {post.e_melhor && (
                      <span className="rounded" style={{ padding: '2px 8px', background: 'rgba(16,185,129,0.08)', color: '#10B981', fontSize: '11px' }}>Resolvido</span>
                    )}
                    <span>{post.total_respostas || 0} respostas</span>
                    <span>{tempoRelativo(post.created_at)}</span>
                    <span>por {post.autor_nome}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Oportunidades de voluntariado */}
      <div>
        <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
          <h2 className="font-medium" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Oportunidades de voluntariado</h2>
          <button onClick={() => navigate('/voluntariado')} className="cursor-pointer" style={{ fontSize: '13px', color: '#003087' }}>Ver todas</button>
        </div>

        {oportunidades.length === 0 ? (
          <div className="rounded-xl text-center" style={{ padding: '32px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Nenhuma oportunidade disponivel no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2" style={{ gap: '12px' }}>
            {oportunidades.map(op => {
              const cor = areaCores[op.area] || '#6B7280'
              const preenchidas = op.vagas - op.vagas_disponiveis
              const porcent = op.vagas > 0 ? (preenchidas / op.vagas) * 100 : 0

              return (
                <div key={op.id} className="rounded-xl cursor-pointer transition-all duration-150"
                  style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <span className="rounded" style={{ padding: '2px 8px', fontSize: '11px', background: `${cor}15`, color: cor }}>
                    {op.area_display}
                  </span>
                  <div className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '8px 0 6px' }}>{op.titulo}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{op.local}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{op.carga_horaria_total} horas</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{preenchidas} de {op.vagas} vagas preenchidas</div>
                  <div className="rounded-full" style={{ height: '4px', background: 'var(--border)', marginTop: '10px' }}>
                    <div className="rounded-full" style={{ height: '4px', background: cor, width: `${porcent}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Reputacao por disciplina */}
      {reputacoes.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
            <h2 className="font-medium" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Sua reputacao por disciplina</h2>
            <button onClick={() => navigate('/ranking')} className="cursor-pointer" style={{ fontSize: '13px', color: '#003087' }}>Ver ranking</button>
          </div>
          <div className="grid grid-cols-3" style={{ gap: '12px' }}>
            {reputacoes.map((r, i) => (
              <div key={i} className="rounded-xl" style={{ padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{r.disciplina_codigo}</div>
                <div className="font-bold" style={{ fontSize: '18px', color: '#003087' }}>{r.pontos} pts</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  {r.total_respostas} respostas | {r.total_melhores_respostas} melhores
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
