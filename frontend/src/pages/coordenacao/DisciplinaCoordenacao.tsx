/**
 * DisciplinaCoordenacao — Gestão de uma disciplina pela coordenação.
 *
 * Reúne as três atribuições que o SIGAA separa em telas distintas: quem
 * leciona, quem monitora e quem está matriculado. Ficam juntas aqui porque a
 * coordenação decide as três no mesmo momento, ao montar a oferta do semestre.
 *
 * O cadastro segue o modelo institucional: a coordenação informa nome, CPF,
 * matrícula e email, a conta nasce inativa e a pessoa a ativa no primeiro
 * acesso, com o mesmo código enviado por email aos demais. Assim não existe
 * senha provisória circulando por terceiros.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'

import api from '../../services/api'

interface Disciplina {
  id: string
  codigo: string
  nome: string
  periodo_sugerido: number | null
  carga_horaria: number | null
  semestre: string
  ementa: string
  curso_nome: string | null
  pre_requisitos_codigos: string[]
}

interface Vinculo {
  id: string
  usuario: string
  usuario_nome: string
  usuario_cpf: string
  papel: 'aluno' | 'monitor' | 'professor'
  ativo: boolean
}

interface Pessoa {
  id: string
  nome_completo: string
  cpf: string
  matricula: string
  email: string
  ativo: boolean
}

const AZUL = '#003087'

const PAPEL_ROTULO: Record<Vinculo['papel'], string> = {
  professor: 'Professor',
  monitor: 'Monitoria',
  aluno: 'Estudante',
}

const campo = {
  width: '100%', padding: '9px 12px', fontSize: '13px', borderRadius: '8px',
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  border: '1px solid var(--border)',
}

/* ============================================================
   Vincular alguém que já existe na plataforma
   ============================================================ */
function BuscaPessoa({ papel, disciplinaId, aoVincular }: {
  papel: Vinculo['papel']
  disciplinaId: string
  aoVincular: () => void
}) {
  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState<Pessoa[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    if (termo.trim().length < 3) {
      setResultados([])
      return
    }

    // Espera o usuário parar de digitar antes de consultar, para não gerar
    // uma requisição por tecla pressionada.
    const temporizador = window.setTimeout(async () => {
      setBuscando(true)
      try {
        const { data } = await api.get('/auth/usuarios/', { params: { busca: termo } })
        setResultados(data)
      } catch {
        setResultados([])
      } finally {
        setBuscando(false)
      }
    }, 400)

    return () => window.clearTimeout(temporizador)
  }, [termo])

  async function vincular(pessoa: Pessoa) {
    try {
      await api.post('/forum/permissoes/', {
        usuario: pessoa.id,
        disciplina: disciplinaId,
        papel,
      })
      toast.success(`${pessoa.nome_completo} vinculada como ${PAPEL_ROTULO[papel].toLowerCase()}.`)
      setTermo('')
      setResultados([])
      aoVincular()
    } catch (err: any) {
      const dados = err.response?.data || {}
      toast.error(
        dados.detail
        || dados.papel?.[0]
        || dados.non_field_errors?.[0]
        || 'Não foi possível vincular esta pessoa.'
      )
    }
  }

  return (
    <div>
      <input
        type="text"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Buscar por nome, CPF ou matrícula"
        style={campo}
        className="outline-none"
      />

      {buscando && (
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
          Buscando...
        </p>
      )}

      {resultados.length > 0 && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {resultados.map(pessoa => (
            <button
              key={pessoa.id}
              onClick={() => vincular(pessoa)}
              className="flex items-center text-left rounded-lg cursor-pointer"
              style={{
                padding: '9px 12px', gap: '10px',
                background: 'var(--bg-input)', border: '1px solid var(--border)',
              }}
            >
              <span className="flex-1 min-w-0">
                <span className="block truncate" style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                  {pessoa.nome_completo}
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)' }}>
                  {pessoa.matricula || pessoa.cpf}
                  {!pessoa.ativo && ' · conta ainda não ativada'}
                </span>
              </span>
              <span style={{ fontSize: '12px', color: AZUL, fontWeight: 500 }}>Vincular</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   Pré-cadastro institucional
   ============================================================ */
function PreCadastro({ papel, disciplinaId, aoCadastrar }: {
  papel: Vinculo['papel']
  disciplinaId: string
  aoCadastrar: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [matricula, setMatricula] = useState('')
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)

    try {
      const { data } = await api.post('/auth/pre-cadastro/', {
        nome_completo: nome.trim(),
        cpf: cpf.trim(),
        matricula: matricula.trim(),
        email: email.trim(),
        disciplina: disciplinaId,
        papel,
      })
      toast.success(data.detail)
      setNome(''); setCpf(''); setMatricula(''); setEmail('')
      setAberto(false)
      aoCadastrar()
    } catch (err: any) {
      const dados = err.response?.data || {}
      const primeiro = dados.detail
        || dados.cpf?.[0] || dados.email?.[0] || dados.nome_completo?.[0]
        || 'Não foi possível cadastrar.'
      toast.error(primeiro)
    } finally {
      setEnviando(false)
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="cursor-pointer"
        style={{
          marginTop: '10px', fontSize: '12.5px', fontWeight: 500,
          background: 'none', border: 'none', color: AZUL,
        }}
      >
        Não está na plataforma? Cadastrar
      </button>
    )
  }

  return (
    <form onSubmit={cadastrar} style={{
      marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: '8px',
    }}>
      <input value={nome} onChange={(e) => setNome(e.target.value)}
        placeholder="Nome completo" style={campo} className="outline-none" required />

      <div className="flex" style={{ gap: '8px' }}>
        <input value={cpf} onChange={(e) => setCpf(e.target.value)}
          placeholder="CPF" style={campo} className="outline-none" required />
        <input value={matricula} onChange={(e) => setMatricula(e.target.value)}
          placeholder="Matrícula" style={campo} className="outline-none" />
      </div>

      <input value={email} onChange={(e) => setEmail(e.target.value)}
        type="email" placeholder="Email institucional" style={campo}
        className="outline-none" required />

      <p style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
        A conta é criada inativa. A pessoa define a própria senha no primeiro
        acesso, validando o código enviado a esse email.
      </p>

      <div className="flex items-center" style={{ gap: '8px' }}>
        <button type="submit" disabled={enviando}
          className="rounded-lg font-medium text-white cursor-pointer"
          style={{
            padding: '8px 16px', fontSize: '13px', border: 'none',
            background: AZUL, opacity: enviando ? 0.6 : 1,
          }}>
          {enviando ? 'Cadastrando...' : 'Cadastrar e vincular'}
        </button>
        <button type="button" onClick={() => setAberto(false)}
          className="cursor-pointer"
          style={{ fontSize: '12px', background: 'none', border: 'none', color: 'var(--text-tertiary)' }}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/* ============================================================
   Bloco de um papel
   ============================================================ */
function BlocoPapel({ papel, descricao, vinculos, disciplinaId, aoMudar }: {
  papel: Vinculo['papel']
  descricao: string
  vinculos: Vinculo[]
  disciplinaId: string
  aoMudar: () => void
}) {
  const doPapel = vinculos.filter(v => v.papel === papel)

  async function remover(vinculo: Vinculo) {
    try {
      await api.delete(`/forum/permissoes/${vinculo.id}/`)
      toast.success('Vínculo removido.')
      aoMudar()
    } catch {
      toast.error('Não foi possível remover o vínculo.')
    }
  }

  return (
    <section className="rounded-xl" style={{
      padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border)',
    }}>
      <h2 className="font-semibold" style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
        {PAPEL_ROTULO[papel]}
      </h2>
      <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', margin: '3px 0 14px' }}>
        {descricao}
      </p>

      {doPapel.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
          Ninguém atribuído.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
          {doPapel.map(vinculo => (
            <div key={vinculo.id} className="flex items-center rounded-lg" style={{
              padding: '9px 12px', gap: '10px',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
            }}>
              <span className="flex-1 min-w-0 truncate" style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                {vinculo.usuario_nome}
              </span>
              <button
                onClick={() => remover(vinculo)}
                className="cursor-pointer"
                style={{ fontSize: '12px', background: 'none', border: 'none', color: 'var(--text-tertiary)' }}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}

      <BuscaPessoa papel={papel} disciplinaId={disciplinaId} aoVincular={aoMudar} />
      <PreCadastro papel={papel} disciplinaId={disciplinaId} aoCadastrar={aoMudar} />
    </section>
  )
}

/* ============================================================
   Página
   ============================================================ */
export default function DisciplinaCoordenacao() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [disciplina, setDisciplina] = useState<Disciplina | null>(null)
  const [vinculos, setVinculos] = useState<Vinculo[]>([])
  const [carregando, setCarregando] = useState(true)

  const carregar = useCallback(async () => {
    try {
      const [disc, perm] = await Promise.all([
        api.get(`/forum/disciplinas/${id}/`),
        api.get('/forum/permissoes/', { params: { disciplina: id } }),
      ])
      setDisciplina(disc.data)
      setVinculos(Array.isArray(perm.data) ? perm.data : perm.data.results || [])
    } catch {
      toast.error('Não foi possível carregar a disciplina.')
    } finally {
      setCarregando(false)
    }
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  if (carregando) {
    return <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Carregando disciplina...</p>
  }

  if (!disciplina) return null

  const alunos = vinculos.filter(v => v.papel === 'aluno').length

  return (
    <div style={{ maxWidth: '900px' }}>
      <Toaster position="top-right" toastOptions={{
        duration: 3500,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      {/* Cabeçalho */}
      <div className="flex items-start" style={{ gap: '14px', marginBottom: '20px' }}>
        <button
          onClick={() => navigate('/dashboard')}
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

        <div className="flex-1">
          <div className="flex items-center" style={{ gap: '9px', marginBottom: '3px' }}>
            <h1 className="font-bold tracking-tight" style={{ fontSize: '22px', color: 'var(--text-primary)' }}>
              {disciplina.codigo}
            </h1>
            {disciplina.periodo_sugerido && (
              <span className="rounded" style={{
                padding: '2px 7px', fontSize: '11px', fontWeight: 600,
                background: 'var(--bg-input)', color: 'var(--text-tertiary)',
              }}>
                {disciplina.periodo_sugerido}º período
              </span>
            )}
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            {disciplina.nome}
          </p>
          <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
            {disciplina.curso_nome}
            {disciplina.carga_horaria ? ` · ${disciplina.carga_horaria}h` : ''}
            {` · ${alunos} estudante(s) matriculado(s)`}
            {disciplina.pre_requisitos_codigos.length > 0
              && ` · pré-requisitos: ${disciplina.pre_requisitos_codigos.join(', ')}`}
          </p>
        </div>
      </div>

      {/* Ementa */}
      {disciplina.ementa && (
        <section className="rounded-xl" style={{
          padding: '18px 20px', marginBottom: '16px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
        }}>
          <h2 className="font-semibold" style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '6px' }}>
            Ementa
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            {disciplina.ementa}
          </p>
        </section>
      )}

      {/* Atribuições */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <BlocoPapel
          papel="professor"
          descricao="Responsável pela disciplina. Modera o fórum e publica material."
          vinculos={vinculos}
          disciplinaId={disciplina.id}
          aoMudar={carregar}
        />

        <BlocoPapel
          papel="monitor"
          descricao="Opcional. Quem já for aluno da disciplina passa a monitor ao ser vinculado aqui."
          vinculos={vinculos}
          disciplinaId={disciplina.id}
          aoMudar={carregar}
        />
      </div>

      {/* A matrícula de estudantes não é atribuição da coordenação aqui: ela
          vem do sistema acadêmico. Mostramos o número apenas como contexto. */}
      <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', marginTop: '14px' }}>
        Os {alunos} estudante(s) matriculado(s) vêm do sistema acadêmico e não
        são atribuídos por aqui.
      </p>
    </div>
  )
}
