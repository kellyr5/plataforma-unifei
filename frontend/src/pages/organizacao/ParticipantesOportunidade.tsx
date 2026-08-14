/**
 * ParticipantesOportunidade — Gestão dos inscritos de uma vaga.
 *
 * Reúne as três decisões da organização em uma tela só: aceitar ou recusar
 * quem se inscreveu, acompanhar quem está em atividade e concluir a
 * participação, que é o ato que emite o certificado.
 *
 * A ordem dos grupos segue o ciclo real: primeiro quem espera resposta,
 * depois quem está em campo, por último quem já terminou. Cada bloco só
 * aparece quando tem gente, para a tela não ficar cheia de vazio.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'

import api from '../../services/api'

interface Inscricao {
  id: string
  estudante: string
  estudante_nome: string
  status: string
  status_display: string
  motivacao: string
  horas_realizadas: number | null
  created_at: string
}

interface Oportunidade {
  id: string
  titulo: string
  local: string
  vagas: number
  vagas_disponiveis: number
  carga_horaria_total: number
  data_inicio: string
  data_fim: string
  status_display: string
}

const AZUL = 'var(--accent-blue)'

function data(valor: string): string {
  return new Date(valor).toLocaleDateString('pt-BR')
}

function Botao({ rotulo, onClick, primario, discreto }: {
  rotulo: string; onClick: () => void; primario?: boolean; discreto?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  if (discreto) {
    return (
      <button
        onClick={onClick}
        className="cursor-pointer"
        style={{ fontSize: '12.5px', background: 'none', border: 'none', color: 'var(--text-tertiary)' }}
      >
        {rotulo}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-md cursor-pointer"
      style={{
        padding: '6px 12px', fontSize: '12.5px', fontWeight: 500, whiteSpace: 'nowrap',
        color: primario ? '#FFFFFF' : (hovered ? AZUL : 'var(--text-secondary)'),
        background: primario ? AZUL : (hovered ? 'var(--bg-hover)' : 'transparent'),
        border: `1px solid ${primario ? AZUL : 'var(--border)'}`,
      }}
    >
      {rotulo}
    </button>
  )
}

function LinhaInscricao({ inscricao, children }: {
  inscricao: Inscricao
  children?: React.ReactNode
}) {
  return (
    <div
      className="rounded-lg"
      style={{
        padding: '13px 16px',
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-start justify-between" style={{ gap: '16px' }}>
        <div className="min-w-0">
          <div className="font-medium" style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>
            {inscricao.estudante_nome}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            Inscrito em {data(inscricao.created_at)}
            {inscricao.horas_realizadas ? ` · ${inscricao.horas_realizadas}h cumpridas` : ''}
          </div>
          {inscricao.motivacao && (
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '7px', lineHeight: 1.5 }}>
              {inscricao.motivacao}
            </p>
          )}
        </div>

        <div className="flex items-center flex-shrink-0" style={{ gap: '8px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function Grupo({ titulo, descricao, children }: {
  titulo: string; descricao: string; children: React.ReactNode
}) {
  return (
    <section className="rounded-xl" style={{
      padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border)',
    }}>
      <h2 className="font-semibold" style={{ fontSize: '14.5px', color: 'var(--text-primary)' }}>
        {titulo}
      </h2>
      <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', margin: '3px 0 14px' }}>
        {descricao}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {children}
      </div>
    </section>
  )
}

export default function ParticipantesOportunidade() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [oportunidade, setOportunidade] = useState<Oportunidade | null>(null)
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [concluindo, setConcluindo] = useState<string | null>(null)
  const [horas, setHoras] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const [vaga, lista] = await Promise.all([
        api.get(`/voluntariado/oportunidades/${id}/`),
        api.get(`/voluntariado/oportunidades/${id}/inscricoes/`),
      ])
      setOportunidade(vaga.data)
      setInscricoes(Array.isArray(lista.data) ? lista.data : lista.data.results || [])
    } catch {
      toast.error('Não foi possível carregar os participantes.')
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  async function acao(inscricaoId: string, rota: string, corpo?: object) {
    try {
      await api.post(`/voluntariado/inscricoes/${inscricaoId}/${rota}/`, corpo || {})
      await carregar()
      return true
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Não foi possível concluir a ação.')
      return false
    }
  }

  async function concluir(inscricaoId: string) {
    const valor = parseInt(horas, 10)

    if (!valor || valor <= 0) {
      toast.error('Informe quantas horas a pessoa cumpriu.')
      return
    }

    const ok = await acao(inscricaoId, 'concluir', { horas_realizadas: valor })
    if (ok) {
      toast.success('Participação concluída e certificado emitido.')
      setConcluindo(null)
      setHoras('')
    }
  }

  if (carregando) {
    return <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Carregando participantes...</p>
  }

  if (!oportunidade) return null

  const pendentes = inscricoes.filter(i => i.status === 'pendente')
  const aprovadas = inscricoes.filter(i => i.status === 'aprovada')
  const concluidas = inscricoes.filter(i => i.status === 'concluida')
  const encerradas = inscricoes.filter(
    i => ['rejeitada', 'removida', 'desistente'].includes(i.status)
  )

  return (
    <div style={{ maxWidth: '820px' }}>
      <Toaster position="top-right" toastOptions={{
        duration: 3500,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      <div className="flex items-start" style={{ gap: '14px', marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
          style={{
            width: '36px', height: '36px', background: 'var(--bg-card)',
            border: '1px solid var(--border)', color: 'var(--text-secondary)',
          }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>

        <div className="flex-1">
          <h1 className="font-bold tracking-tight" style={{ fontSize: '22px', color: 'var(--text-primary)' }}>
            {oportunidade.titulo}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
            {oportunidade.local} · {oportunidade.carga_horaria_total}h ·
            {' '}{oportunidade.vagas_disponiveis} de {oportunidade.vagas}
            {oportunidade.vagas === 1 ? ' vaga livre' : ' vagas livres'}
          </p>
        </div>

        <Botao rotulo="Editar vaga" onClick={() => navigate(`/organizacao/oportunidade/${id}/editar`)} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {pendentes.length > 0 && (
          <Grupo
            titulo={`Aguardando sua decisão (${pendentes.length})`}
            descricao="Ninguém entra em atividade antes de você aceitar."
          >
            {pendentes.map(inscricao => (
              <LinhaInscricao key={inscricao.id} inscricao={inscricao}>
                <Botao rotulo="Aceitar" primario onClick={() => acao(inscricao.id, 'aprovar')} />
                <Botao rotulo="Recusar" onClick={() => acao(inscricao.id, 'rejeitar')} />
              </LinhaInscricao>
            ))}
          </Grupo>
        )}

        {aprovadas.length > 0 && (
          <Grupo
            titulo={`Em atividade (${aprovadas.length})`}
            descricao="Ao concluir, informe as horas cumpridas. O certificado é emitido na hora."
          >
            {aprovadas.map(inscricao => (
              <div key={inscricao.id}>
                <LinhaInscricao inscricao={inscricao}>
                  {concluindo === inscricao.id ? null : (
                    <>
                      <Botao
                        rotulo="Concluir e emitir certificado"
                        primario
                        onClick={() => {
                          setConcluindo(inscricao.id)
                          setHoras(String(oportunidade.carga_horaria_total))
                        }}
                      />
                      <Botao rotulo="Remover" discreto onClick={() => acao(inscricao.id, 'remover')} />
                    </>
                  )}
                </LinhaInscricao>

                {concluindo === inscricao.id && (
                  <div
                    className="flex items-center rounded-lg"
                    style={{
                      padding: '12px 16px', gap: '10px', marginTop: '6px',
                      background: 'var(--bg-card)', border: '1px solid rgba(0,48,135,0.28)',
                    }}
                  >
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Horas cumpridas
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={horas}
                      onChange={(e) => setHoras(e.target.value)}
                      style={{
                        width: '90px', padding: '7px 10px', fontSize: '13px',
                        borderRadius: '8px', background: 'var(--bg-input)',
                        color: 'var(--text-primary)', border: '1px solid var(--border)',
                      }}
                      className="outline-none"
                    />
                    <Botao rotulo="Emitir certificado" primario onClick={() => concluir(inscricao.id)} />
                    <Botao rotulo="Cancelar" discreto onClick={() => setConcluindo(null)} />
                  </div>
                )}
              </div>
            ))}
          </Grupo>
        )}

        {concluidas.length > 0 && (
          <Grupo
            titulo={`Concluídos (${concluidas.length})`}
            descricao="O certificado já está disponível para cada participante validar."
          >
            {concluidas.map(inscricao => (
              <LinhaInscricao key={inscricao.id} inscricao={inscricao}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-tertiary)' }}>
                  certificado emitido
                </span>
              </LinhaInscricao>
            ))}
          </Grupo>
        )}

        {encerradas.length > 0 && (
          <Grupo titulo="Encerradas" descricao="Inscrições recusadas, removidas ou desistentes.">
            {encerradas.map(inscricao => (
              <LinhaInscricao key={inscricao.id} inscricao={inscricao}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-tertiary)' }}>
                  {inscricao.status_display.toLowerCase()}
                </span>
              </LinhaInscricao>
            ))}
          </Grupo>
        )}

        {inscricoes.length === 0 && (
          <div className="rounded-xl text-center" style={{
            padding: '48px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)',
          }}>
            <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '5px' }}>
              Ninguém se inscreveu ainda
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
              A vaga aparece na listagem de voluntariado enquanto o prazo estiver aberto.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
