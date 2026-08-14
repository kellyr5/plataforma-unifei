/**
 * AndamentoPage — Acompanhamento individual por disciplina.
 *
 * Substitui a antiga tela de ranking. A mudança não é só de nome: em vez de
 * pontuar e comparar pessoas, o painel mostra ao usuário o próprio percurso em
 * cada matéria, quantas dúvidas levantou, quantas respondeu e quantas dessas
 * respostas ajudaram alguém. O recorte por período existe porque o interesse
 * costuma ser o semestre corrente, não o histórico inteiro.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import api from '../../services/api'

interface Interacao {
  post_id: string
  topico_id: string
  titulo: string
  tipo: 'duvida' | 'resposta'
  e_melhor: boolean
  created_at: string
}

interface Andamento {
  disciplina_id: string
  disciplina_codigo: string
  disciplina_nome: string
  total_posts: number
  total_respostas: number
  total_melhores_respostas: number
  ultima_interacao: string
  interacoes: Interacao[]
}

function dataLegivel(valor: string): string {
  return new Date(valor).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

/**
 * Atalhos de período, calculados a partir da data de hoje.
 *
 * O semestre letivo brasileiro vai de fevereiro a julho e de agosto a
 * dezembro. Traduzir isso em botões evita que o aluno tenha de lembrar em que
 * dia o semestre começou para responder "como fui neste semestre".
 */
function atalhosDePeriodo() {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const primeiroSemestre = hoje.getMonth() + 1 <= 7

  const iso = (data: Date) => data.toISOString().slice(0, 10)
  const trintaDias = new Date(hoje)
  trintaDias.setDate(trintaDias.getDate() - 30)

  const inicioCorrente = primeiroSemestre ? `${ano}-02-01` : `${ano}-08-01`
  const fimCorrente = primeiroSemestre ? `${ano}-07-31` : `${ano}-12-31`

  const inicioAnterior = primeiroSemestre ? `${ano - 1}-08-01` : `${ano}-02-01`
  const fimAnterior = primeiroSemestre ? `${ano - 1}-12-31` : `${ano}-07-31`

  return [
    { rotulo: 'Tudo', desde: '', ate: '' },
    { rotulo: 'Últimos 30 dias', desde: iso(trintaDias), ate: iso(hoje) },
    {
      rotulo: `Semestre atual (${ano}.${primeiroSemestre ? 1 : 2})`,
      desde: inicioCorrente,
      ate: fimCorrente,
    },
    {
      rotulo: `Semestre anterior (${primeiroSemestre ? ano - 1 : ano}.${primeiroSemestre ? 2 : 1})`,
      desde: inicioAnterior,
      ate: fimAnterior,
    },
  ]
}

function Metrica({ valor, rotulo, cor }: { valor: number; rotulo: string; cor: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: '76px' }}>
      <div className="font-bold" style={{ fontSize: '20px', color: cor, lineHeight: 1.2 }}>
        {valor}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{rotulo}</div>
    </div>
  )
}

function LinhaInteracao({ interacao, onAbrir }: {
  interacao: Interacao
  onAbrir: (topicoId: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const eDuvida = interacao.tipo === 'duvida'

  return (
    <button
      onClick={() => onAbrir(interacao.topico_id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center text-left cursor-pointer"
      style={{
        padding: '9px 10px', gap: '10px', borderRadius: '8px', border: 'none',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      <span
        className="flex-shrink-0 font-medium"
        style={{
          padding: '2px 8px', borderRadius: '6px', fontSize: '11px',
          background: eDuvida ? 'rgba(0,48,135,0.08)' : 'var(--bg-input)',
          color: eDuvida ? 'var(--accent-blue)' : 'var(--text-secondary)',
        }}
      >
        {eDuvida ? 'Dúvida' : 'Resposta'}
      </span>

      <span className="flex-1 min-w-0 truncate" style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
        {interacao.titulo}
      </span>

      {interacao.e_melhor && (
        <span className="flex-shrink-0" style={{ fontSize: '11px', color: 'var(--accent-oliva-texto)' }}>
          ajudou
        </span>
      )}

      <span className="flex-shrink-0" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
        {dataLegivel(interacao.created_at)}
      </span>
    </button>
  )
}

function CardDisciplina({ item, onAbrir }: {
  item: Andamento
  onAbrir: (topicoId: string) => void
}) {
  const [aberto, setAberto] = useState(false)

  return (
    <div
      className="rounded-xl"
      style={{
        padding: '16px 20px',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center" style={{ gap: '20px' }}>
        <div className="flex-1 min-w-0">
          <div className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
            {item.disciplina_codigo} — {item.disciplina_nome}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            Última interação em {dataLegivel(item.ultima_interacao)}
          </div>
        </div>

        <div className="flex items-center flex-shrink-0" style={{ gap: '8px' }}>
          <Metrica valor={item.total_posts} rotulo="dúvidas" cor="var(--accent-blue)" />
          <Metrica valor={item.total_respostas} rotulo="respostas" cor="var(--text-secondary)" />
          <Metrica valor={item.total_melhores_respostas} rotulo="ajudaram" cor="var(--accent-oliva)" />
        </div>
      </div>

      {item.interacoes.length > 0 && (
        <>
          <button
            onClick={() => setAberto(!aberto)}
            className="cursor-pointer"
            style={{
              marginTop: '10px', fontSize: '12px', fontWeight: 500,
              background: 'none', border: 'none', color: 'var(--accent-blue)',
            }}
          >
            {aberto
              ? 'Ocultar participações'
              : `Ver as ${item.interacoes.length} participações`}
          </button>

          {aberto && (
            <div style={{
              marginTop: '8px', paddingTop: '8px',
              borderTop: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: '2px',
            }}>
              {item.interacoes.map(interacao => (
                <LinhaInteracao
                  key={interacao.post_id}
                  interacao={interacao}
                  onAbrir={onAbrir}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function AndamentoPage() {
  const navigate = useNavigate()
  const [dados, setDados] = useState<Andamento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [desde, setDesde] = useState('')
  const [ate, setAte] = useState('')
  const [personalizado, setPersonalizado] = useState(false)

  const buscar = useCallback(async () => {
    setCarregando(true)
    try {
      const params: Record<string, string> = {}
      if (desde) params.desde = desde
      if (ate) params.ate = ate

      const res = await api.get('/forum/andamento/', { params })
      setDados(Array.isArray(res.data) ? res.data : [])
    } catch {
      setDados([])
    } finally {
      setCarregando(false)
    }
  }, [desde, ate])

  useEffect(() => { buscar() }, [buscar])

  const totais = dados.reduce(
    (acumulado, item) => ({
      posts: acumulado.posts + item.total_posts,
      respostas: acumulado.respostas + item.total_respostas,
      melhores: acumulado.melhores + item.total_melhores_respostas,
    }),
    { posts: 0, respostas: 0, melhores: 0 }
  )

  const campoData = {
    padding: '7px 10px', fontSize: '13px', borderRadius: '8px',
    background: 'var(--bg-input)', color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  }

  return (
    <div style={{ maxWidth: '760px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 className="font-bold tracking-tight" style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '4px' }}>
          Meu andamento
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          Sua participação em cada disciplina do fórum.
        </p>
      </div>

      {/* Resumo geral */}
      <div
        className="flex items-center rounded-xl"
        style={{
          padding: '18px 24px', gap: '32px', marginBottom: '20px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
        }}
      >
        <Metrica valor={totais.posts} rotulo="dúvidas levantadas" cor="var(--accent-blue)" />
        <Metrica valor={totais.respostas} rotulo="respostas dadas" cor="var(--text-secondary)" />
        <Metrica valor={totais.melhores} rotulo="respostas que ajudaram" cor="var(--accent-oliva)" />
      </div>

      {/* Recorte por período.

          Atalhos primeiro, datas depois. Quem quer ver "este semestre" não
          deveria precisar lembrar em que dia o semestre começou, e era isso
          que dois campos de data soltos exigiam. */}
      <div style={{ marginBottom: '20px' }}>
        <div className="flex items-center flex-wrap" style={{ gap: '6px' }}>
          {atalhosDePeriodo().map(atalho => {
            const ativo = desde === atalho.desde && ate === atalho.ate

            return (
              <button
                key={atalho.rotulo}
                onClick={() => { setDesde(atalho.desde); setAte(atalho.ate) }}
                className="rounded-lg font-medium cursor-pointer"
                style={{
                  padding: '7px 13px', fontSize: '12.5px',
                  background: ativo ? 'var(--accent-blue)' : 'var(--bg-input)',
                  color: ativo ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${ativo ? 'var(--accent-blue)' : 'var(--border)'}`,
                }}
              >
                {atalho.rotulo}
              </button>
            )
          })}

          <button
            onClick={() => setPersonalizado(!personalizado)}
            className="rounded-lg font-medium cursor-pointer"
            style={{
              padding: '7px 13px', fontSize: '12.5px',
              background: personalizado ? 'var(--accent-blue)' : 'var(--bg-input)',
              color: personalizado ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${personalizado ? 'var(--accent-blue)' : 'var(--border)'}`,
            }}
          >
            Escolher datas
          </button>
        </div>

        {personalizado && (
          <div className="flex items-center" style={{ gap: '10px', marginTop: '10px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>De</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={campoData} />

            <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>até</label>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={campoData} />

            {(desde || ate) && (
              <button
                onClick={() => { setDesde(''); setAte('') }}
                className="cursor-pointer"
                style={{ fontSize: '12px', background: 'none', border: 'none', color: 'var(--text-tertiary)' }}
              >
                Limpar
              </button>
            )}
          </div>
        )}
      </div>

      {carregando ? (
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Carregando andamento...</p>
      ) : dados.length === 0 ? (
        <div className="rounded-xl text-center" style={{
          padding: '48px', background: 'var(--bg-card)', border: '1px solid var(--border)',
        }}>
          <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Nenhuma participação no período
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            Assim que você abrir ou responder um tópico, ele aparece aqui.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {dados.map(item => (
            <CardDisciplina
              key={item.disciplina_id}
              item={item}
              onAbrir={(topicoId) => navigate('/forum/' + topicoId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
