/**
 * RankingPage — Classificação de reputação por disciplina.
 *
 * Funcionalidades:
 * - Selecao de disciplina
 * - Tabela de ranking ao vivo com posicao, nome, pontos, respostas
 * - Rankings semestrais historicos
 * - Destaque do usuario logado
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../services/api'

interface Disciplina {
  id: string
  codigo: string
  nome: string
}

interface RankingEntry {
  id: string
  disciplina_codigo: string
  semestre: string
  posicao: number
  usuario: string
  usuario_nome: string
  pontos: number
  gerado_em: string
}

interface RankingSemestral {
  id: string
  disciplina_codigo: string
  disciplina_nome: string
  semestre: string
  created_at: string
  entradas: RankingSemestralEntry[]
}

interface RankingSemestralEntry {
  id: string
  disciplina_codigo: string
  semestre: string
  posicao: number
  usuario: string
  usuario_nome: string
  pontos: number
  gerado_em: string
}

function MedalIcon({ pos }: { pos: number }) {
  if (pos === 1) return <span style={{ fontSize: '18px' }}>🥇</span>
  if (pos === 2) return <span style={{ fontSize: '18px' }}>🥈</span>
  if (pos === 3) return <span style={{ fontSize: '18px' }}>🥉</span>
  return <span className="font-medium" style={{ fontSize: '14px', color: 'var(--text-tertiary)', width: '24px', textAlign: 'center', display: 'inline-block' }}>{pos}</span>
}

export default function RankingPage() {
  const { user } = useAuth()
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])
  const [selectedDisc, setSelectedDisc] = useState<string | null>(null)
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [semestrais, setSemestrais] = useState<RankingSemestralEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRanking, setLoadingRanking] = useState(false)
  const [tab, setTab] = useState<'ao_vivo' | 'historico'>('ao_vivo')

  /* Carregar disciplinas */
  useEffect(() => {
    api.get('/forum/disciplinas/').then(res => {
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      setDisciplinas(data)
      if (data.length > 0) setSelectedDisc(data[0].id)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  /* Carregar ranking da disciplina selecionada */
  useEffect(() => {
    if (!selectedDisc) return
    setLoadingRanking(true)
    api.get(`/reputacao/disciplina/${selectedDisc}/`).then(res => {
      const data = res.data.ranking || (Array.isArray(res.data) ? res.data : [])
      setRanking(data.sort((a: RankingEntry, b: RankingEntry) => b.pontos - a.pontos))
    }).catch(() => setRanking([])).finally(() => setLoadingRanking(false))
  }, [selectedDisc])

  /* Carregar rankings semestrais */
  useEffect(() => {
    api.get('/reputacao/ranking-semestral/').then(res => {
      const data = Array.isArray(res.data) ? res.data : res.data.results || []
      setSemestrais(data)
    }).catch(console.error)
  }, [])

  const selectedDiscInfo = disciplinas.find(d => d.id === selectedDisc)

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '60vh' }}>
        <div className="flex items-center" style={{ gap: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Carregando ranking...
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 className="font-bold tracking-tight" style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '4px' }}>
          Ranking
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Classificação de reputação por disciplina
        </p>
      </div>

      {/* Tabs ao vivo / historico */}
      <div className="flex items-center" style={{ gap: '6px', marginBottom: '20px' }}>
        {[
          { value: 'ao_vivo' as const, label: 'Ao vivo' },
          { value: 'historico' as const, label: 'Histórico semestral' },
        ].map(t => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className="rounded-lg font-medium cursor-pointer transition-all duration-150"
            style={{
              padding: '8px 16px', fontSize: '13px',
              background: tab === t.value ? '#003087' : 'var(--bg-input)',
              color: tab === t.value ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${tab === t.value ? '#003087' : 'var(--border)'}`,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ========== AO VIVO ========== */}
      {tab === 'ao_vivo' && (
        <>
          {/* Selecao de disciplina */}
          <div className="flex items-center" style={{ gap: '6px', marginBottom: '20px', overflowX: 'auto' }}>
            {disciplinas.map(d => (
              <button key={d.id} onClick={() => setSelectedDisc(d.id)}
                className="flex-shrink-0 rounded-lg font-medium cursor-pointer transition-all duration-150"
                style={{
                  padding: '8px 14px', fontSize: '12px',
                  background: selectedDisc === d.id ? 'rgba(0,48,135,0.08)' : 'var(--bg-input)',
                  color: selectedDisc === d.id ? '#003087' : 'var(--text-secondary)',
                  border: `1px solid ${selectedDisc === d.id ? '#003087' : 'var(--border)'}`,
                  fontWeight: selectedDisc === d.id ? 600 : 400,
                }}>
                {d.codigo}
              </button>
            ))}
          </div>

          {/* Info da disciplina */}
          {selectedDiscInfo && (
            <div style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              {selectedDiscInfo.codigo} — {selectedDiscInfo.nome}
            </div>
          )}

          {/* Tabela de ranking */}
          {loadingRanking ? (
            <div className="flex items-center justify-center" style={{ height: '150px' }}>
              <div className="flex items-center" style={{ gap: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Carregando...
              </div>
            </div>
          ) : ranking.length === 0 ? (
            <div className="rounded-xl text-center" style={{ padding: '48px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.54 0" />
              </svg>
              <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Nenhum participante ainda
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                Participe do fórum desta disciplina para aparecer no ranking!
              </p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              {/* Header da tabela */}
              <div className="flex items-center" style={{
                padding: '12px 20px', gap: '16px',
                background: 'var(--bg-input)', borderBottom: '1px solid var(--border)',
                fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                <span style={{ width: '40px' }}>#</span>
                <span className="flex-1">Estudante</span>
                <span style={{ width: '80px', textAlign: 'center' }}>Pontos</span>
                <span style={{ width: '80px', textAlign: 'center' }}>Respostas</span>
                <span style={{ width: '80px', textAlign: 'center' }}>Melhores</span>
              </div>

              {/* Linhas */}
              {ranking.map((entry, i) => {
                const isMe = entry.usuario === user?.id
                const pos = i + 1
                return (
                  <div key={i} className="flex items-center transition-all duration-150" style={{
                    padding: '14px 20px', gap: '16px',
                    background: isMe ? 'rgba(0,48,135,0.04)' : 'transparent',
                    borderBottom: i < ranking.length - 1 ? '1px solid var(--border)' : 'none',
                    borderLeft: isMe ? '3px solid #003087' : '3px solid transparent',
                  }}>
                    <span style={{ width: '40px' }}><MedalIcon pos={pos} /></span>
                    <div className="flex-1 flex items-center" style={{ gap: '10px' }}>
                      <div className="flex items-center justify-center rounded-full flex-shrink-0"
                        style={{
                          width: '28px', height: '28px', fontSize: '12px', fontWeight: 600,
                          background: isMe ? '#003087' : 'rgba(0,48,135,0.08)',
                          color: isMe ? 'white' : '#003087',
                        }}>
                        {entry.usuario_nome?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <span className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                        {entry.usuario_nome}
                        {isMe && <span style={{ fontSize: '12px', color: '#003087', marginLeft: '6px' }}>(voce)</span>}
                      </span>
                    </div>
                    <span className="font-bold" style={{ width: '80px', textAlign: 'center', fontSize: '16px', color: '#003087' }}>
                      {entry.pontos}
                    </span>
                    <span style={{ width: '80px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {entry.pontos}
                    </span>
                    <span style={{ width: '80px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {entry.posicao}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ========== HISTORICO SEMESTRAL ========== */}
      {tab === 'historico' && (
        <>
          {semestrais.length === 0 ? (
            <div className="rounded-xl text-center" style={{ padding: '48px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                Nenhum ranking semestral gerado
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                O ranking semestral é gerado ao final de cada período letivo.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Agrupa por disciplina+semestre */}
              {Object.entries(
                semestrais.reduce<Record<string, RankingSemestralEntry[]>>((acc, entry) => {
                  const key = `${entry.disciplina_codigo} — ${entry.semestre}`
                  if (!acc[key]) acc[key] = []
                  acc[key].push(entry)
                  return acc
                }, {})
              ).map(([key, entries]) => (
                <div key={key} className="rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <div className="flex items-center justify-between" style={{
                    padding: '14px 20px', background: 'var(--bg-input)', borderBottom: '1px solid var(--border)',
                  }}>
                    <span className="font-semibold" style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{key}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                      {entries[0]?.gerado_em ? new Date(entries[0].gerado_em).toLocaleDateString('pt-BR') : ''}
                    </span>
                  </div>
                  {entries.sort((a, b) => a.posicao - b.posicao).map((e, i) => (
                    <div key={e.id} className="flex items-center" style={{
                      padding: '12px 20px', gap: '14px',
                      borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <span style={{ width: '32px' }}><MedalIcon pos={e.posicao} /></span>
                      <span className="flex-1 font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                        {e.usuario_nome}
                      </span>
                      <span className="font-bold" style={{ fontSize: '15px', color: '#003087' }}>
                        {e.pontos} pts
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
