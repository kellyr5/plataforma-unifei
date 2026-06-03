/**
 * PerfilPage — Perfil do usuario com reputacao por disciplina.
 *
 * Mostra:
 * - Dados do usuario (nome, email, CPF mascarado)
 * - Reputacao total e por disciplina
 * - Historico de atividades (respostas, melhores respostas)
 * - Certificados emitidos
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../services/api'

interface Reputacao {
  disciplina_codigo: string
  disciplina_nome: string
  pontos: number
  total_respostas: number
  total_melhores_respostas: number
  pontuacao_recebidos: number
}

interface Certificado {
  id: string
  codigo_validacao: string
  oportunidade_titulo: string
  carga_horaria: number
  data_emissao: string
}

interface Inscricao {
  id: string
  oportunidade_titulo: string
  status: string
  status_display: string
  created_at: string
}

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <div className="font-bold" style={{ fontSize: '24px', color }}>{value}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{label}</div>
    </div>
  )
}

function RepCard({ rep }: { rep: Reputacao }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className="rounded-xl transition-all duration-200"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        padding: '20px', background: 'var(--bg-card)',
        border: `1px solid ${hovered ? '#00308740' : 'var(--border)'}`,
        boxShadow: hovered ? '0 2px 8px rgba(0,48,135,0.06)' : 'none',
      }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
        <span className="rounded-md font-medium" style={{ padding: '3px 10px', fontSize: '12px', background: 'rgba(0,48,135,0.06)', color: '#003087' }}>
          {rep.disciplina_codigo}
        </span>
        <span className="font-bold" style={{ fontSize: '20px', color: '#003087' }}>{rep.pontos} pts</span>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
        {rep.disciplina_nome}
      </div>
      <div className="flex items-center" style={{ gap: '16px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
        <div className="flex items-center" style={{ gap: '4px' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
          {rep.total_respostas} respostas
        </div>
        <div className="flex items-center" style={{ gap: '4px' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {rep.total_melhores_respostas} melhores
        </div>
        <div className="flex items-center" style={{ gap: '4px' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
          {rep.pontuacao_recebidos || 0} votos
        </div>
      </div>
    </div>
  )
}

const statusCores: Record<string, { bg: string; text: string }> = {
  pendente: { bg: 'rgba(245,158,11,0.06)', text: '#F59E0B' },
  aprovada: { bg: 'rgba(16,185,129,0.06)', text: '#10B981' },
  concluida: { bg: 'rgba(0,48,135,0.06)', text: '#003087' },
  rejeitada: { bg: 'rgba(239,68,68,0.06)', text: '#EF4444' },
  desistente: { bg: 'rgba(107,114,128,0.06)', text: '#6B7280' },
  removida: { bg: 'rgba(107,114,128,0.06)', text: '#6B7280' },
}

export default function PerfilPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [reputacoes, setReputacoes] = useState<Reputacao[]>([])
  const [certificados, setCertificados] = useState<Certificado[]>([])
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPerfil() {
      try {
        const [repRes, certRes, inscRes] = await Promise.allSettled([
          api.get('/reputacao/minha/'),
          api.get('/voluntariado/certificados/'),
          api.get('/voluntariado/inscricoes/'),
        ])

        if (repRes.status === 'fulfilled') setReputacoes(Array.isArray(repRes.value.data) ? repRes.value.data : [])
        if (certRes.status === 'fulfilled') {
          const data = certRes.value.data
          setCertificados(Array.isArray(data) ? data : data.results || [])
        }
        if (inscRes.status === 'fulfilled') {
          const data = inscRes.value.data
          setInscricoes(Array.isArray(data) ? data : data.results || [])
        }
      } catch (err) {
        console.error('Erro ao carregar perfil:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPerfil()
  }, [])

  const totalPontos = reputacoes.reduce((s, r) => s + r.pontos, 0)
  const totalRespostas = reputacoes.reduce((s, r) => s + r.total_respostas, 0)
  const totalMelhores = reputacoes.reduce((s, r) => s + r.total_melhores_respostas, 0)

  const initials = user?.nome_completo
    ? user.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '60vh' }}>
        <div className="flex items-center" style={{ gap: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Carregando perfil...
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px' }}>

      {/* Card do perfil */}
      <div className="rounded-xl" style={{ padding: '28px', background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: '24px' }}>
        <div className="flex items-start" style={{ gap: '20px' }}>
          {/* Avatar */}
          <div className="flex items-center justify-center rounded-2xl flex-shrink-0"
            style={{ width: '72px', height: '72px', background: '#003087', color: 'white', fontSize: '24px', fontWeight: 600 }}>
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="font-bold" style={{ fontSize: '22px', color: 'var(--text-primary)', marginBottom: '4px' }}>
              {user?.nome_completo || 'Usuario'}
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {user?.email || ''}
            </p>
            {user?.cpf && (
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                CPF: {user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4')}
              </p>
            )}
          </div>
        </div>

        {/* Stats resumo */}
        <div className="flex items-center justify-around" style={{ marginTop: '24px', padding: '20px 0 0', borderTop: '1px solid var(--border)' }}>
          <StatMini label="Reputacao total" value={totalPontos.toString()} color="#003087" />
          <div style={{ width: '1px', height: '40px', background: 'var(--border)' }} />
          <StatMini label="Respostas" value={totalRespostas.toString()} color="#10B981" />
          <div style={{ width: '1px', height: '40px', background: 'var(--border)' }} />
          <StatMini label="Melhores respostas" value={totalMelhores.toString()} color="#F59E0B" />
          <div style={{ width: '1px', height: '40px', background: 'var(--border)' }} />
          <StatMini label="Certificados" value={certificados.length.toString()} color="#C8102E" />
        </div>
      </div>

      {/* Reputacao por disciplina */}
      {reputacoes.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '14px' }}>
            <h2 className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Reputacao por disciplina</h2>
            <button onClick={() => navigate('/ranking')} className="cursor-pointer font-medium"
              style={{ fontSize: '13px', color: '#003087' }}>Ver ranking geral</button>
          </div>
          <div className="grid grid-cols-2" style={{ gap: '12px' }}>
            {reputacoes.map((r, i) => <RepCard key={i} rep={r} />)}
          </div>
        </div>
      )}

      {/* Inscricoes de voluntariado */}
      {inscricoes.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '14px' }}>
            Minhas inscricoes de voluntariado
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {inscricoes.map(insc => {
              const cores = statusCores[insc.status] || { bg: 'var(--bg-input)', text: 'var(--text-secondary)' }
              return (
                <div key={insc.id} className="flex items-center rounded-xl" style={{
                  padding: '14px 18px', gap: '14px',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                }}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                      {insc.oportunidade_titulo}
                    </div>
                  </div>
                  <span className="rounded-md flex-shrink-0" style={{
                    padding: '3px 10px', fontSize: '12px', fontWeight: 500,
                    background: cores.bg, color: cores.text,
                  }}>
                    {insc.status_display}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Certificados */}
      {certificados.length > 0 && (
        <div>
          <h2 className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '14px' }}>
            Meus certificados
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {certificados.map(cert => (
              <div key={cert.id} className="flex items-center rounded-xl" style={{
                padding: '14px 18px', gap: '14px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
              }}>
                <div className="flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ width: '36px', height: '36px', background: 'rgba(0,48,135,0.06)', color: '#003087' }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{cert.oportunidade_titulo}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    {cert.carga_horaria}h | Emitido em {new Date(cert.data_emissao).toLocaleDateString('pt-BR')} | Codigo: {cert.codigo_validacao}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mensagem se nao tem nada */}
      {reputacoes.length === 0 && inscricoes.length === 0 && certificados.length === 0 && (
        <div className="rounded-xl text-center" style={{ padding: '48px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Seu perfil esta vazio
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            Participe do forum e do voluntariado para construir sua reputacao!
          </p>
        </div>
      )}
    </div>
  )
}
