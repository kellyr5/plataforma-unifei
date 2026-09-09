/**
 * TrabalhosPage — Trabalhos em grupo de uma disciplina.
 *
 * A mesma tela serve a quem ensina e a quem cursa, porque o objeto é o mesmo
 * e só muda o que se pode fazer com ele. O professor cria o trabalho, define
 * as regras, sorteia e acompanha a composição dos grupos; o aluno escolhe
 * onde entrar e vê com quem está. Quem ensina não entra em grupo: acompanha.
 *
 * A decisão do que exibir é tomada por disciplina, e não pelo papel geral da
 * pessoa. O monitor é o caso que obriga a isso: ele conduz os trabalhos onde
 * exerce a monitoria e participa como estudante nas próprias matérias. Um
 * único indicador global daria a ele o botão errado em metade da tela.
 *
 * Os grupos aparecem como cartões com as vagas restantes visíveis. Mostrar
 * quantas faltam, e não apenas quantos entraram, é o que permite decidir de
 * relance onde ainda cabe alguém.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'

import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

interface Membro {
  id: string
  usuario: string
  usuario_nome: string
  e_lider: boolean
}

interface Grupo {
  id: string
  trabalho: string
  nome: string
  descricao: string
  especificacao_propria: string
  membros: Membro[]
  total_membros: number
  vagas_restantes: number
  conversa_id: string | null
}

interface Trabalho {
  id: string
  disciplina: string
  disciplina_codigo: string
  titulo: string
  especificacao: string
  total_grupos: number
  tamanho_maximo: number
  modo_formacao: string
  prazo_entrega: string
  encerrado: boolean
  total_grupos_criados: number
  meu_grupo: string | null
  arquivos: ArquivoTrabalho[]
}

interface ArquivoTrabalho {
  id: string
  nome_original: string
  tamanho_bytes: number
  url: string | null
}

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* Cor da marca vinda do tema, e não fixa aqui. É o que permite ao modo escuro
   usar uma versão mais clara do mesmo azul sem tocar em cada arquivo. */
const AZUL = 'var(--accent-blue)'

function data(valor: string): string {
  return new Date(valor + 'T00:00:00').toLocaleDateString('pt-BR')
}

function diasAte(valor: string): number {
  const alvo = new Date(valor + 'T00:00:00').getTime()
  return Math.ceil((alvo - Date.now()) / 86400000)
}

function Botao({ rotulo, onClick, primario, discreto, desabilitado }: {
  rotulo: string
  onClick: () => void
  primario?: boolean
  discreto?: boolean
  desabilitado?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  if (discreto) {
    return (
      <button
        onClick={onClick}
        disabled={desabilitado}
        className="cursor-pointer"
        style={{
          fontSize: '12.5px', background: 'none', border: 'none',
          color: 'var(--text-tertiary)', opacity: desabilitado ? 0.5 : 1,
        }}
      >
        {rotulo}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={desabilitado}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-md cursor-pointer"
      style={{
        padding: '6px 13px', fontSize: '12.5px', fontWeight: 500, whiteSpace: 'nowrap',
        color: primario ? '#FFFFFF' : (hovered ? AZUL : 'var(--text-secondary)'),
        background: primario ? AZUL : (hovered ? 'var(--bg-hover)' : 'transparent'),
        border: `1px solid ${primario ? AZUL : 'var(--border)'}`,
        opacity: desabilitado ? 0.5 : 1,
        transition: 'all 0.15s ease',
      }}
    >
      {rotulo}
    </button>
  )
}

function CartaoGrupo({ grupo, trabalho, souMembro, conduzo, curso, naoLidas, aoEntrar, aoSair, aoAbrirChat }: {
  grupo: Grupo
  trabalho: Trabalho
  souMembro: boolean
  /** Quem leciona ou monitora esta disciplina: acompanha, não participa. */
  conduzo: boolean
  /**
   * Quem está matriculado como aluno nesta disciplina.
   *
   * Sem isso, quem não tem vínculo nenhum — a coordenação, por exemplo —
   * caía no ramo do estudante e via "Entrar neste grupo". O clique falhava no
   * servidor, que exige matrícula, mas a interface já havia prometido uma
   * ação impossível.
   */
  curso: boolean
  /** Mensagens ainda não lidas na conversa do grupo. */
  naoLidas: number
  aoEntrar: () => void
  aoSair: () => void
  aoAbrirChat: (conversaId: string) => void
}) {
  /* A contagem é derivada da lista de membros, e não do total que o servidor
     devolveu à parte. Assim o cartão nunca exibe "2 participantes" sobre uma
     lista de três nomes enquanto a atualização não chega inteira. */
  const total = grupo.membros.length
  const vagas = Math.max(0, trabalho.tamanho_maximo - total)
  const cheio = vagas === 0

  const jaEstouEmOutro = !!trabalho.meu_grupo && trabalho.meu_grupo !== grupo.id

  const ocupacao = cheio
    ? `${total} de ${trabalho.tamanho_maximo} · grupo completo`
    : `${total} de ${trabalho.tamanho_maximo} · `
      + (vagas === 1 ? '1 vaga restante' : `${vagas} vagas restantes`)

  return (
    <article
      className="rounded-xl"
      style={{
        padding: '16px 18px',
        background: 'var(--bg-card)',
        border: `1px solid ${souMembro ? 'rgba(0,48,135,0.4)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-start justify-between" style={{ gap: '12px' }}>
        <div className="min-w-0">
          <div className="font-semibold" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
            {grupo.nome}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            {ocupacao}
          </div>
        </div>

        {souMembro && (
          <span className="rounded flex-shrink-0" style={{
            padding: '2px 8px', fontSize: '10.5px', fontWeight: 600,
            background: 'rgba(0,48,135,0.08)', color: AZUL,
          }}>
            seu grupo
          </span>
        )}
      </div>

      {grupo.especificacao_propria && (
        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '9px', lineHeight: 1.5 }}>
          {grupo.especificacao_propria}
        </p>
      )}

      {/* Registro de participantes: os nomes ocupados e os lugares em aberto.
          Mostrar a vaga como linha, e não só como número no cabeçalho, torna
          o tamanho do grupo visível de relance — é a diferença entre ler "4
          vagas" e ver que o grupo está praticamente vazio. */}
      <ol style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '11px' }}>
        {grupo.membros.map((membro, indice) => (
          <li key={membro.id} className="flex items-center" style={{ gap: '8px' }}>
            <span style={{
              fontSize: '10.5px', color: 'var(--text-tertiary)',
              width: '13px', flexShrink: 0, textAlign: 'right',
            }}>
              {indice + 1}
            </span>
            <span className="truncate" style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>
              {membro.usuario_nome}
            </span>
            {membro.e_lider && (
              <span className="rounded flex-shrink-0" style={{
                padding: '1px 6px', fontSize: '10px',
                border: '1px solid var(--border)', color: 'var(--text-tertiary)',
              }}>
                líder
              </span>
            )}
          </li>
        ))}

        {Array.from({ length: vagas }).map((_, indice) => (
          <li key={`vaga-${indice}`} className="flex items-center" style={{ gap: '8px' }}>
            <span style={{
              fontSize: '10.5px', color: 'var(--text-tertiary)',
              width: '13px', flexShrink: 0, textAlign: 'right', opacity: 0.5,
            }}>
              {total + indice + 1}
            </span>
            <span style={{
              fontSize: '12.5px', color: 'var(--text-tertiary)', opacity: 0.65,
              borderBottom: '1px dashed var(--border)', flex: 1,
            }}>
              vaga em aberto
            </span>
          </li>
        ))}
      </ol>

      {/* Quem conduz a disciplina vê a composição e para por aí. Não há botão
          de entrada porque não há entrada possível: a conversa do grupo é
          privada, e o backend recusa quem não está matriculado. Mostrar o
          botão seria oferecer um caminho que termina em erro. */}
      {(conduzo || !curso) ? (
        total === 0 && (
          <p style={{
            fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '10px',
            paddingTop: '11px', borderTop: '1px solid var(--border)',
          }}>
            Nenhum estudante entrou ainda.
          </p>
        )
      ) : (
      <div
        className="flex items-center"
        style={{
          gap: '8px', marginTop: '13px', paddingTop: '13px',
          borderTop: '1px solid var(--border)',
        }}
      >
        {souMembro ? (
          <>
            {grupo.conversa_id && (
              <Botao
                rotulo={
                  naoLidas > 0
                    ? `Abrir conversa · ${naoLidas > 99 ? '99+' : naoLidas}`
                    : 'Abrir conversa'
                }
                primario
                onClick={() => aoAbrirChat(grupo.conversa_id!)}
              />
            )}
            <Botao rotulo="Sair do grupo" discreto onClick={aoSair} />
          </>
        ) : (
          <Botao
            rotulo={
              cheio ? 'Grupo completo'
                : jaEstouEmOutro ? 'Você já está em outro grupo'
                : 'Entrar neste grupo'
            }
            onClick={aoEntrar}
            desabilitado={cheio || jaEstouEmOutro || trabalho.encerrado}
          />
        )}
      </div>
      )}
    </article>
  )
}

/**
 * Confirmação de uma ação que muda a composição do grupo.
 *
 * Entrar e sair não são reversíveis sem custo: a vaga liberada pode ser
 * ocupada por outra pessoa no intervalo, e quem sai perde o acesso à conversa
 * e ao histórico dela. O diálogo existe para que isso não aconteça por um
 * clique de passagem.
 */
interface Confirmacao {
  titulo: string
  texto: string
  rotulo: string
  aoConfirmar: () => Promise<void>
}

function DialogoConfirmacao({ pedido, aoFechar }: {
  pedido: Confirmacao
  aoFechar: () => void
}) {
  const [enviando, setEnviando] = useState(false)

  async function confirmar() {
    setEnviando(true)
    try {
      await pedido.aoConfirmar()
      aoFechar()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className="flex items-center justify-center"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 50 }}
      onClick={aoFechar}
    >
      <div
        className="rounded-xl"
        style={{
          width: '420px', maxWidth: '92vw', padding: '22px',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>
          {pedido.titulo}
        </h2>

        <p style={{
          fontSize: '13px', color: 'var(--text-secondary)',
          margin: '8px 0 18px', lineHeight: 1.6,
        }}>
          {pedido.texto}
        </p>

        <div className="flex items-center" style={{ gap: '9px' }}>
          <button
            onClick={confirmar}
            disabled={enviando}
            className="rounded-lg font-medium text-white cursor-pointer"
            style={{
              padding: '9px 18px', fontSize: '13.5px', border: 'none',
              background: AZUL, opacity: enviando ? 0.6 : 1,
            }}
          >
            {enviando ? 'Aguarde...' : pedido.rotulo}
          </button>
          <button
            onClick={aoFechar}
            disabled={enviando}
            className="cursor-pointer"
            style={{
              fontSize: '13px', background: 'none', border: 'none',
              color: 'var(--text-tertiary)',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TrabalhosPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [parametros, setParametros] = useSearchParams()

  const disciplinaFiltro = parametros.get('disciplina') || ''

  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([])
  const [grupos, setGrupos] = useState<Record<string, Grupo[]>>({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)

  /* Não lidas por conversa. Vem de uma consulta separada porque a contagem é
     pessoal — depende de até onde cada um leu — e o grupo é o mesmo para
     todos. Misturar as duas coisas na resposta do grupo obrigaria o servidor a
     recalcular a leitura de quem pergunta a cada cartão. */
  const [naoLidas, setNaoLidas] = useState<Record<string, number>>({})

  /* Canais entre professor e monitores de uma disciplina. Só existem para quem
     conduz a turma, e apenas nas matérias em que a pessoa atua. */
  const [canaisMonitoria, setCanaisMonitoria] = useState<{
    id: string
    titulo: string
    nao_lidas: number
    total_participantes: number
    somente_leitura: boolean
  }[]>([])

  const disciplinas = user?.papeis_disciplina || []

  /**
   * Busca a lista inteira.
   *
   * O indicador de carregamento só aparece na primeira abertura. Entrar ou
   * sair de um grupo também recarrega, mas trocar a tela por "Carregando..."
   * a cada clique faz o cartão piscar e a contagem parecer instável, quando na
   * verdade ela só foi buscar o número novo.
   */
  const carregar = useCallback(async (primeira = false) => {
    if (primeira) setCarregando(true)
    setErro('')
    try {
      const params: Record<string, string> = {}
      if (disciplinaFiltro) params.disciplina = disciplinaFiltro

      const { data: lista } = await api.get('/colaboracao/trabalhos/', { params })
      const registros: Trabalho[] = Array.isArray(lista) ? lista : lista.results || []
      setTrabalhos(registros)

      const mapa: Record<string, Grupo[]> = {}
      for (const trabalho of registros) {
        const { data: resposta } = await api.get('/colaboracao/grupos/', {
          params: { trabalho: trabalho.id },
        })
        mapa[trabalho.id] = Array.isArray(resposta) ? resposta : resposta.results || []
      }
      setGrupos(mapa)

      const { data: conversas } = await api.get('/colaboracao/conversas/')
      const registrosConversa = Array.isArray(conversas)
        ? conversas
        : conversas.results || []

      setNaoLidas(Object.fromEntries(
        registrosConversa.map((conversa: { id: string; nao_lidas: number }) =>
          [conversa.id, conversa.nao_lidas]
        )
      ))

      /* O canal da monitoria não pertence a nenhum trabalho, então não tem
         onde aparecer entre os grupos. Fica em bloco próprio, no topo. */
      setCanaisMonitoria(
        registrosConversa.filter(
          (conversa: { tipo: string }) => conversa.tipo === 'monitoria'
        )
      )
    } catch (err: any) {
      setTrabalhos([])
      setErro(
        err.response?.status
          ? `A consulta falhou (erro ${err.response.status}).`
          : 'Não foi possível falar com o servidor.'
      )
    } finally {
      setCarregando(false)
    }
  }, [disciplinaFiltro])

  useEffect(() => { carregar(true) }, [carregar])

  /**
   * Atualiza um único trabalho depois de entrar, sair ou sortear.
   *
   * Recarregar a página toda pediria uma requisição por trabalho listado, e o
   * que mudou foi um só. Buscar o trabalho junto com os grupos é necessário
   * porque `meu_grupo` vive no trabalho: sem ele, os outros cartões
   * continuariam dizendo "Você já está em outro grupo" depois de sair.
   */
  const atualizarTrabalho = useCallback(async (trabalhoId: string) => {
    const [detalhe, lista] = await Promise.all([
      api.get(`/colaboracao/trabalhos/${trabalhoId}/`),
      api.get('/colaboracao/grupos/', { params: { trabalho: trabalhoId } }),
    ])

    setTrabalhos(anteriores => anteriores.map(
      trabalho => (trabalho.id === trabalhoId ? detalhe.data : trabalho)
    ))

    setGrupos(anteriores => ({
      ...anteriores,
      [trabalhoId]: Array.isArray(lista.data) ? lista.data : lista.data.results || [],
    }))
  }, [])

  async function acao(caminho: string, sucesso: string, trabalhoId: string) {
    try {
      await api.post(caminho)
      await atualizarTrabalho(trabalhoId)
      toast.success(sucesso)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Não foi possível concluir a ação.')
    }
  }

  /**
   * Papel da pessoa em cada disciplina, para consulta direta.
   *
   * A permissão de trabalho em grupo é sempre local à disciplina: quem leciona
   * CTCO01 não conduz os trabalhos de CTCO02 só por ser professor em algum
   * lugar. O mapa evita percorrer a lista de vínculos a cada cartão.
   */
  const papelEm = new Map(
    disciplinas.map(vinculo => [vinculo.disciplina_id, vinculo.papel])
  )

  /** Participa da condução da turma: professor ou monitor. */
  function conduz(disciplinaId: string): boolean {
    const papel = papelEm.get(disciplinaId)
    return papel === 'professor' || papel === 'monitor'
  }

  /**
   * É o docente responsável pela disciplina.
   *
   * Separado de `conduz` porque as ações que desenham a avaliação — abrir os
   * grupos, sortear a turma — não são da monitoria. O monitor acompanha o
   * andamento e atende dúvidas, mas quem define como a turma se divide é
   * quem responde pela disciplina.
   */
  function ministra(disciplinaId: string): boolean {
    return papelEm.get(disciplinaId) === 'professor'
  }

  /**
   * Se a pessoa cursa a disciplina como estudante.
   *
   * Só quem cursa entra em grupo. A coordenação enxerga os trabalhos do curso
   * para poder acompanhar, mas não está matriculada em nada — e um sistema que
   * oferece a ela o botão de entrar está confundindo supervisão com
   * participação.
   */
  function cursa(disciplinaId: string): boolean {
    return papelEm.get(disciplinaId) === 'aluno'
  }

  /* O botão de criar aparece somente para quem é professor de alguma
     disciplina.

     A coordenação fica de fora porque acompanha o curso sem dar aula. E o
     monitor também: ele conduz a turma junto com o professor — modera,
     atende pedido de ajuda, acompanha os grupos —, mas propor trabalho e
     definir prazo são decisões de desenho da avaliação. O monitor costuma ser
     aluno da própria turma, e criar a atividade pela qual os colegas serão
     avaliados inverteria a relação que a monitoria pressupõe. O servidor
     aplica a mesma regra; esconder o botão evita que ela seja descoberta por
     uma mensagem de erro. */
  const podeCriar = disciplinas.some(vinculo => vinculo.papel === 'professor')

  /* Usado só no texto de apoio, que fala do conjunto e não de uma disciplina.
     Aqui o monitor entra: ele participa da condução, ainda que não crie. */
  const ensina =
    disciplinas.some(
      vinculo => vinculo.papel === 'professor' || vinculo.papel === 'monitor'
    ) || !!user?.e_coordenacao

  const seletor = {
    padding: '8px 12px', fontSize: '13px', borderRadius: '8px',
    background: 'var(--bg-card)', color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  }

  return (
    <div style={{ maxWidth: '880px' }}>
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      <div className="flex items-end justify-between" style={{ gap: '16px', marginBottom: '20px' }}>
        <div>
          <h1 className="font-bold tracking-tight" style={{ fontSize: '23px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Trabalhos em grupo
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            {ensina
              ? 'Trabalhos propostos nas suas disciplinas e como os grupos estão formados.'
              : 'Trabalhos das suas disciplinas. Escolha um grupo enquanto houver vaga.'}
          </p>
        </div>

        <div className="flex items-center flex-shrink-0" style={{ gap: '8px' }}>
          <select
            value={disciplinaFiltro}
            onChange={(e) => {
              const novos = new URLSearchParams()
              if (e.target.value) novos.set('disciplina', e.target.value)
              setParametros(novos)
            }}
            style={seletor}
            className="cursor-pointer outline-none"
          >
            <option value="">Todas as disciplinas</option>
            {disciplinas.map(vinculo => (
              <option key={vinculo.disciplina_id} value={vinculo.disciplina_id}>
                {vinculo.disciplina_codigo}
              </option>
            ))}
          </select>

          {podeCriar && (
            <button
              onClick={() => navigate('/trabalhos/novo')}
              className="rounded-xl font-medium text-white cursor-pointer"
              style={{ padding: '9px 16px', fontSize: '13.5px', border: 'none', background: AZUL }}
            >
              Novo trabalho
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div className="rounded-xl" style={{
          padding: '14px 18px', marginBottom: '14px',
          background: 'var(--bg-card)', border: '1px solid rgba(200,16,46,0.35)',
        }}>
          <p style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>{erro}</p>
        </div>
      )}

      {/* Canais da monitoria.
          Ficam acima dos trabalhos porque atendem a um público menor e mais
          específico — quem conduz a turma —, e ali seriam encontrados na
          primeira olhada em vez de procurados. Aparecem apenas para quem
          participa de algum. */}
      {canaisMonitoria.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h2
            className="font-semibold"
            style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '4px' }}
          >
            Monitoria
          </h2>
          <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
            Canal entre o professor e a monitoria de cada disciplina, separado
            por matéria.
          </p>

          <div
            className="grid"
            style={{
              gap: '10px',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            }}
          >
            {canaisMonitoria.map(canal => (
              <button
                key={canal.id}
                onClick={() => navigate(`/conversas/${canal.id}`)}
                className="rounded-xl cursor-pointer text-left"
                style={{
                  padding: '14px 16px',
                  background: 'var(--bg-card)',
                  border: `1px solid ${canal.nao_lidas > 0 ? 'var(--accent-blue-border)' : 'var(--border)'}`,
                }}
              >
                <div className="flex items-center justify-between" style={{ gap: '10px' }}>
                  <span
                    className="font-medium truncate"
                    style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}
                  >
                    {canal.titulo}
                  </span>

                  {canal.nao_lidas > 0 && (
                    <span
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        minWidth: '20px', height: '20px', padding: '0 6px',
                        borderRadius: '10px', background: AZUL,
                        color: '#FFFFFF', fontSize: '11px', fontWeight: 600,
                      }}
                    >
                      {canal.nao_lidas > 99 ? '99+' : canal.nao_lidas}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  {canal.total_participantes}
                  {canal.total_participantes === 1 ? ' participante' : ' participantes'}
                  {canal.somente_leitura ? ' · encerrado' : ''}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {carregando ? (
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>Carregando trabalhos...</p>
      ) : trabalhos.length === 0 && !erro ? (
        <div className="rounded-xl text-center" style={{
          padding: '48px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)',
        }}>
          <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '5px' }}>
            Nenhum trabalho em grupo
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            {ensina
              ? 'Crie um trabalho para dividir a turma em grupos.'
              : 'Quando o professor propuser um trabalho, ele aparece aqui.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {trabalhos.map(trabalho => {
            const dosGrupos = grupos[trabalho.id] || []
            const dias = diasAte(trabalho.prazo_entrega)

            return (
              <section
                key={trabalho.id}
                className="rounded-xl"
                style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between" style={{ gap: '16px' }}>
                  <div className="min-w-0">
                    <div className="flex items-center" style={{ gap: '8px' }}>
                      <span className="font-semibold" style={{ fontSize: '12.5px', color: AZUL }}>
                        {trabalho.disciplina_codigo}
                      </span>
                      {trabalho.encerrado && (
                        <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)' }}>encerrado</span>
                      )}
                    </div>

                    <h2 className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)', marginTop: '3px' }}>
                      {trabalho.titulo}
                    </h2>

                    <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                      Entrega em {data(trabalho.prazo_entrega)}
                      {dias > 1 ? ` · faltam ${dias} dias`
                        : dias === 1 ? ' · falta 1 dia'
                        : dias === 0 ? ' · entrega hoje'
                        : ' · prazo vencido'}
                      {' · '}até {trabalho.tamanho_maximo} por grupo
                    </p>
                  </div>

                  {/* Abrir grupos e sortear a turma compõem a avaliação, como
                      propor o trabalho: são do professor, não da monitoria. O
                      monitor continua vendo os trabalhos e acompanhando os
                      grupos, mas não define a composição deles. */}
                  {ministra(trabalho.disciplina) && (
                    <div className="flex items-center flex-shrink-0 flex-wrap" style={{ gap: '8px' }}>
                      {trabalho.total_grupos_criados === 0 && (
                        <Botao
                          rotulo="Abrir grupos"
                          primario
                          onClick={() => acao(
                            `/colaboracao/trabalhos/${trabalho.id}/criar-grupos/`,
                            'Grupos disponíveis para os alunos escolherem.',
                            trabalho.id,
                          )}
                        />
                      )}
                      <Botao
                        rotulo="Sortear turma"
                        onClick={() => setConfirmacao({
                          titulo: 'Sortear a turma entre os grupos?',
                          texto:
                            'Todos os matriculados são distribuídos por sorteio, '
                            + 'em grupos de tamanho equilibrado. Os grupos vazios '
                            + 'atuais são recriados no processo, e não há como '
                            + 'desfazer o sorteio. Se alguém já tiver entrado em '
                            + 'um grupo, a operação é recusada.',
                          rotulo: 'Sortear turma',
                          aoConfirmar: () => acao(
                            `/colaboracao/trabalhos/${trabalho.id}/sortear/`,
                            'Turma distribuída entre os grupos.',
                            trabalho.id,
                          ),
                        })}
                      />
                    </div>
                  )}
                </div>

                {trabalho.especificacao && (
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '11px', lineHeight: 1.6 }}>
                    {trabalho.especificacao}
                  </p>
                )}

                {/* Material de apoio do enunciado. Fica logo abaixo dele, e
                    não junto dos grupos: é da turma inteira, e quem chega
                    procurando o que fazer precisa achar antes de escolher com
                    quem fazer. */}
                {trabalho.arquivos?.length > 0 && (
                  <div className="flex items-center" style={{ gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                    {trabalho.arquivos.map(arquivo => (
                      <a
                        key={arquivo.id}
                        href={arquivo.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center rounded-lg"
                        style={{
                          padding: '7px 11px', gap: '7px', fontSize: '12.5px',
                          color: 'var(--accent-blue-text)',
                          background: 'var(--accent-blue-soft)',
                          border: '1px solid var(--accent-blue-border)',
                        }}
                      >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        {arquivo.nome_original}
                        <span style={{ color: 'var(--text-tertiary)' }}>
                          {tamanhoLegivel(arquivo.tamanho_bytes)}
                        </span>
                      </a>
                    ))}
                  </div>
                )}

                {dosGrupos.length > 0 && (
                  <div
                    style={{
                      marginTop: '16px', paddingTop: '16px',
                      borderTop: '1px solid var(--border)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    {dosGrupos.map(grupo => (
                      <CartaoGrupo
                        key={grupo.id}
                        grupo={grupo}
                        trabalho={trabalho}
                        souMembro={trabalho.meu_grupo === grupo.id}
                        conduzo={conduz(trabalho.disciplina)}
                        curso={cursa(trabalho.disciplina)}
                        naoLidas={
                          grupo.conversa_id ? (naoLidas[grupo.conversa_id] || 0) : 0
                        }
                        aoEntrar={() => setConfirmacao({
                          titulo: `Entrar no ${grupo.nome}?`,
                          texto:
                            `Você passa a integrar o ${grupo.nome} em `
                            + `"${trabalho.titulo}" e ganha acesso à conversa do `
                            + 'grupo. Só é possível participar de um grupo por '
                            + 'trabalho, então para trocar depois será preciso '
                            + 'sair deste antes.',
                          rotulo: 'Entrar no grupo',
                          aoConfirmar: () => acao(
                            `/colaboracao/grupos/${grupo.id}/entrar/`,
                            `Você entrou no ${grupo.nome}.`,
                            trabalho.id,
                          ),
                        })}
                        aoSair={() => setConfirmacao({
                          titulo: `Sair do ${grupo.nome}?`,
                          texto:
                            'Você deixa de participar do grupo e perde o acesso '
                            + 'à conversa dele, inclusive ao histórico. A vaga fica '
                            + 'aberta e pode ser ocupada por outra pessoa antes de '
                            + 'você voltar.',
                          rotulo: 'Sair do grupo',
                          aoConfirmar: () => acao(
                            `/colaboracao/grupos/${grupo.id}/sair/`,
                            `Você saiu do ${grupo.nome}.`,
                            trabalho.id,
                          ),
                        })}
                        aoAbrirChat={(conversaId) => navigate(`/conversas/${conversaId}`)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {confirmacao && (
        <DialogoConfirmacao
          pedido={confirmacao}
          aoFechar={() => setConfirmacao(null)}
        />
      )}
    </div>
  )
}
