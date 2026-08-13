/**
 * TopicPage — Visualizacao de um topico com respostas.
 *
 * Funcionalidades:
 * - Exibe o topico original com votos
 * - Lista respostas ordenadas (melhor resposta no topo)
 * - Votar em posts (toggle)
 * - Reagir "duvida persiste"
 * - Marcar como melhor resposta
 * - Formulario de nova resposta
 * - Dados reais da API
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../services/api'
import toast, { Toaster } from 'react-hot-toast'

interface Post {
  id: string
  titulo: string
  conteudo: string
  pontuacao: number
  total_respostas: number
  total_reacoes_persiste: number
  e_melhor: boolean
  disciplina: string
  disciplina_codigo: string
  disciplina_nome: string
  autor: string
  autor_nome: string
  created_at: string
  updated_at: string
  post_pai: string | null
  restrito: boolean
  motivo_restricao: string
  restrito_por_nome: string | null
}

/* ============================================================
   COMPONENTE: Aviso e controle de restrição
   ============================================================ */
function BlocoRestricao({ post, podeModerar, onMudou }: {
  post: Post
  podeModerar: boolean
  onMudou: () => void
}) {
  const [abrindo, setAbrindo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function restringir() {
    if (!motivo.trim()) {
      toast.error('Descreva o motivo. O autor recebe este texto.')
      return
    }
    setEnviando(true)
    try {
      await api.post(`/forum/posts/${post.id}/restringir/`, { motivo: motivo.trim() })
      toast.success('Publicação restrita. O autor foi notificado.')
      setAbrindo(false)
      setMotivo('')
      onMudou()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Não foi possível restringir')
    } finally {
      setEnviando(false)
    }
  }

  async function liberar() {
    try {
      await api.delete(`/forum/posts/${post.id}/restringir/`)
      toast.success('Restrição removida.')
      onMudou()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Não foi possível liberar')
    }
  }

  if (post.restrito) {
    return (
      <div className="rounded-lg" style={{
        padding: '12px 14px', marginTop: '12px',
        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
      }}>
        <div className="font-medium" style={{ fontSize: '13px', color: '#B45309', marginBottom: '3px' }}>
          Publicação restrita
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {post.motivo_restricao}
          {post.restrito_por_nome ? ` — ${post.restrito_por_nome}` : ''}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
          Somente você e a moderação da disciplina conseguem ver esta publicação.
        </div>

        {podeModerar && (
          <button
            onClick={liberar}
            className="cursor-pointer"
            style={{
              marginTop: '10px', fontSize: '12px', fontWeight: 500,
              background: 'none', border: 'none', color: '#003087',
            }}
          >
            Remover restrição
          </button>
        )}
      </div>
    )
  }

  if (!podeModerar) return null

  if (!abrindo) {
    return (
      <button
        onClick={() => setAbrindo(true)}
        className="cursor-pointer"
        style={{
          marginTop: '12px', fontSize: '12px', fontWeight: 500,
          background: 'none', border: 'none', color: 'var(--text-tertiary)',
        }}
      >
        Restringir publicação
      </button>
    )
  }

  return (
    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Por que esta publicação não está adequada? O autor recebe este texto."
        rows={2}
        className="w-full rounded-lg outline-none"
        style={{
          padding: '9px 12px', fontSize: '13px', resize: 'vertical',
          background: 'var(--bg-input)', color: 'var(--text-primary)',
          border: '1px solid var(--border)',
        }}
      />
      <div className="flex items-center" style={{ gap: '8px' }}>
        <button
          onClick={restringir}
          disabled={enviando}
          className="rounded-lg font-medium cursor-pointer"
          style={{
            padding: '7px 14px', fontSize: '13px', border: 'none',
            background: '#F59E0B', color: 'white', opacity: enviando ? 0.6 : 1,
          }}
        >
          Confirmar restrição
        </button>
        <button
          onClick={() => { setAbrindo(false); setMotivo('') }}
          className="cursor-pointer"
          style={{ fontSize: '12px', background: 'none', border: 'none', color: 'var(--text-tertiary)' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
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
   COMPONENTE: Bloco de voto (seta + numero)
   ============================================================ */
function VoteBlock({ postId, totalVotos, onVoted }: {
  postId: string; totalVotos: number; onVoted: () => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleVote() {
    setLoading(true)
    try {
      const res = await api.post(`/forum/posts/${postId}/votar/`)
      toast.success(res.data.detail || 'Voto registrado')
      onVoted()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao votar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center flex-shrink-0" style={{ minWidth: '56px', gap: '4px' }}>
      <button
        onClick={handleVote}
        disabled={loading}
        className="flex items-center justify-center rounded-lg cursor-pointer transition-all duration-150"
        style={{
          width: '40px', height: '40px',
          background: 'rgba(0,48,135,0.06)', color: '#003087',
          border: '1px solid rgba(0,48,135,0.1)',
        }}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
      </button>
      <span className="font-bold" style={{ fontSize: '18px', color: '#003087' }}>{totalVotos}</span>
      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>votos</span>
    </div>
  )
}

/* ============================================================
   COMPONENTE: Card de resposta
   ============================================================ */
function ResponseCard({ post, topicAuthorId, onAction }: {
  post: Post; topicAuthorId: string; onAction: () => void
}) {
  const { user } = useAuth()
  const [loadingAction, setLoadingAction] = useState('')

  async function handleAction(action: string) {
    setLoadingAction(action)
    try {
      if (action === 'persiste') {
        const res = await api.post(`/forum/posts/${post.id}/reagir-persiste/`)
        toast.success(res.data.detail || 'Reação registrada')
      } else if (action === 'melhor') {
        const res = await api.post(`/forum/posts/${post.id}/marcar-melhor/`)
        toast.success(res.data.detail || 'Melhor resposta atualizada')
      }
      onAction()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro na ação')
    } finally {
      setLoadingAction('')
    }
  }

  const isTopicAuthor = user?.id === topicAuthorId
  const isAdmin = user?.is_admin

  return (
    <div className="flex rounded-xl" style={{
      padding: '20px', gap: '16px',
      background: post.e_melhor ? 'rgba(16,185,129,0.03)' : 'var(--bg-card)',
      border: `1px solid ${post.e_melhor ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
    }}>
      {/* Votos */}
      <VoteBlock postId={post.id} totalVotos={post.pontuacao || 0} onVoted={onAction} />

      {/* Conteudo */}
      <div className="flex-1 min-w-0">
        {/* Badge melhor resposta */}
        {post.e_melhor && (
          <div className="flex items-center" style={{ gap: '6px', marginBottom: '10px', color: '#10B981', fontSize: '13px', fontWeight: 500 }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Melhor resposta
          </div>
        )}

        {/* Texto */}
        <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {post.conteudo}
        </div>

        {/* Meta + acoes */}
        <div className="flex items-center justify-between flex-wrap" style={{ marginTop: '14px', gap: '8px' }}>
          {/* Info do autor */}
          <div className="flex items-center" style={{ gap: '8px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            <div className="flex items-center justify-center rounded-full" style={{
              width: '24px', height: '24px', background: 'rgba(0,48,135,0.08)',
              color: '#003087', fontSize: '11px', fontWeight: 600,
            }}>
              {post.autor_nome?.[0]?.toUpperCase() || 'U'}
            </div>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{post.autor_nome}</span>
            <span>{tempoRelativo(post.created_at)}</span>
          </div>

          {/* Botoes de acao */}
          <div className="flex items-center" style={{ gap: '6px' }}>
            {/* Dúvida persiste */}
            <button
              onClick={() => handleAction('persiste')}
              disabled={loadingAction === 'persiste'}
              className="flex items-center rounded-lg cursor-pointer transition-all duration-150"
              style={{
                padding: '6px 12px', gap: '4px', fontSize: '12px',
                background: (post.total_reacoes_persiste || 0) > 0 ? 'rgba(245,158,11,0.06)' : 'var(--bg-input)',
                color: (post.total_reacoes_persiste || 0) > 0 ? '#F59E0B' : 'var(--text-tertiary)',
                border: '1px solid var(--border)',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
              {(post.total_reacoes_persiste || 0) > 0 ? `${post.total_reacoes_persiste} dúvida(s)` : 'Dúvida persiste'}
            </button>

            {/* Marcar melhor (so pra autor do topico ou admin) */}
            {(isTopicAuthor || isAdmin) && !post.e_melhor && (
              <button
                onClick={() => handleAction('melhor')}
                disabled={loadingAction === 'melhor'}
                className="flex items-center rounded-lg cursor-pointer transition-all duration-150"
                style={{
                  padding: '6px 12px', gap: '4px', fontSize: '12px',
                  background: 'rgba(16,185,129,0.06)', color: '#10B981',
                  border: '1px solid rgba(16,185,129,0.15)',
                }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Marcar como melhor
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   PAGINA PRINCIPAL DO TOPICO
   ============================================================ */
export default function TopicPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [topic, setTopic] = useState<Post | null>(null)
  const [respostas, setRespostas] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [novaResposta, setNovaResposta] = useState('')
  const [anexos, setAnexos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)

  async function fetchTopic() {
    try {
      const [topicRes, respostasRes] = await Promise.all([
        api.get(`/forum/posts/${id}/`),
        api.get(`/forum/posts/${id}/respostas/`),
      ])
      setTopic(topicRes.data)
      const resp = Array.isArray(respostasRes.data) ? respostasRes.data : respostasRes.data.results || []
      /* Melhor resposta primeiro */
      setRespostas(resp.sort((a: Post, b: Post) => (b.e_melhor ? 1 : 0) - (a.e_melhor ? 1 : 0)))
    } catch (err) {
      console.error('Erro ao carregar topico:', err)
      toast.error('Tópico não encontrado')
      navigate('/forum')
    } finally {
      setLoading(false)
    }
    console.log()

  }

  useEffect(() => { fetchTopic() }, [id])

  /* Registrar visualizacao */
  useEffect(() => {
    if (id) api.post(`/forum/posts/${id}/visualizar/`).catch(() => {})
  }, [id])

  async function handleResponder(e: React.FormEvent) {
    e.preventDefault()
    if (!novaResposta.trim() || !topic) return

    setEnviando(true)
    try {
      const { data: resposta } = await api.post('/forum/posts/', {
        conteudo: novaResposta,
        disciplina: topic.disciplina,
        post_pai: topic.id,
      })

      /* Os anexos vão depois, porque o arquivo precisa de um post ao qual se
         vincular. Falha em um deles não descarta a resposta já publicada. */
      for (const arquivo of anexos) {
        const corpo = new FormData()
        corpo.append('arquivo', arquivo)
        try {
          await api.post(`/forum/posts/${resposta.id}/anexar/`, corpo, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        } catch {
          toast.error(`Não foi possível anexar ${arquivo.name}.`)
        }
      }

      setNovaResposta('')
      setAnexos([])
      toast.success('Resposta publicada!')
      fetchTopic()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao responder')
    } finally {
      setEnviando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '60vh' }}>
        <div className="flex items-center" style={{ gap: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Carregando tópico...
        </div>
      </div>
    )
  }

  if (!topic) return null

  const hasResolved = respostas.some(r => r.e_melhor)

  /* Restringir é atribuição de quem acompanha a matéria. A coordenação
     também pode, por ser instância superior em qualquer disciplina. */
  const podeModerarEsta = !!user && (
    user.e_coordenacao ||
    user.papeis_disciplina?.some(
      p => p.disciplina_id === topic.disciplina &&
           (p.papel === 'monitor' || p.papel === 'professor')
    )
  )

  return (
    <div style={{ maxWidth: '900px' }}>
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      {/* Header com voltar */}
      <div className="flex items-center" style={{ gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/forum')}
          className="flex items-center justify-center rounded-lg cursor-pointer transition-all duration-150"
          style={{ width: '36px', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div>
          <span className="rounded-md" style={{
            padding: '3px 10px', fontSize: '12px', fontWeight: 500,
            background: 'rgba(0,48,135,0.06)', color: '#003087',
          }}>
            {topic.disciplina_codigo}{topic.disciplina_nome ? ` - ${topic.disciplina_nome}` : ''}
          </span>
        </div>
        {hasResolved && (
          <span className="rounded-md flex items-center" style={{
            padding: '3px 10px', fontSize: '12px', fontWeight: 500, gap: '4px',
            background: 'rgba(16,185,129,0.06)', color: '#10B981',
          }}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Resolvido
          </span>
        )}
      </div>

      {/* Topico principal */}
      <div className="flex rounded-xl" style={{
        padding: '24px', gap: '18px', marginBottom: '24px',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
      }}>
        <VoteBlock postId={topic.id} totalVotos={topic.pontuacao || 0} onVoted={fetchTopic} />

        <div className="flex-1 min-w-0">
          <h1 className="font-bold" style={{ fontSize: '20px', color: 'var(--text-primary)', marginBottom: '12px', lineHeight: 1.4 }}>
            {topic.titulo}
          </h1>
          <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {topic.conteudo}
          </div>

          <div className="flex items-center" style={{ marginTop: '16px', gap: '8px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            <div className="flex items-center justify-center rounded-full" style={{
              width: '24px', height: '24px', background: 'rgba(0,48,135,0.08)',
              color: '#003087', fontSize: '11px', fontWeight: 600,
            }}>
              {topic.autor_nome?.[0]?.toUpperCase() || 'U'}
            </div>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{topic.autor_nome}</span>
            <span>{tempoRelativo(topic.created_at)}</span>
          </div>

          <BlocoRestricao
            post={topic}
            podeModerar={podeModerarEsta}
            onMudou={fetchTopic}
          />
        </div>
      </div>

      {/* Contador de respostas */}
      <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
        <h2 className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>
          {respostas.length} resposta{respostas.length !== 1 ? 's' : ''}
        </h2>
      </div>

      {/* Lista de respostas */}
      {respostas.length === 0 ? (
        <div className="rounded-xl text-center" style={{
          padding: '40px', marginBottom: '24px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
        }}>
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
            Nenhuma resposta ainda. Seja o primeiro a ajudar!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          {respostas.map(r => (
            <ResponseCard key={r.id} post={r} topicAuthorId={topic.autor} onAction={fetchTopic} />
          ))}
        </div>
      )}

      {/* Formulario de resposta */}
      <div className="rounded-xl" style={{
        padding: '24px',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
      }}>
        <h3 className="font-semibold" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '14px' }}>
          Sua resposta
        </h3>
        <form onSubmit={handleResponder}>
          <textarea
            value={novaResposta}
            onChange={e => setNovaResposta(e.target.value)}
            placeholder="Escreva sua resposta com detalhes..."
            rows={4}
            className="w-full rounded-xl outline-none resize-none"
            style={{
              padding: '14px', fontSize: '14px', lineHeight: 1.6,
              background: 'var(--bg-input)', border: '1.5px solid var(--border)',
              color: 'var(--text-primary)', marginBottom: '14px',
            }}
            onFocus={e => e.target.style.borderColor = '#003087'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          {/* Anexo na resposta: material de apoio costuma explicar melhor do
              que o texto, e o endpoint já existia sem caminho na interface. */}
          {/* O campo de arquivo nativo passa despercebido. Escondemos o
              controle e usamos um rótulo com aparência de botão, que é o que
              a pessoa procura quando quer anexar algo. */}
          <div className="flex items-center" style={{ gap: '12px', marginBottom: '14px' }}>
            <label
              htmlFor="anexo-resposta"
              className="flex items-center rounded-lg font-medium cursor-pointer"
              style={{
                padding: '8px 14px', gap: '7px', fontSize: '13px',
                color: '#003087',
                background: 'rgba(0,48,135,0.06)',
                border: '1px solid rgba(0,48,135,0.25)',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
              Anexar arquivo
            </label>

            <input
              id="anexo-resposta"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={(e) => {
                const escolhidos = Array.from(e.target.files || [])
                  .filter(arquivo => {
                    if (arquivo.size > 10 * 1024 * 1024) {
                      toast.error(`${arquivo.name} passa de 10 MB.`)
                      return false
                    }
                    return true
                  })
                setAnexos(anteriores => [...anteriores, ...escolhidos])
                e.target.value = ''
              }}
              style={{ display: 'none' }}
            />

            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              PDF, documentos e imagens, até 10 MB
            </span>
          </div>

          {anexos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
              {anexos.map((arquivo, indice) => (
                <div
                  key={`${arquivo.name}-${indice}`}
                  className="flex items-center rounded-lg"
                  style={{
                    padding: '7px 12px', gap: '10px',
                    background: 'var(--bg-input)', border: '1px solid var(--border)',
                  }}
                >
                  <span className="flex-1 truncate" style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>
                    {arquivo.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAnexos(a => a.filter((_, i) => i !== indice))}
                    className="cursor-pointer"
                    style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '12px' }}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={enviando || !novaResposta.trim()}
              className="flex items-center rounded-xl font-medium cursor-pointer transition-all duration-200 text-white"
              style={{
                padding: '10px 24px', gap: '8px', fontSize: '14px',
                background: '#003087',
                opacity: enviando || !novaResposta.trim() ? 0.5 : 1,
              }}
            >
              {enviando ? 'Publicando...' : 'Responder'}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
