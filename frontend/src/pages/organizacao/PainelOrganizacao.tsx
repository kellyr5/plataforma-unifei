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
import toast, { Toaster } from 'react-hot-toast'

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
  /* Nulo na campanha de doação, que não tem vaga a contar. */
  vagas_disponiveis: number | null
  carga_horaria_total: number
  data_inicio: string
  data_fim: string
  prazo_inscricao: string
  status: string
  status_display: string
  esta_aberta_inscricao: boolean
  imagem_url: string | null
  inscricoes: Inscricoes
  e_doacao: boolean
  unidade_medida: string
  meta_quantidade: number | null
  total_arrecadado: number
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

function CartaoOportunidade({ item, navegar, aoExcluir }: {
  item: Oportunidade
  navegar: (destino: string) => void
  aoExcluir: (item: Oportunidade) => void
}) {
  const pendentes = item.inscricoes.pendentes
  const [confirmando, setConfirmando] = useState(false)

  const envolvidos = item.inscricoes.aprovadas + item.inscricoes.concluidas

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
              {item.local}
              {/* Campanha não tem carga horária: exibir "0h" descreveria uma
                  duração que ninguém definiu. */}
              {item.e_doacao ? '' : ` · ${item.carga_horaria_total}h`} ·{' '}
              {data(item.data_inicio)} a {data(item.data_fim)} ·
              inscrições até {data(item.prazo_inscricao)}
            </p>
          </div>

          <div className="flex items-start flex-shrink-0 flex-wrap" style={{ gap: '16px' }}>
            <Metrica valor={pendentes} rotulo="a decidir" destaque />
            <Metrica valor={item.inscricoes.aprovadas} rotulo="em atividade" />
            <Metrica valor={item.inscricoes.concluidas} rotulo="certificados" />
            {/* Na campanha, o que se acompanha é a arrecadação. A métrica de
                vagas não existe ali, e vinha do servidor como nulo. */}
            {item.e_doacao ? (
              <Metrica
                valor={item.total_arrecadado}
                rotulo={item.unidade_medida || 'arrecadados'}
              />
            ) : (
              <Metrica valor={item.vagas_disponiveis ?? 0} rotulo="vagas livres" />
            )}
          </div>
        </div>

        {/* Quebra de linha porque são quatro ações e o cartão não é largo.
            Sem isso, a última sai do cartão no telefone. */}
        <div
          className="flex items-center flex-wrap"
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
          {/* A edição já existia, mas só era alcançável de dentro da tela de
              participantes — dois cliques longe de onde a organização passa o
              tempo. Corrigir uma data errada exigia atravessar uma tela que
              não tem relação com a correção. */}
          <Botao
            rotulo="Editar"
            onClick={() => navegar(`/organizacao/oportunidade/${item.id}/editar`)}
          />
          <Botao
            rotulo="Ver como o aluno vê"
            onClick={() => navegar(`/voluntariado/${item.id}`)}
          />
          <Botao rotulo="Excluir" onClick={() => setConfirmando(true)} />
        </div>

        {/* A confirmação nomeia o que será perdido em vez de perguntar
            genericamente se a pessoa tem certeza. Quem já emitiu certificado
            precisa saber que o documento continua válido — o registro é
            preservado, e não apagado de fato. */}
        {confirmando && (
          <div
            className="rounded-lg"
            style={{
              marginTop: '12px', padding: '14px 16px',
              background: 'var(--bg-input)',
              border: '1px solid var(--accent-blue-border)',
            }}
          >
            <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.55 }}>
              Excluir <strong>{item.titulo}</strong>?
            </p>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.55 }}>
              {envolvidos > 0
                ? `A ação sai da listagem e não aceita novas inscrições. ${envolvidos} ${envolvidos === 1 ? 'pessoa que já participa continua' : 'pessoas que já participam continuam'} com o registro, e os certificados emitidos seguem válidos.`
                : 'A ação sai da listagem e não aceita novas inscrições. Ninguém está inscrito no momento.'}
            </p>

            <div className="flex items-center flex-wrap" style={{ gap: '8px', marginTop: '12px' }}>
              <Botao
                rotulo="Confirmar exclusão"
                primario
                onClick={() => {
                  setConfirmando(false)
                  aoExcluir(item)
                }}
              />
              <Botao rotulo="Cancelar" onClick={() => setConfirmando(false)} />
            </div>
          </div>
        )}
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

  /**
   * Remove a oportunidade da listagem.
   *
   * No servidor é exclusão lógica: o registro permanece, marcado como
   * cancelado. Precisa ser assim porque quem já concluiu a participação tem
   * um certificado que aponta para esta ação, e apagar a linha invalidaria um
   * documento que a pessoa pode precisar apresentar anos depois.
   */
  async function excluir(item: Oportunidade) {
    try {
      await api.delete(`/voluntariado/oportunidades/${item.id}/`)
      toast.success('Oportunidade excluída.')
      await buscar()
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || 'Não foi possível excluir a oportunidade.'
      )
    }
  }

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
            <CartaoOportunidade
              key={item.id}
              item={item}
              navegar={navigate}
              aoExcluir={excluir}
            />
          ))}
        </div>
      )}
    </div>
  )
}
