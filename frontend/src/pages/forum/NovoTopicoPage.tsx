/**
 * NovoTopicoPage — Criação de tópico em página própria.
 *
 * Antes o formulário abria dentro da listagem e empurrava os tópicos para
 * baixo, misturando duas tarefas na mesma tela: quem estava lendo perdia o
 * lugar, e quem estava escrevendo tinha a lista competindo por atenção.
 * Criar uma dúvida é uma tarefa com começo e fim, então merece uma página.
 *
 * Aqui também entra o anexo, que existia na API e não tinha caminho na
 * interface. O upload acontece depois que o tópico é criado, porque o arquivo
 * precisa de um post ao qual se vincular.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'

import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

interface Disciplina {
  id: string
  codigo: string
  nome: string
  periodo_sugerido: number | null
}

const TAMANHO_MAXIMO = 10 * 1024 * 1024

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function NovoTopicoPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [parametros] = useSearchParams()

  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])
  const [disciplina, setDisciplina] = useState(parametros.get('disciplina') || '')
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [anexos, setAnexos] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)

  /* Quem leciona publica material e aviso; quem estuda tira dúvida. É a mesma
     estrutura de post, mas chamar tudo de dúvida soaria errado ao professor. */
  const ensina = !!user && (user.e_professor || user.e_coordenacao)

  useEffect(() => {
    /* Só as disciplinas em que a pessoa tem vínculo. Abrir dúvida numa turma
       da qual ela não participa não faria sentido, e o fórum recusaria. Os
       vínculos já vêm no /auth/me/, então nem precisa de requisição. */
    setDisciplinas(
      (user?.papeis_disciplina || []).map(vinculo => ({
        id: vinculo.disciplina_id,
        codigo: vinculo.disciplina_codigo,
        nome: vinculo.disciplina_nome,
        periodo_sugerido: null,
      }))
    )
  }, [user])

  function adicionarArquivos(lista: FileList | null) {
    if (!lista) return

    const aceitos: File[] = []
    for (const arquivo of Array.from(lista)) {
      if (arquivo.size > TAMANHO_MAXIMO) {
        toast.error(`${arquivo.name} passa de 10 MB e não pode ser enviado.`)
        continue
      }
      aceitos.push(arquivo)
    }

    setAnexos(anteriores => [...anteriores, ...aceitos])
  }

  function removerArquivo(indice: number) {
    setAnexos(anteriores => anteriores.filter((_, i) => i !== indice))
  }

  async function publicar(e: React.FormEvent) {
    e.preventDefault()

    if (!disciplina) return toast.error('Escolha a disciplina.')
    if (!titulo.trim()) return toast.error('Escreva um título para a dúvida.')
    if (!conteudo.trim()) return toast.error('Descreva a dúvida.')

    setEnviando(true)
    try {
      const { data: topico } = await api.post('/forum/posts/', {
        titulo: titulo.trim(),
        conteudo: conteudo.trim(),
        disciplina,
      })

      // Os anexos vão um a um, e a falha de um não descarta o tópico já
      // publicado: o aluno pode reenviar o arquivo depois.
      for (const arquivo of anexos) {
        const corpo = new FormData()
        corpo.append('arquivo', arquivo)

        try {
          await api.post(`/forum/posts/${topico.id}/anexar/`, corpo, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        } catch {
          toast.error(`Não foi possível anexar ${arquivo.name}.`)
        }
      }

      toast.success(ensina ? 'Publicação criada.' : 'Dúvida publicada.')
      navigate(`/forum/${topico.id}`)
    } catch (err: any) {
      const detalhe = err.response?.data?.detail
        || err.response?.data?.titulo?.[0]
        || 'Não foi possível publicar a dúvida.'
      toast.error(detalhe)
    } finally {
      setEnviando(false)
    }
  }

  const campo = {
    width: '100%', padding: '11px 14px', fontSize: '14px', borderRadius: '10px',
    background: 'var(--bg-input)', color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  }

  return (
    <div style={{ maxWidth: '720px' }}>
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      <div className="flex items-center" style={{ gap: '14px', marginBottom: '22px' }}>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center rounded-lg cursor-pointer"
          style={{
            width: '36px', height: '36px', background: 'var(--bg-input)',
            border: '1px solid var(--border)', color: 'var(--text-secondary)',
          }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
        <div>
          <h1 className="font-bold tracking-tight" style={{ fontSize: '22px', color: 'var(--text-primary)' }}>
            {ensina ? 'Nova publicação' : 'Nova dúvida'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {ensina
              ? 'Publique aviso, material de apoio ou orientação para a turma.'
              : 'Descreva o que você não entendeu e anexe o material, se ajudar.'}
          </p>
        </div>
      </div>

      <form onSubmit={publicar} className="rounded-xl" style={{
        padding: '22px', background: 'var(--bg-card)', border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        <div>
          <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
            Disciplina
          </label>
          <select
            value={disciplina}
            onChange={(e) => setDisciplina(e.target.value)}
            style={{ ...campo, marginTop: '6px' }}
            className="cursor-pointer outline-none"
          >
            <option value="">Selecione a disciplina</option>
            {disciplinas.map(d => (
              <option key={d.id} value={d.id}>
                {d.codigo} — {d.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
            Título
          </label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Resuma a dúvida em uma frase"
            style={{ ...campo, marginTop: '6px' }}
            className="outline-none"
          />
        </div>

        <div>
          <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
            Descrição
          </label>
          <textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            placeholder={ensina
              ? 'Escreva o conteúdo da publicação e anexe o material, se houver.'
              : 'Explique o que já tentou e onde travou. Quanto mais contexto, melhor a resposta.'}
            rows={8}
            style={{ ...campo, marginTop: '6px', resize: 'vertical' }}
            className="outline-none"
          />
        </div>

        {/* Anexos */}
        <div>
          <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
            Anexos
          </label>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '2px 0 8px' }}>
            PDF, documentos e imagens, até 10 MB cada.
          </div>

          <label
            htmlFor="anexo-topico"
            className="inline-flex items-center rounded-lg font-medium cursor-pointer"
            style={{
              padding: '9px 15px', gap: '7px', fontSize: '13px',
              color: '#003087',
              background: 'rgba(0,48,135,0.06)',
              border: '1px solid rgba(0,48,135,0.25)',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
            </svg>
            Escolher arquivos
          </label>

          <input
            id="anexo-topico"
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            onChange={(e) => { adicionarArquivos(e.target.files); e.target.value = '' }}
            style={{ display: 'none' }}
          />

          {anexos.length > 0 && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {anexos.map((arquivo, indice) => (
                <div
                  key={`${arquivo.name}-${indice}`}
                  className="flex items-center rounded-lg"
                  style={{
                    padding: '8px 12px', gap: '10px',
                    background: 'var(--bg-input)', border: '1px solid var(--border)',
                  }}
                >
                  <span className="flex-1 truncate" style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    {arquivo.name}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    {tamanhoLegivel(arquivo.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removerArquivo(indice)}
                    aria-label={`Remover ${arquivo.name}`}
                    className="cursor-pointer"
                    style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)' }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center" style={{ gap: '10px', marginTop: '4px' }}>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-xl font-medium text-white cursor-pointer"
            style={{
              padding: '11px 22px', fontSize: '14px', border: 'none',
              background: '#003087', opacity: enviando ? 0.6 : 1,
            }}
          >
            {enviando ? 'Publicando...' : (ensina ? 'Publicar' : 'Publicar dúvida')}
          </button>

          <button
            type="button"
            onClick={() => navigate('/forum')}
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
