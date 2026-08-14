/**
 * NovoTrabalhoPage — Proposta de trabalho em grupo pelo professor.
 *
 * O formulário segue a ordem das decisões reais: o que é o trabalho, quando
 * entrega, como a turma se divide. A escolha do modo de formação vem por
 * último porque depende das duas anteriores — só faz sentido decidir se
 * sorteia depois de saber quantos grupos e de que tamanho.
 *
 * O aviso de capacidade aparece enquanto se digita, e não ao salvar: descobrir
 * que a divisão não comporta a turma depois de preencher tudo é retrabalho.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'

import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

const AZUL = 'var(--accent-blue)'

const MODOS = [
  {
    valor: 'alunos',
    titulo: 'Os alunos se organizam',
    ajuda: 'Você abre os grupos e a turma escolhe onde entrar, até preencher as vagas.',
  },
  {
    valor: 'sorteio',
    titulo: 'Sorteio automático',
    ajuda: 'O sistema distribui os matriculados de forma equilibrada entre os grupos.',
  },
  {
    valor: 'professor',
    titulo: 'Você monta os grupos',
    ajuda: 'Os grupos ficam abertos e você inclui cada participante manualmente.',
  },
]

const campo = {
  width: '100%', padding: '10px 13px', fontSize: '13.5px', borderRadius: '9px',
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  border: '1px solid var(--border)',
}

const rotulo = {
  fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)',
  display: 'block', marginBottom: '5px',
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl" style={{
      padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: '14px',
    }}>
      <h2 className="font-semibold" style={{ fontSize: '14.5px', color: 'var(--text-primary)' }}>
        {titulo}
      </h2>
      {children}
    </section>
  )
}

export default function NovoTrabalhoPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [parametros] = useSearchParams()

  const [disciplina, setDisciplina] = useState(parametros.get('disciplina') || '')
  const [titulo, setTitulo] = useState('')
  const [especificacao, setEspecificacao] = useState('')
  const [totalGrupos, setTotalGrupos] = useState('4')
  const [tamanhoMaximo, setTamanhoMaximo] = useState('5')
  const [modo, setModo] = useState('alunos')
  const [prazo, setPrazo] = useState('')
  const [matriculados, setMatriculados] = useState<number | null>(null)
  const [anexos, setAnexos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)

  /* Só as disciplinas em que a pessoa leciona ou monitora: propor trabalho é
     atribuição de quem conduz a turma. */
  const minhas = (user?.papeis_disciplina || []).filter(
    vinculo => vinculo.papel === 'professor' || vinculo.papel === 'monitor'
  )

  useEffect(() => {
    if (!disciplina) {
      setMatriculados(null)
      return
    }

    api.get('/forum/permissoes/', { params: { disciplina, papel: 'aluno' } })
      .then(res => {
        const dados = Array.isArray(res.data) ? res.data : res.data.results || []
        setMatriculados(dados.length)
      })
      .catch(() => setMatriculados(null))
  }, [disciplina])

  const capacidade = Number(totalGrupos) * Number(tamanhoMaximo)
  const faltamVagas = matriculados !== null && matriculados > capacidade

  async function publicar(e: React.FormEvent) {
    e.preventDefault()

    if (!disciplina) return toast.error('Escolha a disciplina.')
    if (!titulo.trim()) return toast.error('Dê um título ao trabalho.')
    if (!prazo) return toast.error('Informe o prazo de entrega.')

    setEnviando(true)
    try {
      const { data } = await api.post('/colaboracao/trabalhos/', {
        disciplina,
        titulo: titulo.trim(),
        especificacao: especificacao.trim(),
        total_grupos: Number(totalGrupos),
        tamanho_maximo: Number(tamanhoMaximo),
        modo_formacao: modo,
        prazo_entrega: prazo,
      })

      /* Nos dois modos em que os grupos precisam existir de antemão, já os
         abrimos: exigir um segundo clique para algo obrigatório é atrito. */
      if (modo === 'alunos' || modo === 'professor') {
        await api.post(`/colaboracao/trabalhos/${data.id}/criar-grupos/`)
      }
      if (modo === 'sorteio') {
        await api.post(`/colaboracao/trabalhos/${data.id}/sortear/`)
      }

      /* Os anexos sobem depois da criação porque cada um precisa do
         identificador do trabalho. Enviados em sequência, e não em paralelo:
         a ordem em que aparecem para a turma é a mesma em que o professor os
         escolheu, e o servidor não recebe cinco uploads simultâneos. */
      for (const arquivo of anexos) {
        const corpo = new FormData()
        corpo.append('arquivo', arquivo)

        try {
          await api.post(`/colaboracao/trabalhos/${data.id}/anexar/`, corpo, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        } catch (erro: any) {
          /* Falha de anexo não desfaz a publicação: o trabalho já existe e o
             professor pode anexar de novo. Avisar qual arquivo falhou é mais
             útil do que abortar tudo. */
          toast.error(
            `${arquivo.name}: ${erro.response?.data?.detail || 'não foi enviado.'}`
          )
        }
      }

      toast.success('Trabalho publicado.')
      navigate(`/trabalhos?disciplina=${disciplina}`)
    } catch (err: any) {
      const dados = err.response?.data || {}
      toast.error(
        dados.detail || String(Object.values(dados).flat()[0] || 'Não foi possível publicar.')
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ maxWidth: '720px' }}>
      <Toaster position="top-right" toastOptions={{
        duration: 3500,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      <div className="flex items-center" style={{ gap: '14px', marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/trabalhos')}
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
        <div>
          <h1 className="font-bold tracking-tight" style={{ fontSize: '22px', color: 'var(--text-primary)' }}>
            Novo trabalho em grupo
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Defina o enunciado e como a turma se divide.
          </p>
        </div>
      </div>

      <form onSubmit={publicar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Secao titulo="O trabalho">
          <div>
            <label style={rotulo}>Disciplina</label>
            <select
              value={disciplina}
              onChange={(e) => setDisciplina(e.target.value)}
              style={campo}
              className="cursor-pointer outline-none"
            >
              <option value="">Selecione a disciplina</option>
              {minhas.map(vinculo => (
                <option key={vinculo.disciplina_id} value={vinculo.disciplina_id}>
                  {vinculo.disciplina_codigo} — {vinculo.disciplina_nome}
                </option>
              ))}
            </select>
            {matriculados !== null && (
              <p style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                {matriculados === 1
                  ? '1 estudante matriculado nesta turma.'
                  : `${matriculados} estudantes matriculados nesta turma.`}
              </p>
            )}
          </div>

          <div>
            <label style={rotulo}>Título</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Implementação de estrutura de dados"
              style={campo}
              className="outline-none"
            />
          </div>

          <div>
            <label style={rotulo}>Enunciado</label>
            <textarea
              value={especificacao}
              onChange={(e) => setEspecificacao(e.target.value)}
              rows={5}
              placeholder="O que deve ser entregue, critérios de avaliação e formato."
              style={{ ...campo, resize: 'vertical' }}
              className="outline-none"
            />
            <p style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Vale para todos os grupos. Temas individuais podem ser definidos
              em cada grupo depois.
            </p>
          </div>

          {/* Material de apoio.
              O enunciado raramente cabe em texto puro: vem com a especificação
              em PDF, a base de dados a processar, o esqueleto de código, a
              rubrica de correção. Sem lugar aqui, o professor distribuiria
              isso por outro canal — e o trabalho ficaria com o enunciado na
              plataforma e os arquivos fora dela. */}
          <div>
            <label style={rotulo}>Material de apoio</label>

            <label
              htmlFor="anexos-trabalho"
              className="flex items-center justify-center rounded-lg cursor-pointer"
              style={{
                padding: '14px', gap: '9px', fontSize: '13px',
                color: 'var(--accent-blue-text)',
                background: 'var(--accent-blue-soft)',
                border: '1px dashed var(--accent-blue-border)',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32" />
              </svg>
              Anexar arquivos ao enunciado
            </label>
            <input
              id="anexos-trabalho"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv,.md,.png,.jpg,.jpeg"
              style={{ display: 'none' }}
              onChange={(e) => {
                const escolhidos = Array.from(e.target.files || [])
                const grandes = escolhidos.filter(a => a.size > 20 * 1024 * 1024)

                if (grandes.length) {
                  toast.error(`${grandes[0].name} passa de 20 MB.`)
                }

                setAnexos(anteriores => [
                  ...anteriores,
                  ...escolhidos.filter(a => a.size <= 20 * 1024 * 1024),
                ])
                e.target.value = ''
              }}
            />

            <p style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
              Documento, planilha, apresentação, imagem ou arquivo compactado,
              até 20 MB cada. Fica visível para toda a turma.
            </p>

            {anexos.length > 0 && (
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                {anexos.map((arquivo, indice) => (
                  <li
                    key={`${arquivo.name}-${indice}`}
                    className="flex items-center rounded-lg"
                    style={{
                      padding: '9px 12px', gap: '10px',
                      background: 'var(--bg-input)', border: '1px solid var(--border)',
                    }}
                  >
                    <span className="flex-1 min-w-0 truncate" style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>
                      {arquivo.name}
                    </span>
                    <span className="flex-shrink-0" style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {arquivo.size < 1024 * 1024
                        ? `${Math.round(arquivo.size / 1024)} KB`
                        : `${(arquivo.size / (1024 * 1024)).toFixed(1)} MB`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAnexos(anteriores => anteriores.filter((_, i) => i !== indice))}
                      aria-label={`Remover ${arquivo.name}`}
                      className="flex-shrink-0 cursor-pointer"
                      style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', padding: '2px' }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label style={rotulo}>Prazo de entrega</label>
            <input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              style={{ ...campo, maxWidth: '200px' }}
              className="outline-none"
            />
          </div>
        </Secao>

        <Secao titulo="Divisão da turma">
          <div className="flex" style={{ gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={rotulo}>Quantidade de grupos</label>
              <input
                type="number" min={1} value={totalGrupos}
                onChange={(e) => setTotalGrupos(e.target.value)}
                style={campo} className="outline-none"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={rotulo}>Pessoas por grupo</label>
              <input
                type="number" min={1} value={tamanhoMaximo}
                onChange={(e) => setTamanhoMaximo(e.target.value)}
                style={campo} className="outline-none"
              />
            </div>
          </div>

          {/* O aviso aparece enquanto digita, não ao salvar. */}
          <div
            className="rounded-lg"
            style={{
              padding: '11px 14px',
              background: faltamVagas ? 'rgba(0,48,135,0.06)' : 'var(--bg-input)',
              border: `1px solid ${faltamVagas ? 'rgba(0,48,135,0.3)' : 'var(--border)'}`,
            }}
          >
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              A divisão comporta <strong>{capacidade || 0}</strong>
              {capacidade === 1 ? ' estudante.' : ' estudantes.'}
              {matriculados !== null && (
                faltamVagas
                  ? ` A turma tem ${matriculados} e ficaria gente de fora — aumente os grupos ou o tamanho.`
                  : ` A turma tem ${matriculados}, então todos cabem.`
              )}
            </p>
          </div>
        </Secao>

        <Secao titulo="Como os grupos se formam">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {MODOS.map(opcao => {
              const escolhido = modo === opcao.valor

              return (
                <label
                  key={opcao.valor}
                  className="flex items-start rounded-lg cursor-pointer"
                  style={{
                    padding: '12px 14px', gap: '11px',
                    background: escolhido ? 'rgba(0,48,135,0.05)' : 'var(--bg-input)',
                    border: `1px solid ${escolhido ? 'rgba(0,48,135,0.35)' : 'var(--border)'}`,
                  }}
                >
                  <input
                    type="radio"
                    name="modo"
                    checked={escolhido}
                    onChange={() => setModo(opcao.valor)}
                    style={{ marginTop: '3px' }}
                  />
                  <span>
                    <span style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: escolhido ? 600 : 400 }}>
                      {opcao.titulo}
                    </span>
                    <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      {opcao.ajuda}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </Secao>

        <div className="flex items-center" style={{ gap: '10px' }}>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-xl font-medium text-white cursor-pointer"
            style={{
              padding: '11px 22px', fontSize: '14px', border: 'none',
              background: AZUL, opacity: enviando ? 0.6 : 1,
            }}
          >
            {enviando ? 'Publicando...' : 'Publicar trabalho'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/trabalhos')}
            className="cursor-pointer"
            style={{ fontSize: '13px', background: 'none', border: 'none', color: 'var(--text-tertiary)' }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
