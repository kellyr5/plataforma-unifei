/**
 * VoluntariadoPage — Listagem de oportunidades de voluntariado.
 *
 * Funcionalidades:
 * - Filtro por area de atuacao
 * - Busca por titulo
 * - Cards com vagas, local, carga horaria, barra de progresso
 * - Botao de inscrever-se
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { SeloOrganizacao } from '../../components/ui/SeloOrganizacao'

interface Oportunidade {
  id: string
  titulo: string
  descricao: string
  area: string
  area_display: string
  local: string
  carga_horaria_total: number
  vagas: number
  vagas_disponiveis: number
  data_inicio: string
  data_fim: string
  prazo_inscricao: string
  esta_aberta_inscricao: boolean
  organizacao_nome: string
  /* Logotipo de quem publica. Quem procura voluntariado reconhece a
     instituição pela marca antes de ler o nome. */
  organizacao_foto_url: string | null
  requer_aprovacao: boolean
  created_at: string
  imagem_url: string | null
  /* Situação da inscrição de quem está vendo, quando existir. É uma por
     pessoa em cada vaga, então a tela precisa saber antes de oferecer o
     botão. */
  minha_inscricao: string | null
}

const SITUACAO_ROTULO: Record<string, string> = {
  pendente: 'Inscrição enviada',
  aprovada: 'Você participa desta ação',
  concluida: 'Participação concluída',
  rejeitada: 'Inscrição não aceita',
  removida: 'Você foi removido desta ação',
  desistente: 'Você desistiu desta ação',
}

/* A lista de áreas saiu junto com o filtro por tema. Ver o comentário no bloco
   de filtros sobre por que a busca por texto cobre melhor esse caso.

   Área é classificação, não julgamento: um tom neutro para todas. Ver a nota
   em DashboardPage sobre por que a cor por área foi removida. */
const CorArea = 'var(--text-secondary)'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function OpCard({ op, onClick }: { op: Oportunidade; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const cor = CorArea
  const preenchidas = op.vagas - op.vagas_disponiveis
  const porcent = op.vagas > 0 ? (preenchidas / op.vagas) * 100 : 0

  return (
    <div
      className="rounded-xl cursor-pointer"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--bg-card)',
        /* Sem concatenar transparência ao fim da cor — com variável CSS isso
           invalida a declaração inteira e o cartão fica sem borda. */
        border: `1px solid ${hovered ? 'var(--accent-blue-border)' : 'var(--border)'}`,
        /* Ação encerrada continua legível, mas recua um passo: quem procura
           onde se inscrever precisa distinguir uma da outra de relance. */
        opacity: op.esta_aberta_inscricao ? 1 : 0.72,
        transition: 'border-color 0.2s ease, opacity 0.2s ease',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Capa. Quando a organização não enviou imagem, um bloco na cor da
          área mantém o ritmo visual da grade em vez de deixar um buraco. */}
      <div style={{ position: 'relative', height: '128px', overflow: 'hidden' }}>
        {op.imagem_url ? (
          <img
            src={op.imagem_url}
            alt=""
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              transform: hovered ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 0.4s ease',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            /* Sem concatenar transparência ao fim da cor: isso só funciona
               com hexadecimal, e com variável CSS invalida a declaração
               inteira — o bloco fica transparente e a capa some. */
            background: 'var(--bg-input)',
          }} />
        )}

        <span
          className="rounded-md"
          style={{
            position: 'absolute', top: '10px', left: '12px',
            padding: '3px 10px', fontSize: '11px', fontWeight: 600,
            background: 'rgba(255,255,255,0.92)', color: cor,
            backdropFilter: 'blur(4px)',
          }}
        >
          {op.area_display}
        </span>

        {/* A situação da própria inscrição vem antes do estado da ação: para
            quem participou, "Participação concluída" diz mais do que
            "Encerrada". */}
        {op.minha_inscricao ? (
          <span
            className="rounded-md"
            style={{
              position: 'absolute', top: '10px', right: '12px',
              padding: '3px 10px', fontSize: '11px', fontWeight: 600,
              background: 'rgba(0,48,135,0.92)', color: 'white',
            }}
          >
            {SITUACAO_ROTULO[op.minha_inscricao] || 'Inscrito'}
          </span>
        ) : !op.esta_aberta_inscricao && (
          <span
            className="rounded-md"
            style={{
              position: 'absolute', top: '10px', right: '12px',
              padding: '3px 10px', fontSize: '11px', fontWeight: 600,
              background: 'rgba(255,255,255,0.92)', color: 'var(--text-secondary)',
            }}
          >
            Encerrada
          </span>
        )}
      </div>

      <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Titulo */}
      <div className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.4 }}>
        {op.titulo}
      </div>

      {/* Quem publica. O logotipo vem antes do nome porque é o que identifica
          a instituição num relance; sem imagem enviada, as iniciais ocupam o
          mesmo espaço e o alinhamento da grade não muda. */}
      <div className="flex items-center" style={{ gap: '9px', marginBottom: '14px' }}>
        <SeloOrganizacao nome={op.organizacao_nome} foto={op.organizacao_foto_url} />
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {op.organizacao_nome}
        </span>
      </div>

      {/* Info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
        <div className="flex items-center" style={{ gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          {op.local}
        </div>
        <div className="flex items-center" style={{ gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {op.carga_horaria_total} horas | {formatDate(op.data_inicio)} a {formatDate(op.data_fim)}
        </div>
        <div className="flex items-center" style={{ gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          {preenchidas} de {op.vagas} vagas preenchidas
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="rounded-full" style={{ height: '4px', background: 'var(--border)' }}>
        <div className="rounded-full transition-all duration-500" style={{ height: '4px', background: cor, width: `${porcent}%` }} />
      </div>

      {/* Aprovacao */}
      {op.requer_aprovacao && (
        <div className="flex items-center" style={{ gap: '4px', marginTop: '10px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          Requer aprovação da organização
        </div>
      )}
      </div>
    </div>
  )
}

export default function VoluntariadoPage() {
  const navigate = useNavigate()
  const [todas, setTodas] = useState<Oportunidade[]>([])
  const [situacao, setSituacao] = useState<'abertas' | 'encerradas' | 'todas'>('abertas')
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [buscaInput, setBuscaInput] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setBusca(buscaInput), 400)
    return () => clearTimeout(timer)
  }, [buscaInput])

  useEffect(() => {
    setLoading(true)

    const params: Record<string, string> = { ordering: '-created_at' }
    if (busca) params.search = busca

    api.get('/voluntariado/oportunidades/', { params }).then(res => {
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      setTodas(data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [busca])

  /**
   * Recorte por situação da inscrição.
   *
   * A tela mostrava apenas o que estava aberto, e a decisão tinha uma razão:
   * oferecer ao estudante algo em que ele não pode entrar é frustrante. Mas
   * esconder o que encerrou tem custo próprio — quem participou de uma ação
   * perdia o caminho para ela, e quem chega ao fim do prazo não entende se a
   * vaga sumiu ou nunca existiu.
   *
   * A escolha explícita resolve os dois: abre nas disponíveis, que é o caso
   * comum, e deixa as encerradas a um clique.
   */
  const oportunidades = useMemo(() => {
    if (situacao === 'encerradas') {
      return todas.filter(op => !op.esta_aberta_inscricao)
    }

    if (situacao === 'abertas') {
      return todas.filter(op => op.esta_aberta_inscricao)
    }

    return todas
  }, [todas, situacao])

  const abertas = todas.filter(op => op.esta_aberta_inscricao).length
  const encerradas = todas.length - abertas

  return (
    <div style={{ maxWidth: '1000px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 className="font-bold tracking-tight" style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '4px' }}>
          Voluntariado
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          {oportunidades.length}
          {oportunidades.length === 1 ? ' oportunidade' : ' oportunidades'}
          {situacao === 'abertas' ? ' com inscrições abertas'
            : situacao === 'encerradas' ? ' com inscrições encerradas'
            : ' cadastradas'}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex items-center" style={{ gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div className="flex items-center flex-1" style={{
          minWidth: '200px', maxWidth: '320px', gap: '8px',
          padding: '8px 14px', borderRadius: '10px',
          background: 'var(--bg-input)', border: '1px solid var(--border)',
        }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input type="text" placeholder="Buscar oportunidades..." value={buscaInput}
            onChange={e => setBuscaInput(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: '13px', color: 'var(--text-primary)' }} />
        </div>

        {/* Sem filtro por área: são poucas oportunidades por vez, e recortar
            por tema esconde vagas que o aluno aceitaria se tivesse visto.
            A busca por texto cobre quem já sabe o que procura.

            O filtro de situação existe por outro motivo: quem participou de
            uma ação encerrada precisa de um caminho de volta até ela. */}
        <div className="flex items-center flex-wrap" style={{ gap: '7px' }}>
          {([
            ['abertas', 'Abertas', abertas],
            ['encerradas', 'Encerradas', encerradas],
            ['todas', 'Todas', todas.length],
          ] as const).map(([chave, rotulo, total]) => (
            <button
              key={chave}
              onClick={() => setSituacao(chave)}
              aria-pressed={situacao === chave}
              className="flex items-center rounded-lg cursor-pointer"
              style={{
                padding: '8px 14px', gap: '7px', fontSize: '13px', fontWeight: 500,
                background: situacao === chave ? 'var(--accent-blue)' : 'var(--bg-card)',
                color: situacao === chave ? '#FFFFFF' : 'var(--text-secondary)',
                border: `1px solid ${situacao === chave ? 'var(--accent-blue)' : 'var(--border)'}`,
              }}
            >
              {rotulo}
              <span style={{
                padding: '0 6px', borderRadius: '9px', fontSize: '11px',
                background: situacao === chave ? 'rgba(255,255,255,0.22)' : 'var(--bg-input)',
              }}>
                {total}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ height: '200px' }}>
          <div className="flex items-center" style={{ gap: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Carregando oportunidades...
          </div>
        </div>
      ) : oportunidades.length === 0 ? (
        <div className="rounded-xl text-center" style={{ padding: '48px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Nenhuma oportunidade encontrada
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Tente outro filtro ou busca.</p>
        </div>
      ) : (
        /* Duas colunas declaradas viravam duas colunas de cento e cinquenta
           pixels no telefone, e o título da oportunidade descia uma palavra
           por linha. O mínimo de 300 pixels é a largura em que o cartão ainda
           mostra título, organização, local e período sem quebrar. */
        <div
          className="grid"
          style={{
            gap: '14px',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          }}
        >
          {oportunidades.map(op => (
            <OpCard key={op.id} op={op} onClick={() => navigate(`/voluntariado/${op.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}
