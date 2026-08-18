/**
 * PainelOrganizacao — Página inicial da organização parceira.
 *
 * A organização não participa do fórum: ela publica oportunidades, acompanha
 * quem se inscreveu e emite os certificados de quem concluiu. A tela é
 * organizada por essa sequência, e cada cartão mostra em que etapa a vaga
 * está.
 *
 * As inscrições pendentes ficam em destaque porque são a única situação que
 * depende de uma decisão da organização. Aprovada aguarda o serviço acontecer;
 * concluída já virou certificado.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'

import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

interface Inscricoes {
  pendentes: number
  aprovadas: number
  concluidas: number
  rejeitadas: number
}

interface Oportunidade {
  id: string
  titulo: string
  descricao: string
  area_display: string
  local: string
  vagas: number
  vagas_disponiveis: number
  carga_horaria_total: number
  data_inicio: string
  data_fim: string
  prazo_inscricao: string
  status: string
  status_display: string
  esta_aberta_inscricao: boolean
  imagem_url: string | null
  inscricoes: Inscricoes
}

interface Resumo {
  oportunidades: number
  pendentes: number
  aprovadas: number
  concluidas: number
}

const AZUL = 'var(--accent-blue)'

function data(valor: string): string {
  return new Date(valor + 'T00:00:00').toLocaleDateString('pt-BR')
}

function Metrica({ valor, rotulo, destaque }: {
  valor: number; rotulo: string; destaque?: boolean
}) {
  return (
    <div style={{ minWidth: '92px' }}>
      <div
        className="font-semibold"
        style={{
          fontSize: '20px', lineHeight: 1.15,
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

function Botao({ rotulo, onClick, primario }: {
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
        padding: '6px 12px', fontSize: '12.5px', fontWeight: 500, whiteSpace: 'nowrap',
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

function CartaoOportunidade({ item, navegar }: {
  item: Oportunidade
  navegar: (destino: string) => void
}) {
  const pendentes = item.inscricoes.pendentes

  return (
    <article
      className="rounded-xl"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${pendentes > 0 ? 'rgba(0,48,135,0.28)' : 'var(--border)'}`,
        overflow: 'hidden',
      }}
    >
      {item.imagem_url && (
        <img
          src={item.imagem_url}
          alt=""
          style={{ width: '100%', height: '132px', objectFit: 'cover', display: 'block' }}
        />
      )}

      <div style={{ padding: '18px 20px' }}>
        <div className="flex items-start justify-between" style={{ gap: '16px' }}>
          <div className="min-w-0">
            <div className="flex items-center" style={{ gap: '8px' }}>
              <span className="rounded" style={{
                padding: '1px 7px', fontSize: '10.5px', fontWeight: 600,
                background: 'var(--bg-input)', color: 'var(--text-tertiary)',
              }}>
                {item.area_display}
              </span>
              {!item.esta_aberta_inscricao && (
                <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)' }}>
                  inscrições encerradas
                </span>
              )}
            </div>

            <h3 className="font-semibold" style={{ fontSize: '15px', color: 'var(--text-primary)', marginTop: '6px' }}>
              {item.titulo}
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
              {item.local} · {item.carga_horaria_total}h ·{' '}
              {data(item.data_inicio)} a {data(item.data_fim)} ·
              inscrições até {data(item.prazo_inscricao)}
            </p>
          </div>

          <div className="flex items-start flex-shrink-0" style={{ gap: '16px' }}>
            <Metrica valor={pendentes} rotulo="a decidir" destaque />
            <Metrica valor={item.inscricoes.aprovadas} rotulo="em atividade" />
            <Metrica valor={item.inscricoes.concluidas} rotulo="certificados" />
            <Metrica valor={item.vagas_disponiveis} rotulo="vagas livres" />
          </div>
        </div>

        <div
          className="flex items-center"
          style={{
            gap: '8px', marginTop: '14px', paddingTop: '14px',
            borderTop: '1px solid var(--border)',
          }}
        >
          {pendentes > 0 && (
            <Botao
              rotulo={
                pendentes === 1
                  ? 'Avaliar 1 inscrição'
                  : `Avaliar ${pendentes} inscrições`
              }
              primario
              onClick={() => navegar(`/organizacao/oportunidade/${item.id}`)}
            />
          )}
          <Botao
            rotulo="Participantes e certificados"
            onClick={() => navegar(`/organizacao/oportunidade/${item.id}`)}
          />
          <Botao
            rotulo="Ver como o aluno vê"
            onClick={() => navegar(`/voluntariado/${item.id}`)}
          />
        </div>
      </div>
    </article>
  )
}

export default function PainelOrganizacao() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const buscar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const { data: retorno } = await api.get('/voluntariado/oportunidades/minhas/')
      setOportunidades(retorno.oportunidades || [])
      setResumo(retorno.resumo || null)
    } catch (err: any) {
      setOportunidades([])
      setResumo(null)
      setErro(
        err.response?.status
          ? `A consulta falhou (erro ${err.response.status}).`
          : 'Não foi possível falar com o servidor.'
      )
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => { buscar() }, [buscar])

  const semAssinatura = !user?.nome_responsavel

  return (
    <div style={{ maxWidth: '920px' }}>
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      <div className="flex items-end justify-between" style={{ gap: '20px', marginBottom: '20px' }}>
        <div>
          <h1 className="font-bold tracking-tight" style={{ fontSize: '23px', color: 'var(--text-primary)', marginBottom: '5px' }}>
            {user?.nome_completo || 'Organização'}
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Suas oportunidades publicadas e o andamento de cada uma.
          </p>
        </div>

        <button
          onClick={() => navigate('/organizacao/nova-oportunidade')}
          className="rounded-xl font-medium text-white cursor-pointer flex-shrink-0"
          style={{ padding: '10px 18px', fontSize: '13.5px', border: 'none', background: AZUL }}
        >
          Nova oportunidade
        </button>
      </div>

      {/* O certificado leva a assinatura do responsável. Sem esse cadastro,
          a emissão sai sem identificação de quem atesta o serviço. */}
      {semAssinatura && (
        <div
          className="rounded-xl flex items-center justify-between"
          style={{
            padding: '14px 18px', marginBottom: '14px', gap: '16px',
            background: 'var(--bg-card)', border: '1px solid rgba(0,48,135,0.28)',
          }}
        >
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Cadastre o responsável e a assinatura antes de emitir certificados.
          </p>
          <Botao rotulo="Cadastrar" primario onClick={() => navigate('/perfil')} />
        </div>
      )}

      {erro && (
        <div className="rounded-xl" style={{
          padding: '14px 18px', marginBottom: '14px',
          background: 'var(--bg-card)', border: '1px solid rgba(200,16,46,0.35)',
        }}>
          <p style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>{erro}</p>
        </div>
      )}

      {resumo && resumo.oportunidades > 0 && (
        <div
          className="flex items-center rounded-xl"
          style={{
            padding: '16px 24px', gap: '36px', marginBottom: '16px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
          }}
        >
          <Metrica valor={resumo.oportunidades} rotulo="oportunidades" />
          <Metrica valor={resumo.pendentes} rotulo="inscrições a decidir" destaque />
          <Metrica valor={resumo.aprovadas} rotulo="voluntários em atividade" />
          <Metrica valor={resumo.concluidas} rotulo="certificados emitidos" />
        </div>
      )}

      {carregando ? (
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
          Carregando suas oportunidades...
        </p>
      ) : oportunidades.length === 0 && !erro ? (
        <div className="rounded-xl text-center" style={{
          padding: '48px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)',
        }}>
          <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '5px' }}>
            Nenhuma oportunidade publicada
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
            Publique uma vaga para que os estudantes possam se inscrever.
          </p>
          <Botao
            rotulo="Criar a primeira oportunidade"
            primario
            onClick={() => navigate('/organizacao/nova-oportunidade')}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {oportunidades.map(item => (
            <CartaoOportunidade key={item.id} item={item} navegar={navigate} />
          ))}
        </div>
      )}
    </div>
  )
}
