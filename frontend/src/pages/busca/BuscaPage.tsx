/**
 * BuscaPage — Resultados da busca no fórum.
 *
 * A tela informa qual modo respondeu, e isso não é detalhe técnico exposto por
 * descuido: em busca por termos, não encontrar significa que as palavras
 * digitadas não aparecem em lugar nenhum, e reformular com sinônimos ajuda.
 * Em busca por significado, não encontrar significa que ninguém perguntou
 * algo parecido, e reformular não vai adiantar — o caminho é publicar a
 * dúvida. São conclusões opostas a partir da mesma lista vazia.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

interface Resultado {
  id: string
  titulo: string
  trecho: string
  autor_nome: string
  disciplina_codigo: string
  topico_id: string
  e_resposta: boolean
  relevancia: number | null
  created_at: string
}

interface Resposta {
  modo: 'semantica' | 'textual' | 'vazia'
  total: number
  resultados: Resultado[]
}

const AZUL = 'var(--accent-blue)'

function data(valor: string): string {
  return new Date(valor).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function BuscaPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [parametros, setParametros] = useSearchParams()

  const consulta = parametros.get('q') || ''
  const disciplinaFiltro = parametros.get('disciplina') || ''

  const [termo, setTermo] = useState(consulta)
  const [resposta, setResposta] = useState<Resposta | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const disciplinas = user?.papeis_disciplina || []

  const buscar = useCallback(() => {
    if (!consulta.trim()) {
      setResposta(null)
      return
    }

    setCarregando(true)
    setErro('')

    const params: Record<string, string> = { q: consulta }
    if (disciplinaFiltro) params.disciplina = disciplinaFiltro

    api.get('/busca/', { params })
      .then(({ data: dados }) => setResposta(dados))
      .catch(() => setErro('A busca falhou. Tente novamente em instantes.'))
      .finally(() => setCarregando(false))
  }, [consulta, disciplinaFiltro])

  useEffect(() => { buscar() }, [buscar])
  useEffect(() => { setTermo(consulta) }, [consulta])

  function submeter(e: React.FormEvent) {
    e.preventDefault()
    const novos = new URLSearchParams()
    if (termo.trim()) novos.set('q', termo.trim())
    if (disciplinaFiltro) novos.set('disciplina', disciplinaFiltro)
    setParametros(novos)
  }

  const campo = {
    padding: '10px 13px', fontSize: '13.5px', borderRadius: '8px',
    background: 'var(--bg-input)', color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  }

  return (
    <div style={{ maxWidth: '760px' }}>
      <h1 className="font-bold tracking-tight" style={{ fontSize: '22px', color: 'var(--text-primary)' }}>
        Buscar no fórum
      </h1>
      <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: '5px 0 18px', lineHeight: 1.6 }}>
        Descreva a dúvida como você a explicaria a um colega. A busca procura
        perguntas equivalentes, mesmo escritas com outras palavras.
      </p>

      <form onSubmit={submeter} className="flex items-center" style={{ gap: '8px', marginBottom: '20px' }}>
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Ex.: meu laço percorre uma posição a mais do vetor"
          className="flex-1 outline-none"
          style={campo}
        />

        <select
          value={disciplinaFiltro}
          onChange={(e) => {
            const novos = new URLSearchParams()
            if (consulta) novos.set('q', consulta)
            if (e.target.value) novos.set('disciplina', e.target.value)
            setParametros(novos)
          }}
          className="cursor-pointer outline-none"
          style={campo}
        >
          <option value="">Todas as disciplinas</option>
          {disciplinas.map(vinculo => (
            <option key={vinculo.disciplina_id} value={vinculo.disciplina_id}>
              {vinculo.disciplina_codigo}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="rounded-lg font-medium text-white cursor-pointer"
          style={{ padding: '10px 18px', fontSize: '13.5px', border: 'none', background: AZUL }}
        >
          Buscar
        </button>
      </form>

      {erro && (
        <p style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>{erro}</p>
      )}

      {carregando && (
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>Procurando...</p>
      )}

      {!carregando && !erro && resposta && (
        <>
          <div className="flex items-center justify-between" style={{
            gap: '12px', marginBottom: '13px', paddingBottom: '11px',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-tertiary)' }}>
              {resposta.total === 0
                ? 'Nenhum resultado'
                : `${resposta.total} ${resposta.total === 1 ? 'resultado' : 'resultados'}`}
            </span>

            <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)' }}>
              {resposta.modo === 'semantica'
                ? 'busca por significado'
                : 'busca por termos'}
            </span>
          </div>

          {resposta.total === 0 && (
            <div className="rounded-xl text-center" style={{
              padding: '36px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)',
            }}>
              <p className="font-medium" style={{ fontSize: '14.5px', color: 'var(--text-primary)', marginBottom: '5px' }}>
                Ninguém publicou algo parecido
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '16px', lineHeight: 1.6 }}>
                {resposta.modo === 'semantica'
                  ? 'A busca comparou o significado da sua pergunta com o das publicações das suas disciplinas e não encontrou equivalente. Vale publicar a dúvida.'
                  : 'Nenhuma publicação contém esses termos. Tente outras palavras, ou publique a dúvida no fórum.'}
              </p>
              <button
                onClick={() => navigate('/forum/novo')}
                className="rounded-lg font-medium text-white cursor-pointer"
                style={{ padding: '9px 18px', fontSize: '13.5px', border: 'none', background: AZUL }}
              >
                Publicar esta dúvida
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {resposta.resultados.map(resultado => (
              <article
                key={resultado.id}
                onClick={() => navigate(`/forum/${resultado.topico_id}`)}
                className="rounded-xl cursor-pointer"
                style={{
                  padding: '15px 18px', background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                }}
              >
                <div className="flex items-center" style={{ gap: '8px', marginBottom: '4px' }}>
                  <span className="font-semibold" style={{ fontSize: '11.5px', color: AZUL }}>
                    {resultado.disciplina_codigo}
                  </span>
                  {resultado.e_resposta && (
                    <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)' }}>
                      resposta
                    </span>
                  )}
                  {resultado.relevancia !== null && (
                    <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                      {Math.round(resultado.relevancia * 100)}% de proximidade
                    </span>
                  )}
                </div>

                <h2 className="font-medium" style={{ fontSize: '14.5px', color: 'var(--text-primary)' }}>
                  {resultado.titulo}
                </h2>

                <p style={{
                  fontSize: '13px', color: 'var(--text-secondary)',
                  margin: '5px 0 8px', lineHeight: 1.6,
                }}>
                  {resultado.trecho}
                </p>

                <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)' }}>
                  {resultado.autor_nome} · {data(resultado.created_at)}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {!carregando && !resposta && !erro && (
        <p style={{ fontSize: '13.5px', color: 'var(--text-tertiary)' }}>
          Escreva o que procura para começar.
        </p>
      )}
    </div>
  )
}
