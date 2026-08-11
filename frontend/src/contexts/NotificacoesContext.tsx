/**
 * NotificacoesContext — conexão WebSocket com o canal pessoal de notificações.
 *
 * Mantém uma única conexão viva enquanto o usuário estiver autenticado, em vez
 * de abrir uma por tela, e guarda o contador de não lidas que o badge da
 * Topbar consome. As notificações que chegam ficam disponíveis para quem
 * quiser exibi-las em tempo real, sem substituir a listagem paginada da API,
 * que continua sendo a fonte da verdade ao recarregar a página.
 *
 * A reconexão usa espera progressiva (1s, 2s, 4s, até 30s), para que uma queda
 * do servidor não vire uma enxurrada de tentativas vindas de todos os alunos
 * conectados ao mesmo tempo.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { useAuth } from './AuthContext'
import { getAccessToken } from '../services/api'
import { montarUrlWebSocket } from '../services/websocket'

export interface NotificacaoRecebida {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  lida: boolean
  created_at: string
  remetente_nome: string | null
  objeto_tipo: string | null
  objeto_id: string | null
}

interface NotificacoesContextType {
  naoLidas: number
  ultimas: NotificacaoRecebida[]
  conectado: boolean
  marcarComoLida: (id: string) => void
  atualizarContador: () => void
  limparUltimas: () => void
}

const ESPERA_INICIAL_MS = 1000
const ESPERA_MAXIMA_MS = 30000
const MAXIMO_EM_MEMORIA = 20

const NotificacoesContext = createContext<NotificacoesContextType | undefined>(undefined)

export function NotificacoesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()

  const [naoLidas, setNaoLidas] = useState(0)
  const [ultimas, setUltimas] = useState<NotificacaoRecebida[]>([])
  const [conectado, setConectado] = useState(false)

  const socketRef = useRef<WebSocket | null>(null)
  const tentativaRef = useRef(0)
  const timeoutRef = useRef<number | null>(null)
  // Evita que o cleanup do efeito seja lido como queda do servidor.
  const encerrandoRef = useRef(false)

  const conectar = useCallback(() => {
    const token = getAccessToken()
    if (!token) return

    const socket = new WebSocket(montarUrlWebSocket('/ws/notificacoes/', token))
    socketRef.current = socket

    socket.onopen = () => {
      setConectado(true)
      tentativaRef.current = 0
    }

    socket.onmessage = (evento) => {
      const dados = JSON.parse(evento.data)

      if (dados.tipo === 'conexao' || dados.tipo === 'nao_lidas') {
        setNaoLidas(dados.nao_lidas ?? dados.total ?? 0)
        return
      }

      if (dados.tipo === 'notificacao') {
        setUltimas((anteriores) =>
          [dados.notificacao, ...anteriores].slice(0, MAXIMO_EM_MEMORIA)
        )
        setNaoLidas(dados.nao_lidas ?? 0)
      }
    }

    socket.onclose = () => {
      setConectado(false)
      if (encerrandoRef.current) return

      // Espera progressiva antes de tentar de novo.
      const espera = Math.min(
        ESPERA_INICIAL_MS * 2 ** tentativaRef.current,
        ESPERA_MAXIMA_MS
      )
      tentativaRef.current += 1
      timeoutRef.current = window.setTimeout(conectar, espera)
    }

    socket.onerror = () => {
      socket.close()
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    encerrandoRef.current = false
    conectar()

    return () => {
      encerrandoRef.current = true
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
      socketRef.current?.close()
      socketRef.current = null
      setConectado(false)
    }
  }, [isAuthenticated, conectar])

  function enviar(mensagem: object) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(mensagem))
    }
  }

  function marcarComoLida(id: string) {
    enviar({ acao: 'marcar_lida', notificacao_id: id })
    setUltimas((anteriores) =>
      anteriores.map((item) => (item.id === id ? { ...item, lida: true } : item))
    )
  }

  /**
   * Pede ao servidor a contagem atual de não lidas.
   *
   * Necessário porque a tela de notificações marca como lida pela API REST, e
   * o contador do sino vive aqui. Sem esse pedido, o badge só se corrigiria no
   * próximo recarregamento da página.
   */
  function atualizarContador() {
    enviar({ acao: 'contar_nao_lidas' })
  }

  function limparUltimas() {
    setUltimas([])
  }

  return (
    <NotificacoesContext.Provider
      value={{
        naoLidas,
        ultimas,
        conectado,
        marcarComoLida,
        atualizarContador,
        limparUltimas,
      }}
    >
      {children}
    </NotificacoesContext.Provider>
  )
}

export function useNotificacoes() {
  const context = useContext(NotificacoesContext)
  if (!context) {
    throw new Error('useNotificacoes deve ser usado dentro de NotificacoesProvider')
  }
  return context
}
