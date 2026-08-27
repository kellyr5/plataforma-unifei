/**
 * OportunidadePage — Detalhe de uma oportunidade com inscricao.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { SeloOrganizacao } from '../../components/ui/SeloOrganizacao'
import toast, { Toaster } from 'react-hot-toast'

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
  organizacao_foto_url: string | null
  /* Capa da ação, exibida no topo do cartão. */
  imagem_url: string | null
  /* Situação da inscrição de quem está vendo, quando existir. */
  minha_inscricao: string | null
  requer_aprovacao: boolean
  total_inscritos: number
  /* Campanha de doação mede quantidade arrecadada, e não tempo. */
  modalidade: 'presencial' | 'doacao'
  e_doacao: boolean
  unidade_medida: string
  meta_quantidade: number | null
  horas_por_participacao: number
  total_arrecadado: number
  progresso_meta: number | null
}

/* A cor por área foi removida daqui: ela confundia classificação com
   julgamento, porque compartilhava a paleta dos estados de inscrição. A
   etiqueta da área usa os tokens neutros do tema. Ver a nota em
   DashboardPage. */

const SITUACAO_INSCRICAO: Record<string, string> = {
  pendente: 'Inscrição enviada, aguardando a organização',
  aprovada: 'Você participa desta ação',
  concluida: 'Participação concluída',
  rejeitada: 'Sua inscrição não foi aceita',
  removida: 'Você foi removido desta ação',
  desistente: 'Você desistiu desta ação',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start" style={{ gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div className="flex-shrink-0" style={{ color: 'var(--text-tertiary)', marginTop: '2px' }}>{icon}</div>
      <div>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{value}</div>
      </div>
    </div>
  )
}

export default function OportunidadePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [op, setOp] = useState<Oportunidade | null>(null)
  const [loading, setLoading] = useState(true)
  const [inscrevendo, setInscrevendo] = useState(false)
  const [motivacao, setMotivacao] = useState('')
  const [showMotivacao, setShowMotivacao] = useState(false)
  const [quantidade, setQuantidade] = useState('')
  const [itemDoado, setItemDoado] = useState('')

  useEffect(() => {
    api.get(`/voluntariado/oportunidades/${id}/`).then(res => {
      setOp(res.data)
    }).catch(() => {
      toast.error('Oportunidade não encontrada')
      navigate('/voluntariado')
    }).finally(() => setLoading(false))
  }, [id])

  async function handleInscrever() {
    const eDoacao = op?.e_doacao ?? false

    if (eDoacao && (!quantidade.trim() || Number(quantidade) <= 0)) {
      toast.error('Informe quanto você pretende doar.')
      return
    }

    setInscrevendo(true)
    try {
      const corpo: Record<string, unknown> = { motivacao }

      if (eDoacao) {
        corpo.quantidade_declarada = Number(quantidade)
        corpo.item_doado = itemDoado.trim()
      }

      const res = await api.post(`/voluntariado/oportunidades/${id}/inscrever/`, corpo)
      const status = res.data.status

      /* A mensagem diz o que acontece em seguida, e isso muda com a
         modalidade: quem doa precisa entregar o material à organização, e
         nada é contabilizado antes disso. */
      if (eDoacao) {
        toast.success(
          'Doação registrada. A organização confirmará no recebimento.'
        )
      } else if (status === 'aprovada') {
        toast.success('Inscrição realizada! Você foi aprovado automaticamente.')
      } else {
        toast.success('Inscrição enviada! Aguarde aprovação da organizacao.')
      }

      /* Recarrega dados */
      const updated = await api.get(`/voluntariado/oportunidades/${id}/`)
      setOp(updated.data)
      setShowMotivacao(false)
      setMotivacao('')
      setQuantidade('')
      setItemDoado('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erro ao se inscrever')
    } finally {
      setInscrevendo(false)
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
          Carregando...
        </div>
      </div>
    )
  }

  if (!op) return null

  const preenchidas = op.vagas - op.vagas_disponiveis
  const porcent = op.vagas > 0 ? (preenchidas / op.vagas) * 100 : 0

  return (
    <div style={{ maxWidth: '800px' }}>
      <Toaster position="top-right" toastOptions={{
        duration: 4000,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      {/* Header */}
      <div className="flex items-center" style={{ gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/voluntariado')}
          className="flex items-center justify-center rounded-lg cursor-pointer transition-all duration-150"
          style={{ width: '36px', height: '36px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <span className="rounded-md" style={{
          padding: '4px 12px', fontSize: '12px', fontWeight: 500,
          background: 'var(--bg-input)', color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
        }}>
          {op.area_display}
        </span>
        {op.esta_aberta_inscricao ? (
          <span className="rounded-md" style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 500, background: 'var(--accent-blue-soft)', color: 'var(--accent-blue-text)', border: '1px solid var(--accent-blue-border)' }}>
            Inscrições abertas
          </span>
        ) : (
          <span className="rounded-md" style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 500, background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            Inscrições encerradas
          </span>
        )}
      </div>

      {/* Card principal */}
      <div className="rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: '20px', overflow: 'hidden' }}>
        {/* Capa da ação. A listagem já mostrava a imagem e a página de
            detalhe não — quem clicava para saber mais via menos do que na
            lista de onde veio. */}
        {op.imagem_url && (
          <img
            src={op.imagem_url}
            alt=""
            style={{
              width: '100%', height: '180px', objectFit: 'cover',
              display: 'block', borderBottom: '1px solid var(--border)',
            }}
          />
        )}

        <div style={{ padding: '28px' }}>
        <h1 className="font-bold" style={{ fontSize: '22px', color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.3 }}>
          {op.titulo}
        </h1>
        <div className="flex items-center" style={{ gap: '11px', marginBottom: '22px' }}>
          <SeloOrganizacao nome={op.organizacao_nome} foto={op.organizacao_foto_url} tamanho={38} />
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Organização responsável
            </div>
            <div className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
              {op.organizacao_nome}
            </div>
          </div>
        </div>

        {/* Descricao */}
        <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: '24px' }}>
          {op.descricao}
        </div>

        {/* Informacoes */}
        <div>
          <InfoRow label="Local" value={op.local}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>} />
          <InfoRow label="Periodo" value={`${formatDate(op.data_inicio)} a ${formatDate(op.data_fim)}`}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>} />
          {op.e_doacao ? (
            <InfoRow
              label="Horas atribuídas"
              value={
                op.horas_por_participacao > 0
                  ? `${op.horas_por_participacao} horas, definidas pela organização`
                  : 'Certificado sem contagem de horas'
              }
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
          ) : (
            <InfoRow label="Carga horaria" value={`${op.carga_horaria_total} horas`}
              icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          )}
          <InfoRow label="Prazo de inscrição" value={formatDate(op.prazo_inscricao)}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>} />
          <InfoRow label="Aprovação" value={op.requer_aprovacao ? 'Requer aprovação da organização' : 'Inscrição automática (sem aprovação)'}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>} />
        </div>

        {/* Progresso.
            Na campanha, o que se acompanha é a arrecadação, e não a ocupação
            de vagas — campanha não tem vaga a preencher. Sem meta declarada
            não há barra: uma barra precisa de um denominador, e inventar um
            faria a campanha parecer mais ou menos adiantada do que está. */}
        {op.e_doacao ? (
          <div style={{ marginTop: '20px' }}>
            <div className="flex items-center justify-between flex-wrap" style={{ gap: '4px 12px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {op.meta_quantidade ? 'Arrecadado até agora' : 'Total arrecadado'}
              </span>
              <span className="font-medium" style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                {op.total_arrecadado}
                {op.meta_quantidade ? ` de ${op.meta_quantidade}` : ''}
                {op.unidade_medida ? ` ${op.unidade_medida}` : ''}
              </span>
            </div>

            {op.meta_quantidade ? (
              <div className="rounded-full" style={{ height: '6px', background: 'var(--bg-input)' }}>
                <div
                  className="rounded-full transition-all duration-500"
                  style={{
                    height: '6px',
                    background: 'var(--accent-blue)',
                    width: `${Math.min(100, (op.progresso_meta ?? 0) * 100)}%`,
                  }}
                />
              </div>
            ) : null}

            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
              Só entra na contagem o que a organização confirma ter recebido.
            </p>
          </div>
        ) : (
          <div style={{ marginTop: '20px' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Vagas preenchidas</span>
              <span className="font-medium" style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{preenchidas}/{op.vagas}</span>
            </div>
            <div className="rounded-full" style={{ height: '6px', background: 'var(--bg-input)' }}>
              <div className="rounded-full transition-all duration-500" style={{ height: '6px', background: 'var(--accent-blue)', width: `${porcent}%` }} />
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Inscrição.
          A situação de quem já se inscreveu vem antes do convite: oferecer
          "Quero me inscrever" a quem já participou da ação é pedir que a
          pessoa descubra pelo erro do servidor que não pode. */}
      {op.minha_inscricao ? (
        <div className="rounded-xl" style={{
          padding: '20px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)',
        }}>
          <div className="font-medium" style={{ fontSize: '14.5px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            {SITUACAO_INSCRICAO[op.minha_inscricao] || 'Você já se inscreveu nesta ação'}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {op.minha_inscricao === 'concluida'
              ? 'Sua participação foi encerrada e o certificado está disponível em Certificados.'
              : 'Acompanhe a situação da sua inscrição em Meu perfil.'}
          </p>
        </div>
      ) : !op.esta_aberta_inscricao ? (
        <div className="rounded-xl" style={{
          padding: '20px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)',
        }}>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            As inscrições para esta ação estão encerradas.
          </p>
        </div>
      ) : (
        <div className="rounded-xl" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {!showMotivacao ? (
            <button
              onClick={() => setShowMotivacao(true)}
              className="w-full flex items-center justify-center rounded-xl font-semibold text-white cursor-pointer"
              style={{
                padding: '14px', gap: '8px', fontSize: '15px', border: 'none',
                background: 'var(--accent-blue)',
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              {op.e_doacao ? 'Quero doar' : 'Quero me inscrever'}
            </button>
          ) : (
            <div>
              {/* Na campanha, a quantidade vem antes da motivação: é o dado que
                  a organização precisa para se preparar, e o único que o
                  formulário exige. */}
              {op.e_doacao && (
                <div style={{ marginBottom: '16px' }}>
                  <h3 className="font-semibold" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                    Quanto você pretende doar?
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
                    Em {op.unidade_medida || 'itens'}. A organização confirma no
                    recebimento, e é a confirmação dela que entra na contagem da
                    campanha.
                  </p>

                  <div className="flex flex-wrap" style={{ gap: '10px' }}>
                    <input
                      type="number"
                      min={1}
                      value={quantidade}
                      onChange={e => setQuantidade(e.target.value)}
                      placeholder="Ex.: 10"
                      aria-label={`Quantidade em ${op.unidade_medida || 'itens'}`}
                      className="rounded-xl outline-none"
                      style={{
                        width: '120px', padding: '12px', fontSize: '16px',
                        background: 'var(--bg-input)', border: '1.5px solid var(--border)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <input
                      type="text"
                      value={itemDoado}
                      onChange={e => setItemDoado(e.target.value)}
                      placeholder="O que você vai entregar (opcional)"
                      maxLength={160}
                      aria-label="Descrição do que será doado"
                      className="flex-1 rounded-xl outline-none"
                      style={{
                        minWidth: '180px', padding: '12px', fontSize: '16px',
                        background: 'var(--bg-input)', border: '1.5px solid var(--border)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                </div>
              )}

              <h3 className="font-semibold" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>
                {op.e_doacao ? 'Quer deixar alguma observação?' : 'Por que você quer participar?'}
              </h3>
              <textarea
                value={motivacao}
                onChange={e => setMotivacao(e.target.value)}
                placeholder="Descreva sua motivação (opcional)..."
                rows={3}
                className="w-full rounded-xl outline-none resize-none"
                style={{
                  padding: '12px', fontSize: '14px',
                  background: 'var(--bg-input)', border: '1.5px solid var(--border)',
                  color: 'var(--text-primary)', marginBottom: '14px',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent-blue)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <div className="flex items-center justify-end" style={{ gap: '10px' }}>
                <button
                  onClick={() => {
                    setShowMotivacao(false)
                    setMotivacao('')
                    setQuantidade('')
                    setItemDoado('')
                  }}
                  className="rounded-xl font-medium cursor-pointer"
                  style={{ padding: '10px 20px', fontSize: '14px', background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                  Cancelar
                </button>
                <button onClick={handleInscrever} disabled={inscrevendo}
                  className="rounded-xl font-semibold text-white cursor-pointer"
                  style={{
                    padding: '10px 24px', fontSize: '14px', border: 'none',
                    background: 'var(--accent-blue)', opacity: inscrevendo ? 0.7 : 1,
                  }}>
                  {inscrevendo
                    ? 'Registrando...'
                    : op.e_doacao ? 'Confirmar doação' : 'Confirmar inscrição'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
