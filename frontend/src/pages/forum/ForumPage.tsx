/**
 * ForumPage — Listagem de topicos do forum academico.
 *
 * Funcionalidades:
 * - Filtro por disciplina (tabs horizontais)
 * - Busca por titulo
 * - Listagem de topicos com votos, respostas, disciplina, autor
 * - Botao de criar novo topico
 * - Dados reais da API
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

interface Disciplina {
  id: string
  codigo: string
  nome: string
  curso: string
}

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
  autor_nome: string
  created_at: string
  post_pai: string | null
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
   COMPONENTES INTERNOS
   ============================================================ */

function TopicCard({ post, onClick }: { post: Post; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false)
  const hasAnswers = (post.total_respostas || 0) > 0

  return (
    <div
      className="flex rounded-xl cursor-pointer transition-all duration-200"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '18px 20px', gap: '18px',
        background: 'var(--bg-card)',
        border: `1px solid ${hovered ? '#00308740' : 'var(--border)'}`,
        boxShadow: hovered ? '0 2px 8px rgba(0,48,135,0.06)' : 'none',
      }}
    >
      {/* Votos */}
      <div className="flex flex-col items-center flex-shrink-0" style={{ minWidth: '52px', gap: '2px' }}>
        <div className="font-bold" style={{ fontSize: '22px', color: '#003087' }}>{post.pontuacao || 0}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>votos</div>
      </div>

      {/* Respostas */}
      <div className="flex flex-col items-center flex-shrink-0" style={{
        minWidth: '52px', gap: '2px', padding: '4px 8px', borderRadius: '8px',
        background: hasAnswers ? 'rgba(16,185,129,0.06)' : 'transparent',
      }}>
        <div className="font-bold" style={{ fontSize: '18px', color: hasAnswers ? '#10B981' : 'var(--text-tertiary)' }}>
          {post.total_respostas || 0}
        </div>
        <div style={{ fontSize: '11px', color: hasAnswers ? '#10B981' : 'var(--text-tertiary)' }}>respostas</div>
      </div>

      {/* Conteudo */}
      <div className="flex-1 min-w-0">
        <div className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '8px', lineHeight: 1.4 }}>
          {post.titulo || post.conteudo?.substring(0, 100)}
        </div>

        <div className="flex items-center flex-wrap" style={{ gap: '8px' }}>
          {/* Tag da disciplina */}
          <span className="rounded-md" style={{
            padding: '3px 10px', fontSize: '11px', fontWeight: 500,
            background: 'rgba(0,48,135,0.06)', color: '#003087',
          }}>
            {post.disciplina_codigo}{post.disciplina_nome ? ` - ${post.disciplina_nome}` : ''}
          </span>

          {/* Badge resolvido */}
          {post.e_melhor && (
            <span className="rounded-md flex items-center" style={{
              padding: '3px 10px', fontSize: '11px', fontWeight: 500, gap: '4px',
              background: 'rgba(16,185,129,0.06)', color: '#10B981',
            }}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Resolvido
            </span>
          )}

          {/* Duvida persiste */}
          {(post.total_reacoes_persiste || 0) > 0 && (
            <span className="rounded-md" style={{
              padding: '3px 10px', fontSize: '11px', fontWeight: 500,
              background: 'rgba(245,158,11,0.06)', color: '#F59E0B',
            }}>
              {post.total_reacoes_persiste} dúvida(s) persiste(m)
            </span>
          )}
        </div>

        {/* Meta info */}
        <div className="flex items-center" style={{ gap: '12px', marginTop: '8px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
          <span>por <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{post.autor_nome}</strong></span>
          <span>{tempoRelativo(post.created_at)}</span>
        </div>
      </div>
    </div>
  )
}

function DisciplinaTab({ disc, active, onClick }: { disc: { id: string; codigo: string; nome: string }; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 rounded-lg font-medium cursor-pointer transition-all duration-150"
      style={{
        padding: '8px 16px', fontSize: '13px',
        background: active ? '#003087' : 'var(--bg-input)',
        color: active ? 'white' : 'var(--text-secondary)',
        border: `1px solid ${active ? '#003087' : 'var(--border)'}`,
      }}
    >
      {disc.codigo}
    </button>
  )
}

/* ============================================================
   PAGINA PRINCIPAL DO FORUM
   ============================================================ */
export default function ForumPage() {
  const navigate = useNavigate()
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroDisc, setFiltroDisc] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [showNovoTopico, setShowNovoTopico] = useState(false)

  /* Campos do novo topico */
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novoConteudo, setNovoConteudo] = useState('')
  const [novoDisciplina, setNovoDisciplina] = useState('')
  const [criando, setCriando] = useState(false)

  /* Carregar disciplinas */
  useEffect(() => {
    api.get('/forum/disciplinas/').then(res => {
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      setDisciplinas(data)
    }).catch(console.error)
  }, [])

  /* Carregar posts (recarrega quando muda filtro) */
  useEffect(() => {
    setLoading(true)
    const params: Record<string, string> = { ordering: '-created_at' }
    if (filtroDisc) params.disciplina = filtroDisc
    if (busca) params.search = busca

    api.get('/forum/posts/', { params }).then(res => {
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      setPosts(data.filter((p: Post) => !p.post_pai))
    }).catch(console.error).finally(() => setLoading(false))
  }, [filtroDisc, busca])

  /* Criar novo tópico */
  async function handleCriarTopico(e: React.FormEvent) {
    e.preventDefault()
    if (!novoTitulo.trim() || !novoConteudo.trim() || !novoDisciplina) return

    setCriando(true)
    try {
      await api.post('/forum/posts/', {
        titulo: novoTitulo,
        conteudo: novoConteudo,
        disciplina: novoDisciplina,
      })
      setNovoTitulo('')
      setNovoConteudo('')
      setNovoDisciplina('')
      setShowNovoTopico(false)
      /* Recarrega os posts */
      const params: Record<string, string> = { ordering: '-created_at' }
      if (filtroDisc) params.disciplina = filtroDisc
      const res = await api.get('/forum/posts/', { params })
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      setPosts(data.filter((p: Post) => !p.post_pai))
    } catch (err) {
      console.error('Erro ao criar topico:', err)
    } finally {
      setCriando(false)
    }
  }

  /* Debounce na busca */
  const [buscaInput, setBuscaInput] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setBusca(buscaInput), 400)
    return () => clearTimeout(timer)
  }, [buscaInput])

  return (
    <div style={{ maxWidth: '900px' }}>

      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="font-bold tracking-tight" style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Fórum Acadêmico
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            {posts.length} tópico(s) {filtroDisc ? 'nesta disciplina' : 'no total'}
          </p>
        </div>

        <button
          onClick={() => setShowNovoTopico(!showNovoTopico)}
          className="flex items-center rounded-xl font-medium cursor-pointer transition-all duration-200 text-white"
          style={{
            padding: '10px 20px', gap: '8px', fontSize: '14px',
            background: 'linear-gradient(135deg, #003087 0%, #001845 100%)',
            boxShadow: '0 2px 8px rgba(0,48,135,0.25)',
          }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Novo tópico
        </button>
      </div>

      {/* Formulario de novo topico (colapsavel) */}
      {showNovoTopico && (
        <form onSubmit={handleCriarTopico} className="rounded-xl" style={{
          padding: '24px', marginBottom: '24px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
        }}>
          <h3 className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '16px' }}>
            Criar novo tópico
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Disciplina */}
            <div>
              <label className="block font-medium" style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '6px' }}>Disciplina</label>
              <select
                value={novoDisciplina}
                onChange={e => setNovoDisciplina(e.target.value)}
                className="w-full rounded-xl outline-none cursor-pointer"
                style={{
                  padding: '10px 14px', fontSize: '14px',
                  background: 'var(--bg-input)', border: '1.5px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="">Selecione a disciplina</option>
                {disciplinas.map(d => (
                  <option key={d.id} value={d.id}>{d.codigo} - {d.nome}</option>
                ))}
              </select>
            </div>

            {/* Titulo */}
            <div>
              <label className="block font-medium" style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '6px' }}>Titulo</label>
              <input
                type="text"
                value={novoTitulo}
                onChange={e => setNovoTitulo(e.target.value)}
                placeholder="Resuma sua dúvida em uma frase"
                className="w-full rounded-xl outline-none"
                style={{
                  padding: '10px 14px', fontSize: '14px',
                  background: 'var(--bg-input)', border: '1.5px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            {/* Conteudo */}
            <div>
              <label className="block font-medium" style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '6px' }}>Descricao</label>
              <textarea
                value={novoConteudo}
                onChange={e => setNovoConteudo(e.target.value)}
                placeholder="Descreva sua dúvida com detalhes..."
                rows={4}
                className="w-full rounded-xl outline-none resize-none"
                style={{
                  padding: '10px 14px', fontSize: '14px',
                  background: 'var(--bg-input)', border: '1.5px solid var(--border)',
                  color: 'var(--text-primary)',
                }}
              />
            </div>

            <div className="flex items-center" style={{ gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowNovoTopico(false)}
                className="rounded-xl font-medium cursor-pointer transition-all duration-200"
                style={{
                  padding: '10px 20px', fontSize: '14px',
                  background: 'var(--bg-input)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={criando || !novoTitulo.trim() || !novoConteudo.trim() || !novoDisciplina}
                className="rounded-xl font-medium cursor-pointer transition-all duration-200 text-white"
                style={{
                  padding: '10px 20px', fontSize: '14px',
                  background: '#003087', opacity: criando ? 0.7 : 1,
                }}
              >
                {criando ? 'Publicando...' : 'Publicar'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filtros */}
      <div className="flex items-center" style={{ gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>

        {/* Busca */}
        <div className="flex items-center flex-1"
          style={{
            minWidth: '200px', maxWidth: '320px', gap: '8px',
            padding: '8px 14px', borderRadius: '10px',
            background: 'var(--bg-input)', border: '1px solid var(--border)',
          }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar tópicos..."
            value={buscaInput}
            onChange={e => setBuscaInput(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: '13px', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Tabs de disciplinas */}
        <div className="flex items-center" style={{ gap: '6px', overflowX: 'auto' }}>
          <button
            onClick={() => setFiltroDisc(null)}
            className="flex-shrink-0 rounded-lg font-medium cursor-pointer transition-all duration-150"
            style={{
              padding: '8px 16px', fontSize: '13px',
              background: !filtroDisc ? '#003087' : 'var(--bg-input)',
              color: !filtroDisc ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${!filtroDisc ? '#003087' : 'var(--border)'}`,
            }}
          >
            Todas
          </button>
          {disciplinas.map(d => (
            <DisciplinaTab
              key={d.id}
              disc={d}
              active={filtroDisc === d.id}
              onClick={() => setFiltroDisc(filtroDisc === d.id ? null : d.id)}
            />
          ))}
        </div>
      </div>

      {/* Lista de topicos */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ height: '200px' }}>
          <div className="flex items-center" style={{ gap: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Carregando tópicos...
          </div>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl text-center" style={{ padding: '48px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 1.136.845 2.1 1.976 2.193 1.234.1 2.4.163 3.548.163" />
          </svg>
          <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            {busca ? 'Nenhum tópico encontrado' : 'Nenhum tópico ainda'}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            {busca ? 'Tente outra busca.' : 'Seja o primeiro a criar um tópico nesta disciplina!'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {posts.map(post => <TopicCard key={post.id} post={post} onClick={() => navigate(`/forum/${post.id}`)} />)}
        </div>
      )}
    </div>
  )
}
