/**
 * PainelDocente — Página inicial de quem leciona ou monitora.
 *
 * Serve ao professor e ao monitor, com a mesma estrutura e recortes
 * diferentes: o professor vê as disciplinas em que leciona, o monitor vê
 * apenas as que monitora, na aba própria.
 *
 * A tela responde a uma pergunta só: o que está esperando por mim. Por isso
 * cada disciplina é um cartão com as pendências em destaque, ordenado por
 * dúvidas sem resposta. Três dúvidas paradas há dias importam mais do que
 * trinta já respondidas, e uma lista alfabética esconderia exatamente isso.
 *
 * O vocabulário é o de quem ensina. Não há "colegas" nem pontuação: há turma,
 * dúvidas sem resposta e denúncias a analisar.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

interface DisciplinaDocente {
  disciplina_id: string
  codigo: string
  nome: string
  periodo_sugerido: number | null
  semestre: string
  meu_papel: 'professor' | 'monitor'
  matriculados: number
  total_topicos: number
  sem_resposta: number
  respondi: number
  ultima_atividade: string | null
  denuncias_pendentes: number
}

interface Resumo {
  disciplinas: number
  sem_resposta: number
  denuncias_pendentes: number
  matriculados: number
}

const AZUL = 'var(--accent-blue)'

function tempoDesde(valor: string | null): string {
  if (!valor) return 'sem movimento'

  const dias = Math.floor((Date.now() - new Date(valor).getTime()) / 86400000)
  if (dias < 1) return 'hoje'
  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`
  const meses = Math.floor(dias / 30)
  return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`
}

function Metrica({ valor, rotulo, destaque }: {
  valor: number; rotulo: string; destaque?: boolean
}) {
  return (
    <div style={{ minWidth: '84px' }}>
      <div
        className="font-semibold"
        style={{
          fontSize: '19px', lineHeight: 1.15,
          fontVariantNumeric: 'tabular-nums',
          color: destaque && valor > 0 ? AZUL : 'var(--text-primary)',
        }}
      >
        {valor}
      </div>
      <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
        {rotulo}
      </div>
    </div>
  )
}

function Acao({ rotulo, onClick, primario }: {
  rotulo: string; onClick: () => void; primario?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-md cursor-pointer"
      style={{
        padding: '6px 12px', fontSize: '12.5px', fontWeight: 500,
        whiteSpace: 'nowrap',
        color: primario ? '#FFFFFF' : (hovered ? AZUL : 'var(--text-secondary)'),
        background: primario ? AZUL : (hovered ? 'var(--bg-hover)' : 'transparent'),
        border: `1px solid ${primario ? AZUL : 'var(--border)'}`,
        transition: 'all 0.15s ease',
      }}
    >
      {rotulo}
    </button>
  )
}

function CartaoDisciplina({ item, navegar }: {
  item: DisciplinaDocente
  navegar: (destino: string) => void
}) {
  const temPendencia = item.sem_resposta > 0 || item.denuncias_pendentes > 0

  return (
    <article
      className="rounded-xl"
      style={{
        padding: '18px 20px',
        background: 'var(--bg-card)',
        border: `1px solid ${temPendencia ? 'rgba(0,48,135,0.28)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-start justify-between" style={{ gap: '16px' }}>
        <div className="min-w-0">
          <div className="flex items-center" style={{ gap: '8px' }}>
            <span className="font-semibold" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
              {item.codigo}
            </span>
            {/* Sem etiqueta de período: quem leciona conhece a matriz. */}
            {item.meu_papel === 'monitor' && (
              <span className="rounded" style={{
                padding: '1px 6px', fontSize: '10.5px', fontWeight: 600,
                background: 'rgba(0,48,135,0.07)', color: AZUL,
              }}>
                monitoria
              </span>
            )}
          </div>

          <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
            {item.nome}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
            {item.matriculados} matriculado{item.matriculados === 1 ? '' : 's'}
            {' · '}última movimentação {tempoDesde(item.ultima_atividade)}
          </div>
        </div>

        <div className="flex items-start flex-shrink-0" style={{ gap: '18px' }}>
          <Metrica valor={item.sem_resposta} rotulo="sem resposta" destaque />
          <Metrica valor={item.total_topicos} rotulo="dúvidas" />
          <Metrica valor={item.respondi} rotulo="respondi" />
          <Metrica valor={item.denuncias_pendentes} rotulo="denúncias" destaque />
        </div>
      </div>

      <div
        className="flex items-center"
        style={{
          gap: '8px', marginTop: '14px', paddingTop: '14px',
          borderTop: '1px solid var(--border)',
        }}
      >
        {item.sem_resposta > 0 && (
          <Acao
            rotulo={
              item.sem_resposta === 1
                ? 'Responder 1 pendente'
                : `Responder ${item.sem_resposta} pendentes`
            }
            primario
            onClick={() => navegar(`/forum?disciplina=${item.disciplina_id}&sem_resposta=1`)}
          />
        )}

        <Acao
          rotulo="Abrir fórum"
          onClick={() => navegar(`/forum?disciplina=${item.disciplina_id}`)}
        />

        <Acao
          rotulo={
            item.denuncias_pendentes > 0
              ? `Moderação (${item.denuncias_pendentes})`
              : 'Moderação'
          }
          onClick={() => navegar(`/moderacao?disciplina=${item.disciplina_id}`)}
        />

        <Acao
          rotulo="Publicar material"
          onClick={() => navegar(`/forum/novo?disciplina=${item.disciplina_id}`)}
        />
      </div>
    </article>
  )
}

export default function PainelDocente({ papel }: { papel?: 'professor' | 'monitor' }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [disciplinas, setDisciplinas] = useState<DisciplinaDocente[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const buscar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const params = papel ? { papel } : {}
      const { data } = await api.get('/forum/minhas-disciplinas/', { params })
      setDisciplinas(data.disciplinas || [])
      setResumo(data.resumo || null)
    } catch (err: any) {
      /* Falha de servidor precisa aparecer. Tratar erro como lista vazia faz
         a tela mentir: o usuário conclui que não tem disciplina quando o que
         houve foi a requisição quebrar. */
      setDisciplinas([])
      setResumo(null)
      setErro(
        err.response?.status
          ? `A consulta falhou (erro ${err.response.status}). Recarregue a página; se persistir, avise a coordenação.`
          : 'Não foi possível falar com o servidor.'
      )
    } finally {
      setCarregando(false)
    }
  }, [papel])

  useEffect(() => { buscar() }, [buscar])

  const primeiroNome = user?.nome_completo?.split(' ')[0] || ''
  const eMonitoria = papel === 'monitor'

  return (
    <div style={{ maxWidth: '920px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1
          className="font-bold tracking-tight"
          style={{ fontSize: '23px', color: 'var(--text-primary)', marginBottom: '5px' }}
        >
          {eMonitoria ? 'Minha monitoria' : `Olá, ${primeiroNome}`}
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
          {eMonitoria
            ? 'Disciplinas em que você atua como monitoria neste semestre.'
            : 'Suas disciplinas no semestre. As que têm dúvidas esperando aparecem primeiro.'}
        </p>
      </div>

      {resumo && resumo.disciplinas > 0 && (
        <div
          className="flex items-center rounded-xl"
          style={{
            padding: '16px 24px', gap: '34px', marginBottom: '16px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
          }}
        >
          <Metrica valor={resumo.disciplinas} rotulo="disciplinas" />
          <Metrica valor={resumo.matriculados} rotulo="estudantes" />
          <Metrica valor={resumo.sem_resposta} rotulo="dúvidas sem resposta" destaque />
          <Metrica valor={resumo.denuncias_pendentes} rotulo="denúncias a analisar" destaque />
        </div>
      )}

      {erro && (
        <div
          className="rounded-xl"
          style={{
            padding: '14px 18px', marginBottom: '14px',
            background: 'var(--bg-card)',
            border: '1px solid rgba(200,16,46,0.35)',
          }}
        >
          <p style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>{erro}</p>
        </div>
      )}

      {carregando ? (
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
          Carregando suas disciplinas...
        </p>
      ) : disciplinas.length === 0 && !erro ? (
        <div
          className="rounded-xl text-center"
          style={{ padding: '48px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '5px' }}>
            {eMonitoria ? 'Nenhuma monitoria atribuída' : 'Nenhuma disciplina atribuída'}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            A coordenação do curso é quem faz essa atribuição a cada semestre.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {disciplinas.map(item => (
            <CartaoDisciplina
              key={item.disciplina_id}
              item={item}
              navegar={navigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
