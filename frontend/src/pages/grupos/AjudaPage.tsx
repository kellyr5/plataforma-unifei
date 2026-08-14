/**
 * AjudaPage — fila de pedidos de ajuda vindos das conversas de grupo.
 *
 * O grupo trabalha em conversa privada. Quando trava, marca a mensagem e
 * descreve o impasse: só isso chega aqui. A tela existe para que a monitoria e
 * o professor vejam o ponto exato da dúvida sem ler a conversa inteira.
 *
 * "Assumir" antes de responder evita que duas pessoas escrevam a mesma coisa
 * ao mesmo tempo, situação comum quando monitor e professor acompanham a
 * mesma disciplina.
 */

import { useCallback, useEffect, useState } from 'react'
import toast, { Toaster } from 'react-hot-toast'

import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

interface Solicitacao {
  id: string
  mensagem: string
  mensagem_conteudo: string
  solicitante: string
  solicitante_nome: string
  descricao: string
  destino: string
  status: 'aberta' | 'em_atendimento' | 'resolvida'
  disciplina_codigo: string
  grupo_nome: string | null
  atendido_por: string | null
  atendido_por_nome: string | null
  resposta: string
  respondido_em: string | null
  created_at: string
}

const AZUL = 'var(--accent-blue)'

const SITUACAO: Record<Solicitacao['status'], string> = {
  aberta: 'Aguardando',
  em_atendimento: 'Em atendimento',
  resolvida: 'Respondido',
}

function quando(valor: string): string {
  const minutos = Math.floor((Date.now() - new Date(valor).getTime()) / 60000)

  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  if (minutos < 1440) return `há ${Math.floor(minutos / 60)} h`

  return new Date(valor).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/* ============================================================
   Um pedido
   ============================================================ */
function Pedido({ pedido, aoMudar }: {
  pedido: Solicitacao
  aoMudar: (atualizado: Solicitacao) => void
}) {
  const { user } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState(false)

  const meu = pedido.atendido_por === user?.id
  const resolvido = pedido.status === 'resolvida'

  async function assumir() {
    try {
      const { data } = await api.post(`/colaboracao/ajuda/${pedido.id}/assumir/`)
      aoMudar(data)
      setAberto(true)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Não foi possível assumir o pedido.')
    }
  }

  async function responder() {
    if (!resposta.trim()) {
      toast.error('Escreva a resposta antes de enviar.')
      return
    }

    setEnviando(true)
    try {
      const { data } = await api.post(`/colaboracao/ajuda/${pedido.id}/responder/`, {
        resposta: resposta.trim(),
      })
      aoMudar(data)
      toast.success('Resposta enviada ao grupo.')
      setAberto(false)
      setResposta('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Não foi possível responder.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="rounded-xl" style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', padding: '17px 19px',
    }}>
      <div className="flex items-start justify-between" style={{ gap: '14px' }}>
        <div className="min-w-0">
          <div className="flex items-center" style={{ gap: '8px', marginBottom: '5px' }}>
            <span className="font-semibold" style={{ fontSize: '12px', color: AZUL }}>
              {pedido.disciplina_codigo}
            </span>
            {pedido.grupo_nome && (
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                {pedido.grupo_nome}
              </span>
            )}
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              · {quando(pedido.created_at)}
            </span>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {pedido.solicitante_nome}
          </div>
        </div>

        <span
          className="flex-shrink-0 rounded-md"
          style={{
            padding: '3px 9px', fontSize: '11px', whiteSpace: 'nowrap',
            border: '1px solid var(--border)', color: 'var(--text-secondary)',
            background: 'var(--bg-input)',
          }}
        >
          {SITUACAO[pedido.status]}
          {pedido.atendido_por_nome && !resolvido ? ` · ${pedido.atendido_por_nome}` : ''}
        </span>
      </div>

      {/* A mensagem marcada, que é o recorte que sai do grupo. */}
      <div className="rounded-lg" style={{
        margin: '13px 0 10px', padding: '11px 13px',
        background: 'var(--bg-input)', border: '1px solid var(--border)',
        borderLeft: `3px solid ${AZUL}`,
        fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
      }}>
        {pedido.mensagem_conteudo || '(mensagem com anexo)'}
      </div>

      {pedido.descricao && (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {pedido.descricao}
        </p>
      )}

      {resolvido ? (
        <div className="rounded-lg" style={{
          marginTop: '12px', padding: '11px 13px',
          background: 'rgba(0,48,135,0.05)', border: '1px solid rgba(0,48,135,0.2)',
        }}>
          <div style={{ fontSize: '11.5px', color: AZUL, fontWeight: 600, marginBottom: '4px' }}>
            Resposta de {pedido.atendido_por_nome}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {pedido.resposta}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '13px' }}>
          {!pedido.atendido_por && (
            <button
              onClick={assumir}
              className="rounded-lg font-medium text-white cursor-pointer"
              style={{ padding: '8px 16px', fontSize: '13px', border: 'none', background: AZUL }}
            >
              Assumir
            </button>
          )}

          {meu && !aberto && (
            <button
              onClick={() => setAberto(true)}
              className="rounded-lg font-medium text-white cursor-pointer"
              style={{ padding: '8px 16px', fontSize: '13px', border: 'none', background: AZUL }}
            >
              Responder
            </button>
          )}

          {pedido.atendido_por && !meu && (
            <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)' }}>
              {pedido.atendido_por_nome} está atendendo este pedido.
            </p>
          )}

          {meu && aberto && (
            <div>
              <textarea
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                rows={4}
                placeholder="Responda ao grupo. A resposta chega na conversa deles."
                className="w-full rounded-lg outline-none"
                style={{
                  padding: '11px 13px', fontSize: '13px', resize: 'vertical',
                  background: 'var(--bg-input)', color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
              />
              <div className="flex items-center" style={{ gap: '9px', marginTop: '10px' }}>
                <button
                  onClick={responder}
                  disabled={enviando}
                  className="rounded-lg font-medium text-white cursor-pointer"
                  style={{
                    padding: '8px 17px', fontSize: '13px', border: 'none',
                    background: AZUL, opacity: enviando ? 0.6 : 1,
                  }}
                >
                  {enviando ? 'Enviando...' : 'Enviar resposta'}
                </button>
                <button
                  onClick={() => setAberto(false)}
                  className="cursor-pointer"
                  style={{ fontSize: '13px', background: 'none', border: 'none', color: 'var(--text-tertiary)' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   Página
   ============================================================ */
export default function AjudaPage() {
  const [pedidos, setPedidos] = useState<Solicitacao[]>([])
  const [filtro, setFiltro] = useState<'pendentes' | 'todos'>('pendentes')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(() => {
    api.get('/colaboracao/ajuda/')
      .then(({ data }) => setPedidos(Array.isArray(data) ? data : data.results || []))
      .catch(() => setErro('Não foi possível carregar os pedidos de ajuda.'))
      .finally(() => setCarregando(false))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function atualizar(pedido: Solicitacao) {
    setPedidos(anteriores => anteriores.map(p => (p.id === pedido.id ? pedido : p)))
  }

  const visiveis = filtro === 'pendentes'
    ? pedidos.filter(p => p.status !== 'resolvida')
    : pedidos

  const pendentes = pedidos.filter(p => p.status !== 'resolvida').length

  return (
    <div style={{ maxWidth: '780px' }}>
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      <h1 className="font-semibold" style={{ fontSize: '21px', color: 'var(--text-primary)' }}>
        Pedidos de ajuda
      </h1>
      <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: '5px 0 20px', lineHeight: 1.6 }}>
        Dúvidas que os grupos encaminharam a partir das conversas de trabalho.
        Você vê apenas a mensagem que o grupo marcou, não a conversa inteira.
      </p>

      <div className="flex items-center" style={{ gap: '7px', marginBottom: '17px' }}>
        {([['pendentes', `Pendentes (${pendentes})`], ['todos', 'Todos']] as const).map(([chave, rotulo]) => (
          <button
            key={chave}
            onClick={() => setFiltro(chave)}
            className="rounded-lg cursor-pointer"
            style={{
              padding: '6px 14px', fontSize: '13px',
              background: filtro === chave ? AZUL : 'var(--bg-card)',
              color: filtro === chave ? '#FFFFFF' : 'var(--text-secondary)',
              border: filtro === chave ? 'none' : '1px solid var(--border)',
            }}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {erro && (
        <p style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>{erro}</p>
      )}

      {carregando && !erro && (
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>Carregando...</p>
      )}

      {!carregando && !erro && visiveis.length === 0 && (
        <div className="rounded-xl text-center" style={{
          padding: '34px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)',
        }}>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            {filtro === 'pendentes'
              ? 'Nenhum pedido aguardando resposta.'
              : 'Nenhum pedido de ajuda registrado.'}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {visiveis.map(pedido => (
          <Pedido key={pedido.id} pedido={pedido} aoMudar={atualizar} />
        ))}
      </div>
    </div>
  )
}
