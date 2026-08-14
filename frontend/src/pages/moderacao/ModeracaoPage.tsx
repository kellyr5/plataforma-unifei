/**
 * ModeracaoPage — Fila de denúncias de conteúdo.
 *
 * Visível a monitores, professores e administradores. O backend já recorta a
 * fila por disciplina, então cada moderador recebe apenas o que lhe cabe
 * julgar; aqui não há filtro de permissão duplicado, só a apresentação.
 *
 * Esta tela é a triagem: o que chegou, de qual disciplina, e se alguém já
 * está cuidando. A decisão acontece em /moderacao/:id, onde o conteúdo
 * denunciado aparece por inteiro. Separar as duas coisas evita o que havia
 * antes — decidir a partir do título e do motivo, sem ler o que foi escrito.
 *
 * Assumir existe para evitar que dois moderadores trabalhem no mesmo caso:
 * quando alguém assume, os demais veem o nome do responsável e a análise
 * abre em leitura.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'

import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

interface Alerta {
  id: string
  denunciante: string
  denunciante_nome: string
  post: string
  post_titulo: string
  disciplina_codigo: string
  motivo: string
  status: 'pendente' | 'em_analise' | 'procedente' | 'improcedente'
  assumido_por: string | null
  assumido_por_nome: string | null
  resolvido_por_nome: string | null
  resolucao: string
  created_at: string
}

type Filtro = 'pendente' | 'em_analise' | 'resolvidas' | 'todas'

/**
 * Situação do caso.
 *
 * Azul para o que ainda exige trabalho, cinza para o que já foi decidido. Não
 * há verde nem vermelho: procedente e improcedente são desfechos igualmente
 * corretos da análise, e colori-los como acerto e erro sugere que o moderador
 * deveria preferir um deles.
 */
const statusConfig: Record<
  Alerta['status'],
  { rotulo: string; fundo: string; texto: string; borda: string }
> = {
  pendente: {
    rotulo: 'Pendente',
    fundo: 'var(--accent-blue-soft)',
    texto: 'var(--accent-blue-text)',
    borda: 'var(--accent-blue-border)',
  },
  em_analise: {
    rotulo: 'Em análise',
    fundo: 'var(--accent-blue-soft)',
    texto: 'var(--accent-blue-text)',
    borda: 'var(--accent-blue-border)',
  },
  procedente: {
    rotulo: 'Procedente',
    fundo: 'var(--bg-input)',
    texto: 'var(--text-secondary)',
    borda: 'var(--border)',
  },
  improcedente: {
    rotulo: 'Improcedente',
    fundo: 'var(--bg-input)',
    texto: 'var(--text-secondary)',
    borda: 'var(--border)',
  },
}

function dataLegivel(valor: string): string {
  return new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function Etiqueta({ status }: { status: Alerta['status'] }) {
  const config = statusConfig[status]

  return (
    <span
      style={{
        padding: '3px 10px', borderRadius: '10px',
        fontSize: '11px', fontWeight: 600,
        background: config.fundo, color: config.texto,
        border: `1px solid ${config.borda}`,
      }}
    >
      {config.rotulo}
    </span>
  )
}

/**
 * Um caso na fila.
 *
 * O cartão serve à triagem: o que foi denunciado, por quem, e se alguém já
 * está cuidando. A decisão em si acontece na página de análise, porque julgar
 * exige ler o conteúdo inteiro — e conteúdo inteiro não cabe numa lista sem
 * transformar a triagem em rolagem.
 */
function CardDenuncia({ alerta, usuarioId, aoAbrir }: {
  alerta: Alerta
  usuarioId: string
  aoAbrir: () => void
}) {
  const resolvida = alerta.status === 'procedente' || alerta.status === 'improcedente'
  const minha = alerta.assumido_por === usuarioId
  const deOutro = !!alerta.assumido_por && !minha

  return (
    <div
      className="rounded-xl"
      style={{
        padding: '18px 20px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        opacity: resolvida ? 0.65 : 1,
      }}
    >
      {/* Cabeçalho */}
      <div className="flex items-start justify-between" style={{ gap: '12px', marginBottom: '12px' }}>
        <div className="min-w-0">
          <div className="flex items-center" style={{ gap: '8px', marginBottom: '4px' }}>
            <Etiqueta status={alerta.status} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {alerta.disciplina_codigo}
            </span>
          </div>
          <div className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
            {alerta.post_titulo}
          </div>
        </div>
        <span className="flex-shrink-0" style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
          {dataLegivel(alerta.created_at)}
        </span>
      </div>

      {/* Motivo da denúncia */}
      <div
        style={{
          padding: '10px 14px', borderRadius: '8px', marginBottom: '12px',
          background: 'var(--bg-input)', fontSize: '13px',
          color: 'var(--text-secondary)', lineHeight: 1.5,
        }}
      >
        <strong style={{ color: 'var(--text-primary)' }}>{alerta.denunciante_nome}</strong> denunciou:{' '}
        {alerta.motivo}
      </div>

      {/* Desfecho, quando já resolvida */}
      {resolvida && (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Decidido por <strong>{alerta.resolvido_por_nome}</strong>: {alerta.resolucao}
        </div>
      )}

      {/* Caso em análise por outra pessoa */}
      {!resolvida && deOutro && (
        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
          Em análise por {alerta.assumido_por_nome}.
        </div>
      )}

      {/* Entrada para a análise. Quem já assumiu volta para onde parou; quem
          ainda não assumiu abre o caso para ler antes de decidir. */}
      {!resolvida && (
        <button
          onClick={aoAbrir}
          className="rounded-lg font-medium cursor-pointer"
          style={{
            padding: '8px 16px', fontSize: '13px', border: 'none',
            background: deOutro ? 'transparent' : 'var(--accent-blue)',
            color: deOutro ? 'var(--text-secondary)' : '#FFFFFF',
            boxShadow: deOutro ? 'inset 0 0 0 1px var(--border)' : 'none',
          }}
        >
          {minha ? 'Continuar análise' : deOutro ? 'Abrir somente leitura' : 'Analisar denúncia'}
        </button>
      )}
    </div>
  )
}

export default function ModeracaoPage() {
  const { user } = useAuth()
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [carregando, setCarregando] = useState(true)
  const [semAcesso, setSemAcesso] = useState(false)
  /* Começa em "todas" e não em "pendentes".
     Abrir num filtro vazio faz a fila parecer que não existe, mesmo havendo
     caso em análise — foi o que aconteceu com o professor, que via a aba
     "Em análise 1" e a tela dizendo que não havia nada. */
  const [filtro, setFiltro] = useState<Filtro>('todas')

  /* O painel da coordenação e os cartões do professor chegam aqui já
     apontando uma disciplina, então a fila respeita esse recorte. */
  const [parametros] = useSearchParams()
  const navigate = useNavigate()
  const disciplinaFiltrada = parametros.get('disciplina')
  const [nomeDisciplina, setNomeDisciplina] = useState('')

  /* O nome vem da própria disciplina, e não da primeira denúncia da lista:
     quando a fila está vazia não haveria de onde tirar, e é justamente aí que
     saber qual disciplina se está vendo importa mais. */
  useEffect(() => {
    if (!disciplinaFiltrada) {
      setNomeDisciplina('')
      return
    }

    api.get(`/forum/disciplinas/${disciplinaFiltrada}/`)
      .then(res => setNomeDisciplina(`${res.data.codigo} — ${res.data.nome}`))
      .catch(() => setNomeDisciplina(''))
  }, [disciplinaFiltrada])

  async function buscar() {
    try {
      const params: Record<string, string> = { ordering: '-created_at' }
      if (disciplinaFiltrada) params.disciplina = disciplinaFiltrada

      const res = await api.get('/forum/alertas/', { params })
      const dados = Array.isArray(res.data) ? res.data : res.data.results || []
      setAlertas(dados)
      setSemAcesso(false)
    } catch (err: any) {
      if (err.response?.status === 403) setSemAcesso(true)
      else toast.error('Não foi possível carregar a fila de moderação.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { buscar() }, [disciplinaFiltrada])

  const contagem = {
    pendente: alertas.filter(a => a.status === 'pendente').length,
    em_analise: alertas.filter(a => a.status === 'em_analise').length,
    resolvidas: alertas.filter(a => a.status === 'procedente' || a.status === 'improcedente').length,
    todas: alertas.length,
  }

  const visiveis = filtro === 'todas'
    ? alertas
    : filtro === 'resolvidas'
      ? alertas.filter(a => a.status === 'procedente' || a.status === 'improcedente')
      : alertas.filter(a => a.status === filtro)

  if (semAcesso) {
    return (
      <div className="rounded-xl text-center" style={{
        maxWidth: '700px', padding: '48px',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
      }}>
        <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
          Área restrita
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
          A moderação é acessível a monitores e professores das disciplinas, e à administração.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '760px' }}>
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      <div style={{ marginBottom: '24px' }}>
        <h1 className="font-bold tracking-tight" style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '4px' }}>
          {disciplinaFiltrada && nomeDisciplina
            ? `Moderação · ${nomeDisciplina}`
            : 'Moderação'}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          {disciplinaFiltrada
            ? 'Denúncias registradas nesta disciplina.'
            : 'Denúncias das disciplinas em que você atua.'}
        </p>

        {/* Quando se chega aqui pelo painel, o recorte precisa estar visível e
            ter saída óbvia, senão a fila parece vazia sem motivo aparente. */}
        {disciplinaFiltrada && (
          <button
            onClick={() => navigate('/moderacao')}
            className="cursor-pointer"
            style={{
              marginTop: '8px', fontSize: '12.5px', fontWeight: 500,
              background: 'none', border: 'none', color: 'var(--accent-blue)',
            }}
          >
            Ver todas as disciplinas
          </button>
        )}
      </div>

      <div className="flex items-center" style={{ gap: '6px', marginBottom: '20px' }}>
        {([
          { valor: 'todas' as const, rotulo: 'Todas' },
          { valor: 'pendente' as const, rotulo: 'Pendentes' },
          { valor: 'em_analise' as const, rotulo: 'Em análise' },
          { valor: 'resolvidas' as const, rotulo: 'Resolvidas' },
        ]).map(f => (
          <button
            key={f.valor}
            onClick={() => setFiltro(f.valor)}
            className="flex items-center rounded-lg font-medium cursor-pointer"
            style={{
              padding: '8px 14px', gap: '6px', fontSize: '13px',
              background: filtro === f.valor ? 'var(--accent-blue)' : 'var(--bg-input)',
              color: filtro === f.valor ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${filtro === f.valor ? 'var(--accent-blue)' : 'var(--border)'}`,
            }}
          >
            {f.rotulo}
            <span style={{
              padding: '0 6px', borderRadius: '10px', fontSize: '11px',
              background: filtro === f.valor ? 'rgba(255,255,255,0.2)' : 'var(--bg-hover)',
            }}>
              {contagem[f.valor]}
            </span>
          </button>
        ))}
      </div>

      {carregando ? (
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Carregando denúncias...</p>
      ) : visiveis.length === 0 ? (
        <div className="rounded-xl text-center" style={{
          padding: '48px', background: 'var(--bg-card)', border: '1px solid var(--border)',
        }}>
          <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Nada por aqui
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            Não há denúncias neste filtro.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visiveis.map(alerta => (
            <CardDenuncia
              key={alerta.id}
              alerta={alerta}
              usuarioId={user?.id || ''}
              aoAbrir={() => navigate(`/moderacao/${alerta.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
