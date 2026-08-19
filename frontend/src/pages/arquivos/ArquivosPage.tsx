/**
 * ArquivosPage — o material do semestre reunido num lugar so.
 *
 * O arquivo chega por tres caminhos: anexo de mensagem, material preso ao
 * enunciado de um trabalho e anexo de publicacao no forum. Ate aqui, cada um
 * ficava onde caiu, e reencontrar exigia lembrar o caminho — descer dois meses
 * de conversa atras da especificacao recebida em marco.
 *
 * O agrupamento e por disciplina porque e assim que o semestre e vivido. O
 * filtro por origem existe para o caso oposto, quando a pessoa lembra do
 * caminho mas nao da materia.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import api from '../../services/api'

interface ArquivoAcervo {
  id: string
  nome: string
  url: string
  tamanho_bytes: number
  tipo_mime: string
  origem: 'conversa' | 'trabalho' | 'forum'
  origem_rotulo: string
  contexto: string
  contexto_url: string
  enviado_por: string
  enviado_por_id: string
  enviado_por_mim: boolean
  data: string
}

interface GrupoAcervo {
  disciplina_id: string | null
  disciplina_codigo: string
  disciplina_nome: string
  total: number
  arquivos: ArquivoAcervo[]
}

type Origem = 'todas' | 'conversa' | 'trabalho' | 'forum'

/* Ícone por família de arquivo. A extensão é o que a pessoa reconhece de
   relance — o tipo MIME nem sempre vem preenchido nos anexos de conversa. */
function familiaDoArquivo(nome: string, tipoMime: string): string {
  const extensao = nome.split('.').pop()?.toLowerCase() ?? ''

  if (tipoMime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extensao)) {
    return 'imagem'
  }
  if (tipoMime.startsWith('audio/') || ['mp3', 'ogg', 'webm', 'm4a'].includes(extensao)) {
    return 'audio'
  }
  if (extensao === 'pdf') return 'pdf'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extensao)) return 'compactado'
  if (['xls', 'xlsx', 'csv'].includes(extensao)) return 'planilha'
  if (['py', 'c', 'cpp', 'java', 'js', 'ts', 'sql', 'ipynb'].includes(extensao)) return 'codigo'
  return 'documento'
}

const ICONES: Record<string, React.ReactNode> = {
  pdf: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />,
  imagem: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />,
  audio: <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />,
  planilha: <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5c-.621 0-1.125-.504-1.125-1.125m0 0V5.625m0 12.75h-9.75" />,
  codigo: <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />,
  compactado: <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />,
  documento: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />,
}

function formatarTamanho(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function LinhaArquivo({ arquivo, ultima }: { arquivo: ArquivoAcervo; ultima: boolean }) {
  const navigate = useNavigate()
  const familia = familiaDoArquivo(arquivo.nome, arquivo.tipo_mime)
  const tamanho = formatarTamanho(arquivo.tamanho_bytes)

  return (
    <div
      className="flex items-center"
      style={{
        gap: '12px',
        padding: '12px 0',
        borderBottom: ultima ? 'none' : '1px solid var(--border)',
      }}
    >
      <div
        className="flex items-center justify-center rounded-lg flex-shrink-0"
        style={{
          width: '38px', height: '38px',
          background: 'var(--accent-blue-soft)',
          color: 'var(--accent-blue-text)',
        }}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          {ICONES[familia] ?? ICONES.documento}
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="font-medium truncate"
          style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}
          title={arquivo.nome}
        >
          {arquivo.nome}
        </div>

        {/* Origem, contexto e autoria numa linha só. São as três perguntas que
            a pessoa faz ao procurar: de onde veio, de qual trabalho, quem
            mandou. */}
        <div
          className="flex items-center flex-wrap"
          style={{ gap: '4px 8px', fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '3px' }}
        >
          <span>{arquivo.origem_rotulo}</span>
          <span aria-hidden="true">·</span>
          <button
            onClick={() => navigate(arquivo.contexto_url)}
            className="cursor-pointer truncate"
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: '11.5px', color: 'var(--accent-blue-text)',
              maxWidth: '200px', textAlign: 'left',
            }}
          >
            {arquivo.contexto}
          </button>
          <span aria-hidden="true">·</span>
          <span>{arquivo.enviado_por_mim ? 'você' : arquivo.enviado_por}</span>
          <span aria-hidden="true">·</span>
          <span>{formatarData(arquivo.data)}</span>
          {tamanho && (
            <>
              <span aria-hidden="true">·</span>
              <span>{tamanho}</span>
            </>
          )}
        </div>
      </div>

      <a
        href={arquivo.url}
        download={arquivo.nome}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Baixar ${arquivo.nome}`}
        className="flex items-center justify-center rounded-lg flex-shrink-0"
        style={{
          width: '36px', height: '36px',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
        }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      </a>
    </div>
  )
}

export function ArquivosPage() {
  const [grupos, setGrupos] = useState<GrupoAcervo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [origem, setOrigem] = useState<Origem>('todas')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    api.get('/colaboracao/arquivos/')
      .then(({ data }) => setGrupos(data.grupos ?? []))
      .catch(() => setGrupos([]))
      .finally(() => setCarregando(false))
  }, [])

  /* O filtro roda no navegador porque o acervo de um semestre são dezenas de
     arquivos, não milhares. Ida ao servidor a cada tecla digitada custaria
     mais do que a filtragem inteira. */
  const gruposFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return grupos
      .map(grupo => ({
        ...grupo,
        arquivos: grupo.arquivos.filter(arquivo => {
          if (origem !== 'todas' && arquivo.origem !== origem) return false
          if (!termo) return true
          return (
            arquivo.nome.toLowerCase().includes(termo) ||
            arquivo.contexto.toLowerCase().includes(termo) ||
            arquivo.enviado_por.toLowerCase().includes(termo)
          )
        }),
      }))
      .filter(grupo => grupo.arquivos.length > 0)
  }, [grupos, origem, busca])

  const totalGeral = grupos.reduce((soma, g) => soma + g.total, 0)
  const totalVisivel = gruposFiltrados.reduce((soma, g) => soma + g.arquivos.length, 0)

  const contagemPorOrigem = useMemo(() => {
    const contagem = { conversa: 0, trabalho: 0, forum: 0 }
    grupos.forEach(g => g.arquivos.forEach(a => { contagem[a.origem] += 1 }))
    return contagem
  }, [grupos])

  if (carregando) {
    return (
      <div className="flex items-center justify-center" style={{ height: '200px', color: 'var(--text-secondary)', fontSize: '14px' }}>
        Carregando arquivos...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 className="font-semibold" style={{ fontSize: '22px', color: 'var(--text-primary)', marginBottom: '4px' }}>
          Arquivos
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          {totalGeral === 0
            ? 'Nenhum arquivo compartilhado ainda.'
            : `${totalGeral} ${totalGeral === 1 ? 'arquivo' : 'arquivos'} das conversas, dos trabalhos e do fórum, separados por disciplina.`}
        </p>
      </div>

      {totalGeral > 0 && (
        <div
          className="flex items-center flex-wrap"
          style={{ gap: '10px', marginBottom: '20px' }}
        >
          <div
            className="flex items-center flex-1"
            style={{
              minWidth: '200px', maxWidth: '320px', gap: '8px',
              padding: '8px 14px', borderRadius: '10px',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
            }}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome, trabalho ou pessoa..."
              aria-label="Buscar nos arquivos"
              className="flex-1 min-w-0 bg-transparent outline-none"
              style={{ fontSize: '13px', color: 'var(--text-primary)' }}
            />
          </div>

          <div className="flex items-center flex-wrap" style={{ gap: '7px' }}>
            {([
              ['todas', 'Todos', totalGeral],
              ['conversa', 'Conversas', contagemPorOrigem.conversa],
              ['trabalho', 'Trabalhos', contagemPorOrigem.trabalho],
              ['forum', 'Fórum', contagemPorOrigem.forum],
            ] as const).map(([chave, rotulo, total]) => {
              const ativo = origem === chave
              return (
                <button
                  key={chave}
                  onClick={() => setOrigem(chave)}
                  aria-pressed={ativo}
                  className="cursor-pointer rounded-lg font-medium"
                  style={{
                    padding: '7px 13px',
                    fontSize: '12.5px',
                    border: `1px solid ${ativo ? 'var(--accent-blue)' : 'var(--border)'}`,
                    background: ativo ? 'var(--accent-blue)' : 'var(--bg-card)',
                    color: ativo ? '#FFFFFF' : 'var(--text-secondary)',
                  }}
                >
                  {rotulo}
                  <span style={{ marginLeft: '6px', opacity: 0.7 }}>{total}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {totalGeral === 0 ? (
        <div
          className="rounded-xl text-center"
          style={{ padding: '48px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Nenhum arquivo ainda
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            Os anexos que você enviar ou receber nas conversas, nos trabalhos e no fórum aparecem aqui.
          </p>
        </div>
      ) : totalVisivel === 0 ? (
        <div
          className="rounded-xl text-center"
          style={{ padding: '40px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Nenhum arquivo corresponde a esse filtro.
          </p>
        </div>
      ) : (
        gruposFiltrados.map(grupo => (
          <div
            key={grupo.disciplina_codigo || 'sem-disciplina'}
            className="rounded-xl"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              padding: '16px 18px',
              marginBottom: '14px',
            }}
          >
            <div
              className="flex items-baseline flex-wrap"
              style={{ gap: '4px 10px', marginBottom: '6px' }}
            >
              {grupo.disciplina_codigo && (
                <span className="font-semibold" style={{ fontSize: '13px', color: 'var(--accent-blue-text)' }}>
                  {grupo.disciplina_codigo}
                </span>
              )}
              <span className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                {grupo.disciplina_nome}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {grupo.arquivos.length}
                {grupo.arquivos.length === 1 ? ' arquivo' : ' arquivos'}
              </span>
            </div>

            {grupo.arquivos.map((arquivo, indice) => (
              <LinhaArquivo
                key={`${arquivo.origem}-${arquivo.id}`}
                arquivo={arquivo}
                ultima={indice === grupo.arquivos.length - 1}
              />
            ))}
          </div>
        ))
      )}
    </div>
  )
}

export default ArquivosPage
