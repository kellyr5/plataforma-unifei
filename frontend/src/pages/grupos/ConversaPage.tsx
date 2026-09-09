/**
 * ConversaPage — Chat do grupo de trabalho.
 *
 * As mensagens chegam por WebSocket e o histórico vem por HTTP na abertura.
 * Os dois caminhos coexistem porque o socket entrega o que acontece agora, e
 * o histórico é o que já aconteceu — pedir tudo pelo socket obrigaria a
 * conexão a carregar meses de conversa antes da primeira mensagem aparecer.
 *
 * O anexo vai por HTTP mesmo com o socket aberto: arquivo em base64 sobre
 * WebSocket é pesado e trava a conexão para todo mundo na conversa.
 *
 * Marcar uma mensagem como dúvida é o único ponto em que conteúdo daqui sai
 * do grupo. O aviso na tela deixa isso explícito antes do envio.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'

import api, { getAccessToken } from '../../services/api'
import { montarUrlWebSocket } from '../../services/websocket'
import { useAuth } from '../../contexts/AuthContext'

interface Mensagem {
  id: string
  autor: string
  autor_nome: string
  conteudo: string
  arquivo_url: string | null
  nome_original: string
  tipo_midia: 'texto' | 'imagem' | 'documento' | 'audio'
  tem_pedido_ajuda: boolean
  created_at: string
}

interface Conversa {
  id: string
  tipo: string
  titulo: string
  arquivada_em: string | null
  total_participantes: number
}

const AZUL = 'var(--accent-blue)'

function hora(valor: string): string {
  return new Date(valor).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  })
}

function dia(valor: string): string {
  const data = new Date(valor)
  const hoje = new Date()

  if (data.toDateString() === hoje.toDateString()) return 'Hoje'

  const ontem = new Date(hoje)
  ontem.setDate(ontem.getDate() - 1)
  if (data.toDateString() === ontem.toDateString()) return 'Ontem'

  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
}

/* ============================================================
   Uma mensagem
   ============================================================ */
/**
 * Prazo para desfazer o envio, em milissegundos.
 *
 * O mesmo valor está no servidor, que é quem decide de fato. Aqui ele serve
 * só para esconder um botão que o backend recusaria — oferecer a ação e
 * responder com erro é pior do que não oferecer.
 */
const PRAZO_EXCLUSAO = 10 * 60 * 1000

/* O papel vem do vínculo com a disciplina e é exibido ao lado do nome. */
const ROTULO_PAPEL: Record<string, string> = {
  professor: 'professor',
  monitor: 'monitoria',
  aluno: 'aluno',
}

function Balao({ mensagem, minha, aoPedirAjuda, aoApagar }: {
  mensagem: Mensagem
  minha: boolean
  aoPedirAjuda: () => void
  aoApagar: () => void
}) {
  const [hovered, setHovered] = useState(false)

  /* Recalculado a cada segundo enquanto a janela está aberta, senão o botão
     continuaria visível depois do prazo até a próxima renderização. */
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    if (!minha) return

    const enviada = new Date(mensagem.created_at).getTime()
    if (Date.now() - enviada > PRAZO_EXCLUSAO) return

    const relogio = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(relogio)
  }, [minha, mensagem.created_at])

  const dentroDoPrazo =
    minha
    && !mensagem.tem_pedido_ajuda
    && agora - new Date(mensagem.created_at).getTime() <= PRAZO_EXCLUSAO

  return (
    <div
      className="flex"
      style={{ justifyContent: minha ? 'flex-end' : 'flex-start' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* O balão não acompanha a largura da tela: em monitor grande, uma linha
        de mensagem atravessando 900 px fica difícil de ler. O limite em
        pixels, e não em porcentagem, mantém o comprimento de linha estável
        independentemente do tamanho da janela. */}
    <div style={{ maxWidth: 'min(78%, 560px)' }}>
        {!minha && (
          <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginBottom: '3px', paddingLeft: '2px' }}>
            {mensagem.autor_nome}
          </div>
        )}

        <div
          className="rounded-xl"
          style={{
            padding: '10px 13px',
            background: minha ? AZUL : 'var(--bg-card)',
            color: minha ? '#FFFFFF' : 'var(--text-primary)',
            border: minha ? 'none' : '1px solid var(--border)',
            borderTopRightRadius: minha ? '4px' : undefined,
            borderTopLeftRadius: minha ? undefined : '4px',
          }}
        >
          {mensagem.tipo_midia === 'imagem' && mensagem.arquivo_url && (
            <img
              src={mensagem.arquivo_url}
              alt={mensagem.nome_original}
              style={{
                maxWidth: '100%', borderRadius: '8px',
                marginBottom: mensagem.conteudo ? '8px' : 0, display: 'block',
              }}
            />
          )}

          {mensagem.tipo_midia === 'audio' && mensagem.arquivo_url && (
            <audio controls src={mensagem.arquivo_url} style={{ maxWidth: '260px' }} />
          )}

          {mensagem.tipo_midia === 'documento' && mensagem.arquivo_url && (
            <a
              href={mensagem.arquivo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
              style={{
                gap: '8px', fontSize: '13px', textDecoration: 'underline',
                color: minha ? '#FFFFFF' : AZUL,
                marginBottom: mensagem.conteudo ? '8px' : 0,
              }}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32" />
              </svg>
              {mensagem.nome_original || 'arquivo'}
            </a>
          )}

          {mensagem.conteudo && (
            <div style={{ fontSize: '13.5px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
              {mensagem.conteudo}
            </div>
          )}

          <div
            style={{
              fontSize: '10.5px', marginTop: '5px', textAlign: 'right',
              color: minha ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)',
            }}
          >
            {hora(mensagem.created_at)}
          </div>
        </div>

        <div className="flex items-center" style={{ gap: '12px', marginTop: '3px', justifyContent: minha ? 'flex-end' : 'flex-start' }}>
          {mensagem.tem_pedido_ajuda ? (
            <span style={{ fontSize: '11px', color: AZUL, fontWeight: 500 }}>
              ajuda solicitada
            </span>
          ) : (
            hovered && (
              <>
                {/* Só a própria mensagem, e só nos primeiros três minutos.
                    Depois disso a conversa já produziu efeito: o grupo dividiu
                    tarefa a partir dela, e apagar seria reescrever o que ficou
                    combinado. */}
                {dentroDoPrazo && (
                  <button
                    onClick={aoApagar}
                    className="cursor-pointer"
                    style={{ fontSize: '11px', background: 'none', border: 'none', color: 'var(--text-tertiary)' }}
                  >
                    Apagar
                  </button>
                )}

                <button
                  onClick={aoPedirAjuda}
                  className="cursor-pointer"
                  style={{ fontSize: '11px', background: 'none', border: 'none', color: 'var(--text-tertiary)' }}
                >
                  Pedir ajuda sobre isto
                </button>
              </>
            )
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   Página
   ============================================================ */
export default function ConversaPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [conversa, setConversa] = useState<Conversa | null>(null)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [texto, setTexto] = useState('')
  /* Quem está escrevendo, com o instante do último aviso.
     Um único nome não bastava: em conversa de grupo mais de uma pessoa
     escreve ao mesmo tempo, e o aviso anterior era substituído pelo seguinte,
     de modo que só o último aparecia. */
  const [digitantes, setDigitantes] = useState<Record<string, number>>({})
  const [conectado, setConectado] = useState(false)
  const [conectados, setConectados] = useState(0)

  /* Quem está na conversa. Carregado sob demanda: só interessa quando a
     pessoa pergunta, e é a resposta para uma contagem inesperada. */
  const [participantes, setParticipantes] = useState<{
    id: string
    nome: string
    papel: string
    sou_eu: boolean
  }[]>([])
  const [mostrarParticipantes, setMostrarParticipantes] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [pedindoAjuda, setPedindoAjuda] = useState<Mensagem | null>(null)
  const [descricaoAjuda, setDescricaoAjuda] = useState('')

  const [gravando, setGravando] = useState(false)
  const [segundos, setSegundos] = useState(0)

  const socketRef = useRef<WebSocket | null>(null)
  const fimRef = useRef<HTMLDivElement | null>(null)
  const encerrandoRef = useRef(false)
  const gravadorRef = useRef<MediaRecorder | null>(null)
  const pedacosRef = useRef<Blob[]>([])
  const cronometroRef = useRef<number | undefined>(undefined)

  const rolarParaOFim = useCallback(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  /**
   * A mesma mensagem pode chegar duas vezes: pela resposta do POST e pelo
   * socket, que a transmite a todos os participantes — inclusive a quem
   * enviou. Guardar por identificador resolve sem depender de qual chega antes.
   */
  const acrescentar = useCallback((nova: Mensagem) => {
    setMensagens(anteriores =>
      anteriores.some(m => m.id === nova.id) ? anteriores : [...anteriores, nova]
    )
  }, [])

  /* Histórico por HTTP: o socket entrega o que acontece agora. */
  useEffect(() => {
    Promise.all([
      api.get(`/colaboracao/conversas/${id}/`),
      api.get(`/colaboracao/conversas/${id}/mensagens/`),
    ]).then(([detalhe, lista]) => {
      setConversa(detalhe.data)
      setMensagens(Array.isArray(lista.data) ? lista.data : lista.data.results || [])
    }).catch(() => {
      toast.error('Conversa não encontrada ou você não participa dela.')
      navigate('/trabalhos')
    }).finally(() => setCarregando(false))
  }, [id, navigate])

  useEffect(() => { rolarParaOFim() }, [mensagens.length, rolarParaOFim])

  /* Conexão em tempo real, com reconexão de espera progressiva. */
  useEffect(() => {
    encerrandoRef.current = false
    let tentativa = 0
    let temporizador: number | undefined

    function conectar() {
      const token = getAccessToken()
      if (!token) return

      const socket = new WebSocket(montarUrlWebSocket(`/ws/conversas/${id}/`, token))
      socketRef.current = socket

      socket.onopen = () => { setConectado(true); tentativa = 0 }

      socket.onmessage = (evento) => {
        const dados = JSON.parse(evento.data)

        if (dados.tipo === 'mensagem') acrescentar(dados.mensagem)

        /* Mensagem apagada por quem a enviou. Sem tratar isto, ela continuaria
           na tela dos demais participantes até o próximo recarregamento. */
        if (dados.tipo === 'removida') {
          setMensagens(anteriores =>
            anteriores.filter(m => m.id !== dados.mensagem_id)
          )
        }

        /* Registra o instante do aviso. A remoção fica a cargo de um
           temporizador único, mais adiante: agendar um por aviso criaria uma
           agenda de temporizadores enquanto a pessoa escreve. */
        if (dados.tipo === 'digitando') {
          setDigitantes(anteriores => ({
            ...anteriores,
            [dados.usuario]: Date.now(),
          }))
        }

        if (dados.tipo === 'conectado' || dados.tipo === 'presenca') {
          setConectados(dados.conectados ?? 0)
        }

        if (dados.tipo === 'erro') toast.error(dados.detalhe)
      }

      socket.onclose = () => {
        setConectado(false)
        if (encerrandoRef.current) return

        const espera = Math.min(1000 * 2 ** tentativa, 30000)
        tentativa += 1
        temporizador = window.setTimeout(conectar, espera)
      }

      socket.onerror = () => socket.close()
    }

    conectar()

    return () => {
      encerrandoRef.current = true
      if (temporizador) window.clearTimeout(temporizador)
      socketRef.current?.close()
    }
  }, [id])

  /* Retira da lista quem parou de escrever.
     O servidor avisa que alguém está digitando, mas não avisa que parou —
     seria um segundo evento para um estado que expira sozinho. Três segundos
     sem novo aviso significam que a pessoa parou, fechou a aba ou enviou. */
  useEffect(() => {
    if (Object.keys(digitantes).length === 0) return

    const relogio = window.setInterval(() => {
      const limite = Date.now() - 3000

      setDigitantes(anteriores => {
        const ativos = Object.fromEntries(
          Object.entries(anteriores).filter(([, instante]) => instante > limite)
        )

        /* Devolve o objeto anterior quando nada mudou: um objeto novo a cada
           segundo redesenharia o cabeçalho sem necessidade. */
        return Object.keys(ativos).length === Object.keys(anteriores).length
          ? anteriores
          : ativos
      })
    }, 1000)

    return () => window.clearInterval(relogio)
  }, [digitantes])

  /** Texto do aviso de digitação, conforme quantas pessoas escrevem. */
  const avisoDigitacao = (() => {
    const nomes = Object.keys(digitantes)

    if (nomes.length === 0) return ''

    /* Só o primeiro nome importa para quem lê. Listar quatro nomes ocuparia
       a linha inteira do cabeçalho e mudaria a cada instante. */
    const primeiro = nomes[0].split(' ')[0]

    if (nomes.length === 1) return `${primeiro} está digitando...`
    if (nomes.length === 2) {
      return `${primeiro} e ${nomes[1].split(' ')[0]} estão digitando...`
    }
    return `${primeiro} e mais ${nomes.length - 1} estão digitando...`
  })()

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    const conteudo = texto.trim()
    if (!conteudo) return

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ acao: 'enviar', conteudo }))
      setTexto('')
      return
    }

    /* Sem socket, o envio segue por HTTP: a conversa não pode parar porque a
       conexão em tempo real caiu. */
    api.post(`/colaboracao/conversas/${id}/mensagens/`, { conteudo })
      .then(({ data }) => {
        acrescentar(data)
        setTexto('')
      })
      .catch(() => toast.error('Não foi possível enviar a mensagem.'))
  }

  async function anexar(arquivo: File) {
    if (arquivo.size > 10 * 1024 * 1024) {
      toast.error('O arquivo passa de 10 MB.')
      return
    }

    const corpo = new FormData()
    corpo.append('arquivo', arquivo)

    try {
      const { data } = await api.post(
        `/colaboracao/conversas/${id}/mensagens/`,
        corpo,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      acrescentar(data)
    } catch (erro: any) {
      /* O servidor explica por que recusou — formato fora da lista, tamanho
         acima do limite. O aviso genérico anterior escondia justamente essa
         explicação, e o defeito do áudio no celular ficou invisível por isso:
         a recusa chegava, mas a tela dizia apenas que não deu certo. */
      toast.error(
        erro?.response?.data?.detail || 'Não foi possível enviar o arquivo.'
      )
    }
  }

  /**
   * Gravação de mensagem de voz.
   *
   * O áudio é útil quando explicar por escrito custaria mais do que falar —
   * um raciocínio com passos, uma dúvida difícil de formular. Fica limitado a
   * dois minutos de propósito: áudio longo é o oposto do que serve num grupo
   * de trabalho, porque obriga todo mundo a ouvir em sequência aquilo que
   * leriam em diagonal.
   *
   * O formato sai do próprio navegador (webm/opus na maioria, mp4 no Safari).
   * Não convertemos no servidor: o navegador que gravou também sabe tocar, e
   * uma etapa de conversão adicionaria ffmpeg à infraestrutura para resolver
   * um problema que não existe.
   */
  const LIMITE_SEGUNDOS = 120

  async function iniciarGravacao() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Este navegador não permite gravar áudio.')
      return
    }

    /* MediaRecorder é mais recente que getUserMedia. No iPhone ele só existe a
       partir do Safari 14.3, e verificar apenas o microfone deixava o erro
       aparecer como exceção sem explicação ao tocar em gravar. */
    if (typeof MediaRecorder === 'undefined') {
      toast.error('Este navegador não grava áudio. Atualize-o ou use outro.')
      return
    }

    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true })

      /* O formato precisa ser escolhido, e não deixado por conta do padrão.
         Sem indicação, alguns navegadores de celular devolvem mimeType vazio;
         o arquivo então sobe como application/octet-stream, que a lista de
         tipos aceitos do servidor recusa — e a recusa chegava como um aviso
         genérico de falha no envio, sem dizer o motivo.

         A ordem segue o que cada plataforma produz: webm com opus no Chrome
         e no Firefox, mp4 no Safari do iPhone. */
      const formatos = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ]
      const formato = formatos.find(
        tipo => MediaRecorder.isTypeSupported?.(tipo)
      )

      const gravador = new MediaRecorder(
        fluxo,
        formato ? { mimeType: formato } : undefined,
      )

      pedacosRef.current = []
      gravador.ondataavailable = (evento) => {
        if (evento.data.size > 0) pedacosRef.current.push(evento.data)
      }

      gravador.onstop = () => {
        // Liberar o microfone é obrigação de quem o pediu: sem isto, o
        // indicador de gravação do sistema fica aceso indefinidamente.
        fluxo.getTracks().forEach(faixa => faixa.stop())

        /* Se o navegador não informar o formato, vale o que foi pedido a ele.
           Um File sem type sobe como binário genérico e é recusado. */
        const tipo = gravador.mimeType || formato || 'audio/webm'
        const blob = new Blob(pedacosRef.current, { type: tipo })
        const extensao = tipo.includes('mp4') ? 'm4a'
          : tipo.includes('ogg') ? 'ogg'
          : 'webm'

        if (blob.size === 0) {
          /* Silêncio aqui era o pior comportamento possível: a pessoa
             concedia o microfone, gravava, tocava em enviar e nada
             acontecia — sem áudio na conversa e sem aviso nenhum. */
          toast.error('A gravação saiu vazia. Tente novamente e fale mais perto do microfone.')
          return
        }

        anexar(new File([blob], `mensagem-de-voz.${extensao}`, { type: tipo }))
      }

      /* O intervalo faz o navegador entregar o áudio em pedaços durante a
         gravação, em vez de um bloco único no fim. Em celular isso importa:
         se a pessoa troca de aba ou a tela apaga, o que já foi capturado
         está guardado. Sem o intervalo, a gravação inteira podia se perder. */
      gravador.start(1000)
      gravadorRef.current = gravador
      setGravando(true)
      setSegundos(0)

      cronometroRef.current = window.setInterval(() => {
        setSegundos(anterior => {
          if (anterior + 1 >= LIMITE_SEGUNDOS) {
            encerrarGravacao()
            return LIMITE_SEGUNDOS
          }
          return anterior + 1
        })
      }, 1000)
    } catch (erro: any) {
      /* Distinguir permissão negada de ausência de microfone: as duas coisas
         pedem providências diferentes de quem está usando. */
      const nome = erro?.name

      if (nome === 'NotAllowedError' || nome === 'SecurityError') {
        toast.error('Permissão de microfone negada. Libere o acesso nas configurações do navegador.')
      } else if (nome === 'NotFoundError') {
        toast.error('Nenhum microfone encontrado neste aparelho.')
      } else {
        toast.error('Não foi possível iniciar a gravação neste navegador.')
      }
    }
  }

  function encerrarGravacao(descartar = false) {
    if (cronometroRef.current) window.clearInterval(cronometroRef.current)

    const gravador = gravadorRef.current
    if (!gravador) return

    if (descartar) gravador.onstop = () => {
      gravador.stream.getTracks().forEach(faixa => faixa.stop())
    }

    if (gravador.state !== 'inactive') gravador.stop()

    gravadorRef.current = null
    setGravando(false)
    setSegundos(0)
  }

  /* Sair da tela no meio de uma gravação não pode deixar o microfone aberto. */
  useEffect(() => () => {
    if (cronometroRef.current) window.clearInterval(cronometroRef.current)
    const gravador = gravadorRef.current
    if (gravador && gravador.state !== 'inactive') {
      gravador.onstop = null
      gravador.stop()
      gravador.stream.getTracks().forEach(faixa => faixa.stop())
    }
  }, [])

  /**
   * Apaga a própria mensagem.
   *
   * A remoção é otimista: some da tela antes da confirmação do servidor. Se
   * ele recusar, ela volta. É o caminho certo aqui porque a recusa é rara — a
   * interface só oferece o botão dentro do prazo — e o atraso de rede
   * apareceria justamente no gesto que a pessoa quer ver resolvido na hora.
   */
  async function apagarMensagem(mensagem: Mensagem) {
    setMensagens(anteriores => anteriores.filter(m => m.id !== mensagem.id))

    try {
      await api.delete(`/colaboracao/mensagens/${mensagem.id}/`)
    } catch (err: any) {
      setMensagens(anteriores =>
        [...anteriores, mensagem].sort(
          (a, b) => a.created_at.localeCompare(b.created_at)
        )
      )
      toast.error(err.response?.data?.detail || 'Não foi possível apagar a mensagem.')
    }
  }

  async function confirmarPedidoAjuda() {
    if (!pedindoAjuda) return

    try {
      await api.post(`/colaboracao/mensagens/${pedindoAjuda.id}/pedir-ajuda/`, {
        descricao: descricaoAjuda.trim(),
      })
      toast.success('Pedido enviado à monitoria e ao professor.')
      setMensagens(anteriores => anteriores.map(m =>
        m.id === pedindoAjuda.id ? { ...m, tem_pedido_ajuda: true } : m
      ))
      setPedindoAjuda(null)
      setDescricaoAjuda('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Não foi possível pedir ajuda.')
    }
  }

  if (carregando) {
    return <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Carregando conversa...</p>
  }

  if (!conversa) return null

  const arquivada = !!conversa.arquivada_em
  let ultimoDia = ''

  return (
    /* Conversa ocupa a área inteira, e não uma coluna de 720 px como as
       páginas de leitura.
       A largura fixa fazia sentido para texto corrido, onde linha longa
       cansa. Aqui o conteúdo já vem em balões curtos, e o que sobrava era
       faixa morta à direita.
       A altura acompanha o espaço que a área principal oferece, em vez de ser
       deduzida da altura da janela. A conta anterior subtraía 104 px de 100vh
       — a barra superior mais o espaçamento — e dependia de que esses valores
       nunca mudassem. Mudaram: no telefone o espaçamento passou a 16 px, e
       100vh ali não é a altura visível, porque o navegador conta a faixa do
       endereço que se recolhe ao rolar. O resultado seria a conversa
       terminando abaixo da borda da tela, com o campo de escrita fora do
       alcance. */
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', minHeight: 0, maxWidth: '100%',
    }}>
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      {/* Cabeçalho */}
      <div className="flex items-center flex-shrink-0" style={{ gap: '13px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => navigate('/trabalhos')}
          className="flex items-center justify-center rounded-lg cursor-pointer"
          style={{
            width: '34px', height: '34px', background: 'var(--bg-card)',
            border: '1px solid var(--border)', color: 'var(--text-secondary)',
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          {/* O título é rótulo, não comando. Ele estava acumulando a ação de
              abrir os participantes, e nada na aparência dizia isso — quem
              quisesse a lista não teria como descobrir onde clicar. A ação
              ficou no próprio texto que a descreve, logo abaixo. */}
          <div className="font-semibold truncate" style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
            {conversa.titulo}
          </div>
          {/* O aviso de digitação substitui a linha inteira enquanto dura:
              é a informação mais volátil e a que a pessoa está esperando. */}
          <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)' }}>
            {avisoDigitacao ? (
              <span style={{ color: 'var(--accent-blue-text)' }}>
                {avisoDigitacao}
              </span>
            ) : (
              <>
                {conversa.total_participantes}
                {conversa.total_participantes === 1 ? ' participante' : ' participantes'}
                {/* Só faz sentido anunciar presença quando há mais de uma
                    pessoa: "1 online" é sempre quem está lendo. */}
                {conectados > 1 ? ` · ${conectados} online agora` : ''}
                {conectado ? '' : ' · reconectando...'}
                {' · '}
                <button
                  onClick={() => {
                    const abrindo = !mostrarParticipantes
                    setMostrarParticipantes(abrindo)

                    /* Recarrega a cada abertura, e não só na primeira: a
                       composição muda quando alguém entra ou sai, e uma lista
                       guardada mostraria o estado de quando foi vista. */
                    if (abrindo) {
                      api.get(`/colaboracao/conversas/${id}/participantes/`)
                        .then(({ data }) => setParticipantes(data.participantes || []))
                        .catch(() => toast.error('Não foi possível carregar os participantes.'))
                    }
                  }}
                  aria-expanded={mostrarParticipantes}
                  className="cursor-pointer"
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    fontSize: '11.5px', color: 'var(--accent-blue-text)',
                    textDecoration: 'underline',
                  }}
                >
                  {mostrarParticipantes ? 'ocultar participantes' : 'ver participantes'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Lista de participantes.
          Saber com quem se fala é informação básica de qualquer conversa, e
          antes só existia a contagem. Numa conversa de grupo o número basta,
          porque a composição é conhecida; num canal que reúne professores e
          monitores de uma disciplina, uma contagem inesperada não tinha como
          ser investigada pela interface. */}
      {mostrarParticipantes && (
        <div
          className="rounded-lg flex-shrink-0"
          style={{
            margin: '10px 0 0',
            padding: '12px 14px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          {participantes.length === 0 ? (
            <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)' }}>
              Carregando...
            </p>
          ) : (
            <div className="flex flex-wrap" style={{ gap: '6px 14px' }}>
              {participantes.map(pessoa => (
                <span
                  key={pessoa.id}
                  style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}
                >
                  {pessoa.nome}
                  {pessoa.sou_eu ? ' (você)' : ''}
                  {pessoa.papel && (
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      {' · '}{ROTULO_PAPEL[pessoa.papel] || pessoa.papel}
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mensagens */}
      {/* A lista rola; o cabeçalho e o campo de escrita ficam fixos. O
          minHeight zerado é o que permite ao flex encolher o item abaixo do
          conteúdo — sem ele, a lista empurra o campo de escrita para fora da
          tela quando a conversa cresce. */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        padding: '18px 4px', display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        {mensagens.length === 0 && (
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '30px' }}>
            Nenhuma mensagem ainda. Esta conversa é privada aos participantes do grupo.
          </p>
        )}

        {mensagens.map(mensagem => {
          const diaAtual = dia(mensagem.created_at)
          const mostrarDia = diaAtual !== ultimoDia
          ultimoDia = diaAtual

          return (
            <div key={mensagem.id}>
              {mostrarDia && (
                <div className="text-center" style={{ margin: '8px 0 14px' }}>
                  <span style={{
                    padding: '3px 11px', borderRadius: '10px', fontSize: '11px',
                    background: 'var(--bg-input)', color: 'var(--text-tertiary)',
                  }}>
                    {diaAtual}
                  </span>
                </div>
              )}

              <Balao
                mensagem={mensagem}
                minha={mensagem.autor === user?.id}
                aoPedirAjuda={() => setPedindoAjuda(mensagem)}
                aoApagar={() => apagarMensagem(mensagem)}
              />
            </div>
          )
        })}

        <div ref={fimRef} />
      </div>

      {/* Envio */}
      {arquivada ? (
        <div className="rounded-xl text-center flex-shrink-0" style={{
          padding: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)',
        }}>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            Conversa arquivada no fim do semestre. O histórico continua acessível.
          </p>
        </div>
      ) : (
        gravando ? (
          <div className="flex items-center flex-shrink-0" style={{
            gap: '11px', paddingTop: '13px', borderTop: '1px solid var(--border)',
          }}>
            <span className="flex items-center justify-center rounded-lg flex-shrink-0" style={{
              width: '38px', height: '38px', background: AZUL, color: '#FFFFFF',
            }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
              </svg>
            </span>

            <span className="flex-1" style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>
              Gravando · {String(Math.floor(segundos / 60)).padStart(2, '0')}:
              {String(segundos % 60).padStart(2, '0')}
              <span style={{ color: 'var(--text-tertiary)' }}> (máximo 2 min)</span>
            </span>

            <button
              onClick={() => encerrarGravacao()}
              className="rounded-xl font-medium text-white cursor-pointer flex-shrink-0"
              style={{ padding: '11px 18px', fontSize: '13.5px', border: 'none', background: AZUL }}
            >
              Enviar áudio
            </button>

            <button
              onClick={() => encerrarGravacao(true)}
              className="cursor-pointer flex-shrink-0"
              style={{ fontSize: '13px', background: 'none', border: 'none', color: 'var(--text-tertiary)' }}
            >
              Descartar
            </button>
          </div>
        ) : (
        <form onSubmit={enviar} className="flex items-center flex-shrink-0" style={{
          gap: '9px', paddingTop: '13px', borderTop: '1px solid var(--border)',
        }}>
          <label
            htmlFor="anexo-chat"
            className="flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
            style={{
              width: '38px', height: '38px', color: AZUL,
              background: 'rgba(0,48,135,0.06)', border: '1px solid rgba(0,48,135,0.25)',
            }}
            title="Anexar arquivo"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32" />
            </svg>
          </label>
          <input
            id="anexo-chat"
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            onChange={(e) => {
              const arquivo = e.target.files?.[0]
              if (arquivo) anexar(arquivo)
              e.target.value = ''
            }}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            onClick={iniciarGravacao}
            className="flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
            style={{
              width: '38px', height: '38px', color: AZUL,
              background: 'rgba(0,48,135,0.06)', border: '1px solid rgba(0,48,135,0.25)',
            }}
            title="Gravar mensagem de voz"
            aria-label="Gravar mensagem de voz"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </button>

          <input
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({ acao: 'digitando' }))
              }
            }}
            placeholder="Escreva para o grupo..."
            className="flex-1 outline-none rounded-xl"
            style={{
              padding: '11px 14px', fontSize: '13.5px',
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          />

          <button
            type="submit"
            disabled={!texto.trim()}
            className="rounded-xl font-medium text-white cursor-pointer flex-shrink-0"
            style={{
              padding: '11px 18px', fontSize: '13.5px', border: 'none',
              background: AZUL, opacity: texto.trim() ? 1 : 0.5,
            }}
          >
            Enviar
          </button>
        </form>
        )
      )}

      {/* Pedido de ajuda */}
      {pedindoAjuda && (
        <div
          className="flex items-center justify-center"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 50,
          }}
          onClick={() => setPedindoAjuda(null)}
        >
          <div
            className="rounded-xl"
            style={{
              width: '460px', maxWidth: '92vw', padding: '22px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>
              Pedir ajuda sobre esta mensagem
            </h2>

            <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', margin: '6px 0 12px', lineHeight: 1.5 }}>
              A monitoria e o professor recebem apenas esta mensagem e o que
              você escrever abaixo. O resto da conversa continua privado.
            </p>

            <div className="rounded-lg" style={{
              padding: '10px 13px', marginBottom: '12px',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              fontSize: '13px', color: 'var(--text-secondary)',
            }}>
              {pedindoAjuda.conteudo || '(mensagem com anexo)'}
            </div>

            <textarea
              value={descricaoAjuda}
              onChange={(e) => setDescricaoAjuda(e.target.value)}
              rows={3}
              placeholder="Explique o que o grupo já tentou e onde travou."
              className="w-full rounded-lg outline-none"
              style={{
                padding: '10px 13px', fontSize: '13px', resize: 'vertical',
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            />

            <div className="flex items-center" style={{ gap: '9px', marginTop: '14px' }}>
              <button
                onClick={confirmarPedidoAjuda}
                className="rounded-lg font-medium text-white cursor-pointer"
                style={{ padding: '9px 18px', fontSize: '13.5px', border: 'none', background: AZUL }}
              >
                Enviar pedido
              </button>
              <button
                onClick={() => setPedindoAjuda(null)}
                className="cursor-pointer"
                style={{ fontSize: '13px', background: 'none', border: 'none', color: 'var(--text-tertiary)' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
