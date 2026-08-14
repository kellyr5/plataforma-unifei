/**
 * ForumPage — Fórum acadêmico, organizado por disciplina.
 *
 * A tela tem dois estados. Sem disciplina escolhida, mostra as matérias da
 * pessoa em cartões, com o que está acontecendo em cada uma; escolhida uma
 * disciplina, mostra as discussões dela.
 *
 * A razão é o próprio desenho do fórum: a discussão pertence à turma. Uma
 * lista única misturando dúvidas de matérias diferentes obrigava o leitor a
 * filtrar mentalmente o que não era dele, e escondia o dado que importa, que
 * é onde há pergunta esperando resposta.
 *
 * Acima dos cartões fica a faixa de pendências, com as dúvidas mais antigas
 * ainda sem resposta. Antigo vem antes de recente de propósito: uma pergunta
 * de ontem sem resposta é normal, uma de duas semanas é abandono.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import api from '../../services/api'
import { contar, plural } from '../../utils/plural'
import { useAuth } from '../../contexts/AuthContext'

interface Post {
  id: string
  titulo: string
  conteudo: string
  disciplina: string
  disciplina_codigo: string
  autor_nome: string
  pontuacao: number
  total_respostas: number
  e_melhor: boolean
  restrito: boolean
  post_pai: string | null
  created_at: string
}

interface Disciplina {
  id: string
  codigo: string
  nome: string
  papel: string
}

const AZUL = 'var(--accent-blue)'

function tempoRelativo(valor: string): string {
  const minutos = Math.floor((Date.now() - new Date(valor).getTime()) / 60000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos}min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas}h`

  const dias = Math.floor(horas / 24)
  if (dias < 30) return `há ${dias}d`
  const meses = Math.floor(dias / 30)
  return `há ${meses} ${plural(meses, 'mês', 'meses')}`
}

function diasDesde(valor: string): number {
  return Math.floor((Date.now() - new Date(valor).getTime()) / 86400000)
}

/* ============================================================
   Cartão de disciplina
   ============================================================ */
function CartaoDisciplina({ disciplina, topicos, aoAbrir }: {
  disciplina: Disciplina
  topicos: Post[]
  aoAbrir: () => void
}) {
  const [hovered, setHovered] = useState(false)

  const semResposta = topicos.filter(t => t.total_respostas === 0).length
  const ultima = topicos[0]

  return (
    <button
      onClick={aoAbrir}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-xl text-left cursor-pointer"
      style={{
        padding: '18px 20px',
        background: 'var(--bg-card)',
        border: `1px solid ${hovered ? 'rgba(0,48,135,0.45)' : 'var(--border)'}`,
        boxShadow: hovered ? '0 8px 20px rgba(15,23,42,0.08)' : 'none',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        width: '100%',
      }}
    >
      <div className="flex items-start justify-between" style={{ gap: '12px' }}>
        <div className="min-w-0">
          <div className="font-semibold" style={{ fontSize: '14px', color: AZUL }}>
            {disciplina.codigo}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>
            {disciplina.nome}
          </div>
        </div>

        {disciplina.papel !== 'aluno' && (
          <span className="rounded flex-shrink-0" style={{
            padding: '2px 7px', fontSize: '10.5px', fontWeight: 600,
            background: 'rgba(0,48,135,0.07)', color: AZUL,
          }}>
            {disciplina.papel}
          </span>
        )}
      </div>

      <div className="flex items-center" style={{ gap: '18px' }}>
        <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {topicos.length}
          </strong>{' '}
          {plural(topicos.length, 'dúvida', 'dúvidas')}
        </span>

        {semResposta > 0 && (
          <span style={{ fontSize: '12.5px', color: AZUL, fontWeight: 500 }}>
            {semResposta} sem resposta
          </span>
        )}
      </div>

      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
        {ultima
          ? `Última: "${ultima.titulo.slice(0, 46)}${ultima.titulo.length > 46 ? '…' : ''}" ${tempoRelativo(ultima.created_at)}`
          : 'Nenhuma dúvida ainda'}
      </div>
    </button>
  )
}

/* ============================================================
   Linha de tópico
   ============================================================ */
function LinhaTopico({ post, mostrarDisciplina, aoAbrir }: {
  post: Post
  mostrarDisciplina?: boolean
  aoAbrir: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const semResposta = post.total_respostas === 0
  const dias = diasDesde(post.created_at)

  return (
    <button
      onClick={aoAbrir}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center text-left cursor-pointer rounded-xl w-full"
      style={{
        padding: '15px 18px', gap: '16px',
        background: hovered ? 'var(--bg-hover)' : 'var(--bg-card)',
        border: '1px solid var(--border)',
        transition: 'background 0.15s ease',
      }}
    >
      <div style={{ textAlign: 'center', minWidth: '46px' }}>
        <div
          className="font-semibold"
          style={{
            fontSize: '16px',
            fontVariantNumeric: 'tabular-nums',
            color: post.total_respostas > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
          }}
        >
          {post.total_respostas}
        </div>
        <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)' }}>
          resposta{post.total_respostas === 1 ? '' : 's'}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center" style={{ gap: '8px' }}>
          {mostrarDisciplina && (
            <span className="font-medium" style={{ fontSize: '11.5px', color: AZUL }}>
              {post.disciplina_codigo}
            </span>
          )}
          {post.e_melhor && (
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>resolvida</span>
          )}
          {post.restrito && (
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>restrita</span>
          )}
        </div>

        <div className="font-medium truncate" style={{ fontSize: '14px', color: 'var(--text-primary)', marginTop: '2px' }}>
          {post.titulo}
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
          {post.autor_nome} · {tempoRelativo(post.created_at)}
          {semResposta && dias >= 3 ? ` · aguardando há ${dias} dias` : ''}
        </div>
      </div>
    </button>
  )
}

/* ============================================================
   Página
   ============================================================ */
export default function ForumPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  /* O filtro mora na URL: o painel da coordenação e os cartões do professor
     chegam aqui já apontando uma disciplina. */
  const [parametros, setParametros] = useSearchParams()
  const disciplinaAtual = parametros.get('disciplina')
  const somenteSemResposta = parametros.get('sem_resposta') === '1'

  const [posts, setPosts] = useState<Post[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [buscaInput, setBuscaInput] = useState('')

  const disciplinas: Disciplina[] = useMemo(
    () => (user?.papeis_disciplina || []).map(vinculo => ({
      id: vinculo.disciplina_id,
      codigo: vinculo.disciplina_codigo,
      nome: vinculo.disciplina_nome,
      papel: vinculo.papel,
    })),
    [user]
  )

  function abrirDisciplina(id: string | null) {
    const novos = new URLSearchParams()
    if (id) novos.set('disciplina', id)
    setParametros(novos)
  }

  useEffect(() => {
    const temporizador = setTimeout(() => setBusca(buscaInput), 400)
    return () => clearTimeout(temporizador)
  }, [buscaInput])

  useEffect(() => {
    setCarregando(true)
    const params: Record<string, string> = { ordering: '-created_at', page_size: '100' }
    if (busca) params.search = busca

    api.get('/forum/posts/', { params })
      .then(res => {
        const dados = Array.isArray(res.data) ? res.data : res.data.results || []
        setPosts(dados.filter((p: Post) => !p.post_pai))
      })
      .catch(() => setPosts([]))
      .finally(() => setCarregando(false))
  }, [busca])

  const porDisciplina = useMemo(() => {
    const mapa: Record<string, Post[]> = {}
    posts.forEach(post => {
      (mapa[post.disciplina] ||= []).push(post)
    })
    return mapa
  }, [posts])

  /* Pendências: sem resposta, das mais antigas para as mais recentes.
     Uma pergunta de ontem sem resposta é normal; uma de duas semanas não. */
  const pendentes = useMemo(
    () => posts
      .filter(p => p.total_respostas === 0)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, 4),
    [posts]
  )

  const disciplinaEscolhida = disciplinas.find(d => d.id === disciplinaAtual)
  const ensina = !!user && (user.e_professor || user.e_coordenacao)

  const topicosVisiveis = disciplinaAtual
    ? (porDisciplina[disciplinaAtual] || []).filter(
        p => !somenteSemResposta || p.total_respostas === 0
      )
    : []

  const campoBusca = {
    minWidth: '220px', maxWidth: '340px', gap: '8px',
    padding: '9px 14px', borderRadius: '10px',
    background: 'var(--bg-input)', border: '1px solid var(--border)',
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Cabeçalho */}
      <div className="flex items-end justify-between" style={{ gap: '16px', marginBottom: '20px' }}>
        <div>
          <div className="flex items-center" style={{ gap: '10px' }}>
            {disciplinaAtual && (
              <button
                onClick={() => abrirDisciplina(null)}
                className="flex items-center justify-center rounded-lg cursor-pointer"
                style={{
                  width: '32px', height: '32px', background: 'var(--bg-card)',
                  border: '1px solid var(--border)', color: 'var(--text-secondary)',
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </button>
            )}

            <h1 className="font-bold tracking-tight" style={{ fontSize: '23px', color: 'var(--text-primary)' }}>
              {disciplinaEscolhida ? disciplinaEscolhida.codigo : 'Fórum acadêmico'}
            </h1>
          </div>

          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {disciplinaEscolhida
              ? `${disciplinaEscolhida.nome} · ${contar(topicosVisiveis.length, 'dúvida', 'dúvidas')}${somenteSemResposta ? ' sem resposta' : ''}`
              : 'Suas disciplinas e o que está sendo discutido em cada uma.'}
          </p>
        </div>

        {/* Publicar exige ter onde publicar. Sem vínculo com disciplina não há
            destino possível, e o botão levaria a um formulário com a lista de
            disciplinas vazia. */}
        {disciplinas.length > 0 && (
          <button
            onClick={() => navigate(
              disciplinaAtual ? `/forum/novo?disciplina=${disciplinaAtual}` : '/forum/novo'
            )}
            className="flex items-center rounded-xl font-medium cursor-pointer text-white flex-shrink-0"
            style={{ padding: '10px 18px', gap: '8px', fontSize: '13.5px', border: 'none', background: AZUL }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {/* Quem leciona não tira dúvida com a própria turma: publica aviso,
                material ou orientação. O rótulo acompanha o papel. */}
            {ensina ? 'Nova publicação' : 'Nova dúvida'}
          </button>
        )}
      </div>

      {/* Busca */}
      <div className="flex items-center" style={{ ...campoBusca, marginBottom: '20px' }}>
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar em todas as suas disciplinas..."
          value={buscaInput}
          onChange={e => setBuscaInput(e.target.value)}
          className="flex-1 bg-transparent outline-none"
          style={{ fontSize: '13px', color: 'var(--text-primary)' }}
        />
      </div>

      {carregando ? (
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>Carregando fórum...</p>
      ) : disciplinaAtual ? (
        /* ---------- Dentro de uma disciplina ---------- */
        topicosVisiveis.length === 0 ? (
          <div className="rounded-xl text-center" style={{
            padding: '48px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)',
          }}>
            <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '5px' }}>
              Nenhuma dúvida por aqui
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
              Seja a primeira pessoa a perguntar nesta disciplina.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topicosVisiveis.map(post => (
              <LinhaTopico key={post.id} post={post} aoAbrir={() => navigate(`/forum/${post.id}`)} />
            ))}
          </div>
        )
      ) : (
        /* ---------- Visão geral ---------- */
        <>
          {/* A faixa de espera é sobre as turmas de quem está olhando. Para
              quem não tem vínculo, ela trazia dúvidas de disciplinas alheias —
              o servidor devolve tudo a quem administra, e a tela mostrava sem
              perguntar de quem era. */}
          {pendentes.length > 0 && !busca && disciplinas.length > 0 && (
            <section style={{ marginBottom: '24px' }}>
              <h2 className="font-semibold" style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Esperando resposta
              </h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
                Dúvidas que ainda não receberam nenhuma resposta, das mais antigas primeiro.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pendentes.map(post => (
                  <LinhaTopico
                    key={post.id}
                    post={post}
                    mostrarDisciplina
                    aoAbrir={() => navigate(`/forum/${post.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {busca ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {posts.length === 0 ? (
                <p style={{ fontSize: '13.5px', color: 'var(--text-tertiary)' }}>
                  Nada encontrado para "{busca}".
                </p>
              ) : posts.map(post => (
                <LinhaTopico
                  key={post.id}
                  post={post}
                  mostrarDisciplina
                  aoAbrir={() => navigate(`/forum/${post.id}`)}
                />
              ))}
            </div>
          ) : (
            <section>
              <h2 className="font-semibold" style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '10px' }}>
                Suas disciplinas
              </h2>

              {disciplinas.length === 0 ? (
                <div className="rounded-xl text-center" style={{
                  padding: '48px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)',
                }}>
                  <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Você ainda não está em nenhuma disciplina
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                    A coordenação do curso faz essa vinculação a cada semestre.
                  </p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))',
                  gap: '12px',
                }}>
                  {disciplinas.map(disciplina => (
                    <CartaoDisciplina
                      key={disciplina.id}
                      disciplina={disciplina}
                      topicos={porDisciplina[disciplina.id] || []}
                      aoAbrir={() => abrirDisciplina(disciplina.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}
