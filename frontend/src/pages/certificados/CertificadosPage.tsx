/**
 * CertificadosPage — Lista de certificados e validação pública.
 *
 * Funcionalidades:
 * - Lista certificados do usuário logado
 * - Validação pública por código (qualquer pessoa pode validar)
 * - Download do PDF
 */

import { useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import api from '../../services/api'

interface Certificado {
  id: string
  nome_estudante: string
  cpf_mascarado: string
  nome_oportunidade: string
  nome_organizacao: string
  area_atuacao: string
  local: string
  data_inicio: string
  data_fim: string
  horas_realizadas: number
  codigo_validacao: string
  arquivo_pdf: string
  /* URL absoluta montada pelo backend. O caminho cru do arquivo não serve:
     a mídia é servida em /media/, e não sob /api/. */
  arquivo_pdf_url: string | null
  emitido_em: string
}

interface ValidacaoResult {
  nome_estudante: string
  cpf_mascarado: string
  nome_oportunidade: string
  nome_organizacao: string
  area_atuacao: string
  horas_realizadas: number
  emitido_em: string
  codigo_validacao: string
}

const areaCores: Record<string, string> = {
  'Educação': '#10B981', 'Educacao': '#10B981',
  'Saúde': '#3B82F6', 'Saude': '#3B82F6',
  'Meio Ambiente': '#22C55E',
  'Assistência Social': '#F59E0B', 'Assistencia Social': '#F59E0B',
  'Direitos Humanos': '#EC4899',
  'Cultura': '#8B5CF6',
  'Tecnologia': '#6366F1',
  'Esporte': '#EF4444',
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function CertCard({ cert }: { cert: Certificado }) {
  const [hovered, setHovered] = useState(false)
  const cor = areaCores[cert.area_atuacao] || '#6B7280'

  return (
    <div
      className="rounded-xl transition-all duration-200"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '22px', background: 'var(--bg-card)',
        border: `1px solid ${hovered ? cor + '40' : 'var(--border)'}`,
        boxShadow: hovered ? `0 4px 12px ${cor}10` : 'none',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
        <span className="rounded-md" style={{ padding: '3px 10px', fontSize: '11px', fontWeight: 500, background: `${cor}12`, color: cor }}>
          {cert.area_atuacao}
        </span>
        <div className="flex items-center" style={{ gap: '4px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          Emitido em {formatDate(cert.emitido_em)}
        </div>
      </div>

      {/* Titulo */}
      <div className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.4 }}>
        {cert.nome_oportunidade}
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
        Organizado por {cert.nome_organizacao}
      </div>

      {/* Info */}
      <div className="flex items-center flex-wrap" style={{ gap: '16px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
        <div className="flex items-center" style={{ gap: '4px' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          {cert.local}
        </div>
        <div className="flex items-center" style={{ gap: '4px' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {cert.horas_realizadas} horas
        </div>
        <div className="flex items-center" style={{ gap: '4px' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          {formatDate(cert.data_inicio)} a {formatDate(cert.data_fim)}
        </div>
      </div>

      {/* Código + Download */}
      <div className="flex items-center justify-between" style={{
        padding: '12px 16px', borderRadius: '10px',
        background: 'var(--bg-input)', border: '1px solid var(--border)',
      }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>Código de validação</div>
          <div className="font-mono font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)', letterSpacing: '1px' }}>
            {cert.codigo_validacao}
          </div>
        </div>
        {cert.arquivo_pdf_url && (
          <a
            href={cert.arquivo_pdf_url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center rounded-lg font-medium transition-all duration-150 cursor-pointer text-white"
            style={{ padding: '8px 16px', gap: '6px', fontSize: '13px', background: '#003087' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            PDF
          </a>
        )}
      </div>
    </div>
  )
}

export default function CertificadosPage() {
  const [certificados, setCertificados] = useState<Certificado[]>([])
  const [loading, setLoading] = useState(true)
  const [codigoInput, setCodigoInput] = useState('')
  const [validando, setValidando] = useState(false)
  const [validacao, setValidacao] = useState<ValidacaoResult | null>(null)
  const [validacaoErro, setValidacaoErro] = useState('')

  useEffect(() => {
    api.get('/voluntariado/certificados/').then(res => {
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      setCertificados(data)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  async function handleValidar(e: React.FormEvent) {
    e.preventDefault()
    const codigo = codigoInput.trim().toUpperCase()
    if (!codigo) return

    setValidando(true)
    setValidacao(null)
    setValidacaoErro('')
    try {
      const res = await api.get(`/voluntariado/certificados/validar/${codigo}/`)
      setValidacao(res.data.certificado)
    } catch (err: any) {
      setValidacaoErro(err.response?.data?.detail || 'Certificado não encontrado.')
    } finally {
      setValidando(false)
    }
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 className="font-bold tracking-tight" style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '4px' }}>
          Certificados
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Seus certificados de voluntariado e validação pública
        </p>
      </div>

      {/* Validação pública */}
      <div className="rounded-xl" style={{ padding: '22px', marginBottom: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 className="font-semibold" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
          Validar certificado
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
          Insira o código de validação para verificar a autenticidade de um certificado.
        </p>
        <form onSubmit={handleValidar} className="flex items-center" style={{ gap: '10px' }}>
          <input
            type="text"
            value={codigoInput}
            onChange={e => setCodigoInput(e.target.value)}
            placeholder="Ex: 1AL54R5R0CJYB0S"
            className="flex-1 rounded-xl outline-none font-mono"
            style={{
              padding: '10px 14px', fontSize: '14px', letterSpacing: '1px',
              background: 'var(--bg-input)', border: '1.5px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            onFocus={e => e.target.style.borderColor = '#003087'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          <button type="submit" disabled={validando || !codigoInput.trim()}
            className="flex items-center rounded-xl font-medium text-white cursor-pointer transition-all duration-200"
            style={{ padding: '10px 20px', gap: '6px', fontSize: '14px', background: '#003087', opacity: validando ? 0.7 : 1, flexShrink: 0 }}>
            {validando ? 'Validando...' : 'Validar'}
          </button>
        </form>

        {/* Resultado da validação */}
        {validacaoErro && (
          <div className="flex items-center rounded-xl" style={{ marginTop: '14px', padding: '14px 16px', gap: '10px', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#EF4444" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span style={{ fontSize: '14px', color: '#EF4444' }}>{validacaoErro}</span>
          </div>
        )}

        {validacao && (
          <div className="rounded-xl" style={{ marginTop: '14px', padding: '18px', background: 'rgba(16,185,129,0.03)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <div className="flex items-center" style={{ gap: '8px', marginBottom: '14px', color: '#10B981', fontSize: '14px', fontWeight: 600 }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Certificado válido
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
              <div><span style={{ color: 'var(--text-tertiary)' }}>Estudante:</span> <strong style={{ color: 'var(--text-primary)' }}>{validacao.nome_estudante}</strong></div>
              <div><span style={{ color: 'var(--text-tertiary)' }}>CPF:</span> <span style={{ color: 'var(--text-primary)' }}>{validacao.cpf_mascarado}</span></div>
              <div><span style={{ color: 'var(--text-tertiary)' }}>Oportunidade:</span> <span style={{ color: 'var(--text-primary)' }}>{validacao.nome_oportunidade}</span></div>
              <div><span style={{ color: 'var(--text-tertiary)' }}>Organização:</span> <span style={{ color: 'var(--text-primary)' }}>{validacao.nome_organizacao}</span></div>
              <div><span style={{ color: 'var(--text-tertiary)' }}>Carga horária:</span> <span style={{ color: 'var(--text-primary)' }}>{validacao.horas_realizadas} horas</span></div>
              <div><span style={{ color: 'var(--text-tertiary)' }}>Emitido em:</span> <span style={{ color: 'var(--text-primary)' }}>{formatDate(validacao.emitido_em)}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Meus certificados */}
      <div>
        <h2 className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '14px' }}>
          Meus certificados ({certificados.length})
        </h2>

        {loading ? (
          <div className="flex items-center justify-center" style={{ height: '150px' }}>
            <div className="flex items-center" style={{ gap: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Carregando certificados...
            </div>
          </div>
        ) : certificados.length === 0 ? (
          <div className="rounded-xl text-center" style={{ padding: '48px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
              Nenhum certificado ainda
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
              Conclua atividades de voluntariado para receber certificados.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {certificados.map(cert => <CertCard key={cert.id} cert={cert} />)}
          </div>
        )}
      </div>
    </div>
  )
}
