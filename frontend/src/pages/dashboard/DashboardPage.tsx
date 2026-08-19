/**
 * DashboardPage — Página inicial de quem estuda.
 *
 * A tela responde a três perguntas, nesta ordem: o que está esperando resposta,
 * o que aconteceu desde a última visita, e onde eu estava. Tudo o mais é
 * secundário e desce na página.
 *
 * Sobre a reformulação visual: a versão anterior inclinava os cartões em três
 * dimensões conforme o mouse, deslocava as linhas ao passar por cima e cercava
 * cada número de um anel de progresso. Os anéis mediam contra um total
 * inventado — cinco dúvidas de vinte, sendo que vinte não significa nada — e a
 * inclinação, além de distrair, desalinha o texto durante a leitura. Uma
 * plataforma acadêmica institucional ganha mais com densidade e alinhamento do
 * que com efeito. O que sobrou de movimento é a mudança de fundo ao passar o
 * mouse, que existe para indicar o que é clicável.
 */

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
  imagem_url: string | null
}

interface Andamento {
  disciplina_codigo: string; disciplina_nome: string; total_posts: number
  total_respostas: number; total_melhores_respostas: number
}

interface Notificacao { id: string; titulo: string; lida: boolean; created_at: string }

function tempoRelativo(valor: string): string {
  const minutos = Math.floor((Date.now() - new Date(valor).getTime()) / 60000)

  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} h`

  const dias = Math.floor(horas / 24)
  if (dias < 30) return `há ${dias} d`

  return new Date(valor).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/* ============================================================
   Blocos de construção
   ============================================================ */

/**
 * Cartão.
 *
 * Superfície plana com borda de um pixel, sem sombra nem transformação. A
 * hierarquia da página vem do espaçamento e do peso do texto, não de camadas
 * de profundidade — que, num tema escuro, deixam de funcionar de qualquer
 * forma, porque não há luz para projetar sombra.
 */
function Cartao({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </section>
  )
}

function CabecalhoCartao({ titulo, acao, aoClicar }: {
  titulo: string
  acao?: string
  aoClicar?: () => void
}) {
  return (
    <header
      className="flex items-center justify-between"
      style={{
        padding: '15px 18px 13px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <h2 className="font-semibold" style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>
        {titulo}
      </h2>
      {acao && aoClicar && (
        <button
          onClick={aoClicar}
          className="cursor-pointer font-medium"
          style={{
            fontSize: '12px', color: 'var(--accent-blue-text)',
            background: 'none', border: 'none', padding: 0,
          }}
        >
          {acao}
        </button>
      )}
    </header>
  )
}

function Vazio({ texto }: { texto: string }) {
  return (
    <p className="text-center" style={{
      padding: '26px 20px', fontSize: '12.5px',
      color: 'var(--text-tertiary)', lineHeight: 1.6,
    }}>
      {texto}
    </p>
  )
}

/** Linha clicável genérica, com o realce de passagem do mouse padronizado. */
function Linha({ children, aoClicar, ultima }: {
  children: React.ReactNode
  aoClicar?: () => void
  ultima?: boolean
}) {
  const [sobre, setSobre] = useState(false)

  return (
    <div
      onClick={aoClicar}
      onMouseEnter={() => setSobre(true)}
      onMouseLeave={() => setSobre(false)}
      className={aoClicar ? 'cursor-pointer' : ''}
      style={{
        padding: '12px 18px',
        borderBottom: ultima ? 'none' : '1px solid var(--border)',
        background: sobre && aoClicar ? 'var(--bg-hover)' : 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      {children}
    </div>
  )
}

/* ============================================================
   Linhas específicas
   ============================================================ */

function LinhaTopico({ post, ultima, aoClicar }: {
  post: Post; ultima: boolean; aoClicar: () => void
}) {
  const respondido = (post.total_respostas || 0) > 0

  return (
    <Linha aoClicar={aoClicar} ultima={ultima}>
      <div className="flex items-start justify-between" style={{ gap: '14px' }}>
        <div className="flex-1 min-w-0">
          <p className="font-medium" style={{
            fontSize: '13px', color: 'var(--text-primary)',
            lineHeight: 1.45, marginBottom: '4px',
          }}>
            {post.titulo || post.conteudo?.substring(0, 80)}
          </p>

          <div className="flex items-center" style={{ gap: '9px', fontSize: '11.5px' }}>
            {post.disciplina_codigo && (
              <span className="font-semibold" style={{ color: 'var(--accent-blue-text)' }}>
                {post.disciplina_codigo}
              </span>
            )}
            <span style={{ color: 'var(--text-tertiary)' }}>
              {tempoRelativo(post.created_at)}
            </span>
          </div>
        </div>

        {/* O que interessa a quem estuda não é a pontuação, é se alguém já
            respondeu. O contador de votos ocupava a coluna da esquerda em
            todas as linhas exibindo zero, sem dizer nada. */}
        <span
          className="flex-shrink-0 rounded-md"
          style={{
            padding: '2px 8px', fontSize: '11px', fontWeight: 500,
            whiteSpace: 'nowrap', marginTop: '1px',
            background: respondido ? 'var(--accent-blue-soft)' : 'transparent',
            color: respondido ? 'var(--accent-blue-text)' : 'var(--text-tertiary)',
            border: `1px solid ${respondido ? 'var(--accent-blue-border)' : 'var(--border)'}`,
          }}
        >
          {respondido
            ? `${post.total_respostas} resposta${post.total_respostas > 1 ? 's' : ''}`
            : 'sem resposta'}
        </span>
      </div>
    </Linha>
  )
}

function LinhaOportunidade({ op, ultima, aoClicar }: {
  op: Oportunidade; ultima: boolean; aoClicar: () => void
}) {
  const preenchidas = op.vagas - op.vagas_disponiveis
  const proporcao = op.vagas > 0 ? (preenchidas / op.vagas) * 100 : 0

  return (
    <Linha aoClicar={aoClicar} ultima={ultima}>
      <div className="flex items-start" style={{ gap: '12px' }}>
        {/* Capa da ação. A lista era só texto, e a imagem já existia no
            cadastro — quem procura voluntariado reconhece a ação pela foto
            antes de ler o título. */}
        {op.imagem_url ? (
          <img
            src={op.imagem_url}
            alt=""
            style={{
              width: '56px', height: '42px', objectFit: 'cover',
              borderRadius: '7px', flexShrink: 0, display: 'block',
              border: '1px solid var(--border)',
            }}
          />
        ) : (
          <span
            aria-hidden="true"
            style={{
              width: '56px', height: '42px', borderRadius: '7px', flexShrink: 0,
              background: 'var(--bg-input)', border: '1px solid var(--border)',
            }}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between" style={{ gap: '12px', marginBottom: '7px' }}>
            <div className="min-w-0">
              <p className="font-medium" style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                {op.titulo}
              </p>
              <p style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                {op.area_display} · {op.local} · {op.carga_horaria_total} h
              </p>
            </div>

            {/* Contagem de vagas preenchidas, e não de disponíveis.
                Antes dizia "0 de 20 vagas" para uma ação lotada — o número
                era o de vagas livres, mas o texto se lia como se nada
                estivesse ocupado, ainda por cima ao lado de uma barra cheia.
                A página de detalhe já falava em preenchidas; as duas telas
                agora contam a mesma coisa. */}
            <span className="flex-shrink-0" style={{ fontSize: '11.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {op.vagas_disponiveis === 0
                ? 'sem vagas'
                : `${preenchidas} de ${op.vagas} preenchidas`}
            </span>
          </div>

          <div className="rounded-full" style={{ height: '3px', background: 'var(--bg-input)' }}>
            <div
              className="rounded-full"
              style={{
                height: '3px', width: `${proporcao}%`,
                background: 'var(--accent-blue)', transition: 'width 0.6s ease',
              }}
            />
          </div>
        </div>
      </div>
    </Linha>
  )
}

function AtalhoRapido({ rotulo, icone, aoClicar }: {
  rotulo: string; icone: React.ReactNode; aoClicar: () => void
}) {
  const [sobre, setSobre] = useState(false)

  return (
    <button
      onClick={aoClicar}
      onMouseEnter={() => setSobre(true)}
      onMouseLeave={() => setSobre(false)}
      className="flex items-center w-full rounded-lg cursor-pointer"
      style={{
        padding: '10px 12px', gap: '11px', textAlign: 'left', fontSize: '13px',
        color: 'var(--text-primary)',
        background: sobre ? 'var(--bg-hover)' : 'var(--bg-input)',
        border: '1px solid transparent',
        transition: 'background 0.15s ease',
      }}
    >
      <span className="flex items-center justify-center flex-shrink-0" style={{
        width: '24px', height: '24px', color: 'var(--text-tertiary)',
      }}>
        {icone}
      </span>
      {rotulo}
    </button>
  )
}

/* ============================================================
   Página
   ============================================================ */
export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [posts, setPosts] = useState<Post[]>([])
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [andamento, setAndamento] = useState<Andamento[]>([])
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [naoLidas, setNaoLidas] = useState(0)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      /* allSettled em vez de all: um endereço fora do ar não pode apagar a
         página inteira, apenas o cartão que dependia dele. */
      const [p, o, a, n, nl] = await Promise.allSettled([
        api.get('/forum/posts/', { params: { ordering: '-created_at' } }),
        api.get('/voluntariado/oportunidades/', { params: { status: 'ativa', ordering: '-created_at' } }),
        api.get('/forum/andamento/'),
        api.get('/notificacoes/', { params: { ordering: '-created_at' } }),
        api.get('/notificacoes/nao-lidas/'),
      ])

      if (p.status === 'fulfilled') {
        const dados = p.value.data
        const lista: Post[] = Array.isArray(dados) ? dados : dados.results || []

        /* Sem resposta primeiro: é o que ainda depende de alguém. */
        setPosts(
          lista
            .filter(item => !item.post_pai)
            .sort((x, y) => (x.total_respostas || 0) - (y.total_respostas || 0))
            .slice(0, 5)
        )
      }

      if (o.status === 'fulfilled') {
        const dados = o.value.data
        setOportunidades((Array.isArray(dados) ? dados : dados.results || []).slice(0, 4))
      }

      if (a.status === 'fulfilled') {
        setAndamento(Array.isArray(a.value.data) ? a.value.data : [])
      }

      if (n.status === 'fulfilled') {
        const dados = n.value.data
        const lista: Notificacao[] = Array.isArray(dados) ? dados : dados.results || []
        setNotificacoes(lista.filter(item => !item.lida).slice(0, 4))
      }

      if (nl.status === 'fulfilled') {
        setNaoLidas(nl.value.data.total || nl.value.data.count || 0)
      }

      setCarregando(false)
    }

    carregar()
  }, [])

  const totalTopicos = andamento.reduce((soma, r) => soma + r.total_posts, 0)
  const totalRespostas = andamento.reduce((soma, r) => soma + r.total_respostas, 0)
  const totalAjudaram = andamento.reduce((soma, r) => soma + r.total_melhores_respostas, 0)
  const semResposta = posts.filter(p => (p.total_respostas || 0) === 0).length
  const primeiroNome = user?.nome_completo?.split(' ')[0] || ''

  if (carregando) {
    return (
      <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
        Carregando seu painel...
      </p>
    )
  }

  const grade = {
    display: 'grid',
    gap: '16px',
    marginBottom: '16px',
  } as const

  return (
    <div style={{ maxWidth: '1100px' }}>

      {/* ===== Faixa de abertura =====
          Azul institucional sólido. O gradiente anterior misturava três azuis
          fixos no código, que não acompanhavam a troca de tema. */}
      <div
        className="rounded-xl"
        style={{
          padding: 'clamp(18px, 4vw, 24px) clamp(18px, 5vw, 28px)',
          marginBottom: '16px',
          background: 'var(--accent-blue)',
        }}
      >
        <h1 className="font-semibold text-white" style={{ fontSize: '20px', marginBottom: '4px' }}>
          Olá, {primeiroNome}
        </h1>
        <p style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.72)' }}>
          {semResposta > 0
            ? `Você tem ${semResposta} dúvida${semResposta > 1 ? 's' : ''} ainda sem resposta.`
            : 'Suas dúvidas foram respondidas.'}
        </p>

        {/* Números diretos, sem anel de progresso. O anel comparava cada valor
            com um total arbitrário, e a proporção resultante não descrevia
            nada que existisse. */}
        {/* Quatro números com espaçamento fixo de 38 pixels somavam mais que a
            largura de um telefone, e o último saía da faixa. Com quebra de
            linha eles se reorganizam em duas fileiras. */}
        <div
          className="flex items-center flex-wrap"
          style={{ gap: '22px 32px', marginTop: '22px' }}
        >
          {([
            [totalTopicos, 'dúvidas publicadas'],
            [totalRespostas, 'respostas dadas'],
            [totalAjudaram, 'respostas que ajudaram'],
            [naoLidas, 'notificações não lidas'],
          ] as const).map(([valor, rotulo]) => (
            <div key={rotulo}>
              <div className="font-bold text-white" style={{ fontSize: '24px', lineHeight: 1.1 }}>
                {valor}
              </div>
              <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.6)', marginTop: '3px' }}>
                {rotulo}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Primeira linha ===== */}
      {/* auto-fit no lugar de duas colunas declaradas.
          Com a proporcao fixa, as colunas continuavam existindo num telefone:
          cada cartao recebia cerca de cento e cinquenta pixels, e o titulo de
          uma duvida quebrava uma letra por linha. Agora a segunda coluna so
          aparece quando ha largura para os 280 pixels minimos. */}
      <div style={{ ...grade, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <Cartao>
          <CabecalhoCartao titulo="Suas dúvidas" acao="Ver fórum" aoClicar={() => navigate('/forum')} />
          {posts.length === 0 ? (
            <Vazio texto="Você ainda não publicou nenhuma dúvida. Quando publicar, ela aparece aqui até ser respondida." />
          ) : (
            posts.map((post, indice) => (
              <LinhaTopico
                key={post.id}
                post={post}
                ultima={indice === posts.length - 1}
                aoClicar={() => navigate(`/forum/${post.id}`)}
              />
            ))
          )}
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Voluntariado" acao="Ver todas" aoClicar={() => navigate('/voluntariado')} />
          {oportunidades.length === 0 ? (
            <Vazio texto="Nenhuma oportunidade com inscrições abertas no momento." />
          ) : (
            oportunidades.map((op, indice) => (
              <LinhaOportunidade
                key={op.id}
                op={op}
                ultima={indice === oportunidades.length - 1}
                aoClicar={() => navigate(`/voluntariado/${op.id}`)}
              />
            ))
          )}
        </Cartao>
      </div>

      {/* ===== Segunda linha ===== */}
      <div style={{ ...grade, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: 0 }}>
        <Cartao>
          <CabecalhoCartao titulo="Por disciplina" acao="Ver tudo" aoClicar={() => navigate('/andamento')} />
          {andamento.length === 0 ? (
            <Vazio texto="Participe do fórum para acompanhar seu percurso por disciplina." />
          ) : (
            andamento.map((item, indice) => (
              <Linha key={item.disciplina_codigo} ultima={indice === andamento.length - 1}>
                <div className="flex items-center justify-between" style={{ gap: '12px' }}>
                  <div className="min-w-0">
                    <div className="font-semibold" style={{ fontSize: '12.5px', color: 'var(--accent-blue-text)' }}>
                      {item.disciplina_codigo}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      {item.total_respostas}
                      {item.total_respostas === 1 ? ' resposta' : ' respostas'}
                      {' · '}{item.total_melhores_respostas} ajudaram
                    </div>
                  </div>
                  <span className="font-bold flex-shrink-0" style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                    {item.total_posts}
                  </span>
                </div>
              </Linha>
            ))
          )}
        </Cartao>

        <Cartao>
          <CabecalhoCartao
            titulo="Notificações"
            acao={naoLidas > 0 ? `${naoLidas} não lidas` : 'Ver todas'}
            aoClicar={() => navigate('/notificacoes')}
          />
          {notificacoes.length === 0 ? (
            <Vazio texto="Nenhuma notificação pendente." />
          ) : (
            notificacoes.map((notif, indice) => (
              <Linha
                key={notif.id}
                ultima={indice === notificacoes.length - 1}
                aoClicar={() => navigate('/notificacoes')}
              >
                <div className="flex items-start" style={{ gap: '10px' }}>
                  <span className="rounded-full flex-shrink-0" style={{
                    width: '6px', height: '6px', marginTop: '5px',
                    background: 'var(--accent-blue)',
                  }} />
                  <span className="flex-1 min-w-0" style={{
                    fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.45,
                  }}>
                    {notif.titulo}
                  </span>
                  <span className="flex-shrink-0" style={{
                    fontSize: '10.5px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap',
                  }}>
                    {tempoRelativo(notif.created_at)}
                  </span>
                </div>
              </Linha>
            ))
          )}
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Acesso rápido" />
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <AtalhoRapido
              rotulo="Publicar uma dúvida"
              aoClicar={() => navigate('/forum/novo')}
              icone={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>}
            />
            <AtalhoRapido
              rotulo="Meus trabalhos em grupo"
              aoClicar={() => navigate('/trabalhos')}
              icone={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}
            />
            <AtalhoRapido
              rotulo="Meus certificados"
              aoClicar={() => navigate('/certificados')}
              icone={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
            />
            <AtalhoRapido
              rotulo="Meu perfil"
              aoClicar={() => navigate('/perfil')}
              icone={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>}
            />
          </div>
        </Cartao>
      </div>
    </div>
  )
}
