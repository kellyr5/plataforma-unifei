/**
 * OportunidadePage — Detalhe de uma oportunidade com inscricao.
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
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
  requer_aprovacao: boolean
  total_inscritos: number
}

const areaCores: Record<string, string> = {
  educacao: '#10B981', saude: '#3B82F6', meio_ambiente: '#22C55E',
  assistencia_social: '#F59E0B', direitos_humanos: '#EC4899',
  cultura: '#8B5CF6', tecnologia: '#6366F1', esporte: '#EF4444', outro: '#6B7280',
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

  useEffect(() => {
    api.get(`/voluntariado/oportunidades/${id}/`).then(res => {
      setOp(res.data)
    }).catch(() => {
      toast.error('Oportunidade nao encontrada')
      navigate('/voluntariado')
    }).finally(() => setLoading(false))
  }, [id])

  async function handleInscrever() {
    setInscrevendo(true)
    try {
      const res = await api.post(`/voluntariado/oportunidades/${id}/inscrever/`, { motivacao })
      const status = res.data.status
      if (status === 'aprovada') {
        toast.success('Inscricao realizada! Voce foi aprovado automaticamente.')
      } else {
        toast.success('Inscricao enviada! Aguarde aprovacao da organizacao.')
      }
      /* Recarrega dados */
      const updated = await api.get(`/voluntariado/oportunidades/${id}/`)
      setOp(updated.data)
      setShowMotivacao(false)
      setMotivacao('')
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

  const cor = areaCores[op.area] || '#6B7280'
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
        <span className="rounded-md" style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 500, background: `${cor}12`, color: cor }}>
          {op.area_display}
        </span>
        {op.esta_aberta_inscricao ? (
          <span className="rounded-md" style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 500, background: 'rgba(16,185,129,0.06)', color: '#10B981' }}>
            Inscricoes abertas
          </span>
        ) : (
          <span className="rounded-md" style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 500, background: 'rgba(239,68,68,0.06)', color: '#EF4444' }}>
            Inscricoes encerradas
          </span>
        )}
      </div>

      {/* Card principal */}
      <div className="rounded-xl" style={{ padding: '28px', background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: '20px' }}>
        <h1 className="font-bold" style={{ fontSize: '22px', color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.3 }}>
          {op.titulo}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Organizado por <strong style={{ fontWeight: 500 }}>{op.organizacao_nome}</strong>
        </p>

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
          <InfoRow label="Carga horaria" value={`${op.carga_horaria_total} horas`}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <InfoRow label="Prazo de inscricao" value={formatDate(op.prazo_inscricao)}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>} />
          <InfoRow label="Aprovacao" value={op.requer_aprovacao ? 'Requer aprovacao da organizacao' : 'Inscricao automatica (sem aprovacao)'}
            icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>} />
        </div>

        {/* Vagas */}
        <div style={{ marginTop: '20px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Vagas preenchidas</span>
            <span className="font-medium" style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{preenchidas}/{op.vagas}</span>
          </div>
          <div className="rounded-full" style={{ height: '6px', background: 'var(--border)' }}>
            <div className="rounded-full transition-all duration-500" style={{ height: '6px', background: cor, width: `${porcent}%` }} />
          </div>
        </div>
      </div>

      {/* Botao de inscricao */}
      {op.esta_aberta_inscricao && (
        <div className="rounded-xl" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {!showMotivacao ? (
            <button
              onClick={() => setShowMotivacao(true)}
              className="w-full flex items-center justify-center rounded-xl font-semibold text-white cursor-pointer transition-all duration-200"
              style={{
                padding: '14px', gap: '8px', fontSize: '15px',
                background: `linear-gradient(135deg, ${cor} 0%, ${cor}dd 100%)`,
                boxShadow: `0 4px 12px ${cor}30`,
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              Quero me inscrever
            </button>
          ) : (
            <div>
              <h3 className="font-semibold" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>
                Por que voce quer participar?
              </h3>
              <textarea
                value={motivacao}
                onChange={e => setMotivacao(e.target.value)}
                placeholder="Descreva sua motivacao (opcional)..."
                rows={3}
                className="w-full rounded-xl outline-none resize-none"
                style={{
                  padding: '12px', fontSize: '14px',
                  background: 'var(--bg-input)', border: '1.5px solid var(--border)',
                  color: 'var(--text-primary)', marginBottom: '14px',
                }}
                onFocus={e => e.target.style.borderColor = cor}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
              <div className="flex items-center justify-end" style={{ gap: '10px' }}>
                <button onClick={() => { setShowMotivacao(false); setMotivacao('') }}
                  className="rounded-xl font-medium cursor-pointer"
                  style={{ padding: '10px 20px', fontSize: '14px', background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                  Cancelar
                </button>
                <button onClick={handleInscrever} disabled={inscrevendo}
                  className="rounded-xl font-semibold text-white cursor-pointer"
                  style={{ padding: '10px 24px', fontSize: '14px', background: cor, opacity: inscrevendo ? 0.7 : 1 }}>
                  {inscrevendo ? 'Inscrevendo...' : 'Confirmar inscricao'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
