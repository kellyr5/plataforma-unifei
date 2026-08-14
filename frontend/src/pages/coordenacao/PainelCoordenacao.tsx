/**
 * PainelCoordenacao — Página inicial de quem coordena o curso.
 *
 * A organização segue o que a literatura de learning analytics chama de
 * painel intermediário: mostra o curso inteiro e permite descer até a
 * disciplina que precisa de atenção. Por isso a ordenação não é alfabética
 * nem por código, e sim pelo que exige ação.
 *
 * Decisões visuais, que aqui são decisões de leitura:
 *
 * A paleta é institucional e neutra, sem semáforo de cores. Marcar números
 * com amarelo e verde parece informativo, mas em uma tabela com oito colunas
 * a cor vira ruído e obriga o olho a decodificar antes de ler. A hierarquia
 * vem do peso da fonte, do alinhamento e do espaço.
 *
 * Números ficam alinhados à direita e em fonte tabular, para que as casas se
 * empilhem e a comparação entre linhas seja imediata.
 *
 * As ações aparecem no fim de cada linha, sempre no mesmo lugar, porque o
 * fluxo real da coordenação é ler o indicador e ir direto ao caso.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import api from '../../services/api'

interface LinhaDisciplina {
  disciplina_id: string
  codigo: string
  nome: string
  periodo_sugerido: number | null
  professor: string | null
  monitor: string | null
  total_topicos: number
  sem_resposta: number
  total_respostas: number
  participantes: number
  horas_ate_primeira_resposta: number | null
  denuncias_pendentes: number
}

interface Resumo {
  disciplinas: number
  sem_professor: number
  sem_monitor: number
  duvidas_sem_resposta: number
  denuncias_pendentes: number
}

interface Curso {
  id: string
  codigo: string
  nome: string
}

const AZUL = 'var(--accent-blue)'

function esperaLegivel(horas: number | null): string {
  if (horas === null) return '—'
  if (horas < 1) return `${Math.round(horas * 60)}min`
  if (horas < 48) return `${horas.toFixed(1)}h`
  return `${Math.round(horas / 24)}d`
}

/* ============================================================
   Faixa de resumo do curso
   ============================================================ */
function Indicador({ valor, rotulo, destaque }: {
  valor: number; rotulo: string; destaque?: boolean
}) {
  return (
    <div style={{ padding: '0 26px', flex: 1 }}>
      <div
        className="font-semibold"
        style={{
          fontSize: '26px', lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
          color: destaque && valor > 0 ? AZUL : 'var(--text-primary)',
        }}
      >
        {valor}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
        {rotulo}
      </div>
    </div>
  )
}

/* ============================================================
   Ações por disciplina
   ============================================================ */
function BotaoAcao({ rotulo, onClick, primario }: {
  rotulo: string; onClick: () => void; primario?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-md cursor-pointer"
      style={{
        padding: '5px 10px',
        fontSize: '12px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        color: primario ? '#FFFFFF' : (hovered ? AZUL : 'var(--text-secondary)'),
        background: primario
          ? AZUL
          : (hovered ? 'var(--bg-hover)' : 'transparent'),
        border: `1px solid ${primario ? AZUL : 'var(--border)'}`,
        transition: 'all 0.15s ease',
      }}
    >
      {rotulo}
    </button>
  )
}

function Numero({ valor, forte, aoClicar }: {
  valor: number | string; forte?: boolean; aoClicar?: () => void
}) {
  const clicavel = !!aoClicar && valor !== 0 && valor !== '—'

  return (
    <span
      onClick={clicavel ? (e) => { e.stopPropagation(); aoClicar!() } : undefined}
      style={{
        fontSize: '13px',
        fontVariantNumeric: 'tabular-nums',
        fontWeight: forte ? 600 : 400,
        color: forte ? 'var(--text-primary)' : 'var(--text-secondary)',
        cursor: clicavel ? 'pointer' : 'default',
        textDecoration: clicavel ? 'underline' : 'none',
        textUnderlineOffset: '3px',
      }}
    >
      {valor}
    </span>
  )
}

function LinhaDisciplinaTabela({ linha, navegar }: {
  linha: LinhaDisciplina
  navegar: (destino: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const semProfessor = !linha.professor

  const celula = {
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle' as const,
  }

  const celulaNumero = { ...celula, textAlign: 'right' as const }

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: hovered ? 'var(--bg-hover)' : 'transparent' }}
    >
      {/* Identificação */}
      {/* Sem etiqueta de período: a coordenação conhece a matriz, e o número
          ao lado do código só competia com o nome da disciplina. */}
      <td style={celula}>
        <div
          className="font-semibold"
          style={{ fontSize: '13px', color: 'var(--text-primary)', letterSpacing: '0.01em' }}
        >
          {linha.codigo}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '3px' }}>
          {linha.nome}
        </div>
      </td>

      {/* Responsáveis */}
      <td style={celula}>
        {semProfessor ? (
          <span className="flex items-center" style={{ gap: '6px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
            <span style={{
              width: '5px', height: '5px', borderRadius: '50%',
              background: 'var(--text-tertiary)', display: 'inline-block',
            }} />
            Não atribuído
          </span>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
            {linha.professor}
          </div>
        )}
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
          {linha.monitor ? linha.monitor : 'Sem monitoria'}
        </div>
      </td>

      {/* Indicadores */}
      <td style={celulaNumero}>
        <Numero
          valor={linha.total_topicos}
          aoClicar={() => navegar(`/forum?disciplina=${linha.disciplina_id}`)}
        />
      </td>

      <td style={celulaNumero}>
        <Numero
          valor={linha.sem_resposta}
          forte={linha.sem_resposta > 0}
          aoClicar={() => navegar(`/forum?disciplina=${linha.disciplina_id}&sem_resposta=1`)}
        />
      </td>

      <td style={celulaNumero}>
        <Numero valor={esperaLegivel(linha.horas_ate_primeira_resposta)} />
      </td>

      <td style={celulaNumero}>
        <Numero valor={linha.participantes} />
      </td>

      <td style={celulaNumero}>
        <Numero
          valor={linha.denuncias_pendentes}
          forte={linha.denuncias_pendentes > 0}
          aoClicar={() => navegar(`/moderacao?disciplina=${linha.disciplina_id}`)}
        />
      </td>

      {/* Ação.
          Havia três botões por linha, e dois deles levavam exatamente aonde os
          números já levam: "Discussões" repetia a coluna de dúvidas e
          "Moderação" repetia a de denúncias. Somados, empurravam a tabela para
          além da largura da tela e cortavam a própria coluna de ações.

          Ficou o que não tem outro caminho: a página da disciplina, onde a
          coordenação atribui professor e monitoria. */}
      <td style={{ ...celula, textAlign: 'right' }}>
        <BotaoAcao
          rotulo={semProfessor ? 'Atribuir' : 'Gerenciar'}
          primario={semProfessor}
          onClick={() => navegar(`/coordenacao/disciplina/${linha.disciplina_id}`)}
        />
      </td>
    </tr>
  )
}

/* ============================================================
   Página
   ============================================================ */
export default function PainelCoordenacao() {
  const navigate = useNavigate()

  const [cursos, setCursos] = useState<Curso[]>([])
  const [cursoSelecionado, setCursoSelecionado] = useState('')
  const [semestre, setSemestre] = useState('2026.2')
  const [semestresDisponiveis, setSemestresDisponiveis] = useState<string[]>([])
  const [linhas, setLinhas] = useState<LinhaDisciplina[]>([])
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    api.get('/forum/cursos/').then(res => {
      const dados = Array.isArray(res.data) ? res.data : res.data.results || []
      setCursos(dados)
      if (dados.length > 0) setCursoSelecionado(dados[0].id)
    }).catch(() => setCursos([]))
  }, [])

  const buscar = useCallback(async () => {
    setCarregando(true)
    try {
      const params: Record<string, string> = {}
      if (cursoSelecionado) params.curso = cursoSelecionado
      if (semestre) params.semestre = semestre

      const { data } = await api.get('/forum/painel-coordenacao/', { params })
      setLinhas(data.disciplinas || [])
      setResumo(data.resumo || null)
      setSemestresDisponiveis(data.semestres_disponiveis || [])
    } catch {
      setLinhas([])
      setResumo(null)
    } finally {
      setCarregando(false)
    }
  }, [cursoSelecionado, semestre])

  useEffect(() => { buscar() }, [buscar])

  const curso = cursos.find(c => c.id === cursoSelecionado)

  /* Cabeçalho fixo: com trinta e uma disciplinas na matriz, quem rola até o
     meio da tabela perde a referência das colunas e passa a contar posições
     para saber o que está lendo. */
  const cabecalho = {
    position: 'sticky' as const,
    top: 0,
    zIndex: 1,
    padding: '11px 16px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.05em',
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    background: 'var(--bg-card)',
    borderBottom: '1px solid var(--border)',
    boxShadow: 'inset 0 -1px 0 var(--border)',
    whiteSpace: 'nowrap' as const,
  }

  const cabecalhoNumero = { ...cabecalho, textAlign: 'right' as const }

  const seletor = {
    padding: '8px 12px', fontSize: '13px', borderRadius: '8px',
    background: 'var(--bg-card)', color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  }

  return (
    <div>
      {/* Cabeçalho da página */}
      <div
        className="flex items-end justify-between"
        style={{ gap: '20px', marginBottom: '22px' }}
      >
        <div>
          <h1
            className="font-bold tracking-tight"
            style={{ fontSize: '23px', color: 'var(--text-primary)', marginBottom: '5px' }}
          >
            Coordenação do curso
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            {curso ? `${curso.nome} · ` : ''}
            Oferta do ano-período {semestre.replace('.', '-')}.
            As disciplinas que exigem atenção aparecem primeiro.
          </p>
        </div>

        {/* O curso não é escolhido aqui: vem do vínculo de quem coordena,
            resolvido no backend. Oferecer a troca daria a impressão de que
            uma coordenação pode consultar o curso de outra. */}
        <div className="flex items-center flex-shrink-0" style={{ gap: '8px' }}>
          <select
            value={semestre}
            onChange={(e) => setSemestre(e.target.value)}
            style={seletor}
            className="cursor-pointer outline-none"
          >
            {semestresDisponiveis.length === 0 && (
              <option value={semestre}>{semestre.replace('.', '-')}</option>
            )}
            {semestresDisponiveis.map(s => (
              <option key={s} value={s}>{s.replace('.', '-')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Faixa de resumo */}
      {resumo && (
        <div
          className="flex items-center rounded-xl"
          style={{
            padding: '20px 0', marginBottom: '18px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
          }}
        >
          <Indicador valor={resumo.disciplinas} rotulo="disciplinas ofertadas" />
          <div style={{ width: '1px', height: '40px', background: 'var(--border)' }} />
          <Indicador valor={resumo.sem_professor} rotulo="sem professor" destaque />
          <div style={{ width: '1px', height: '40px', background: 'var(--border)' }} />
          <Indicador valor={resumo.sem_monitor} rotulo="sem monitoria" />
          <div style={{ width: '1px', height: '40px', background: 'var(--border)' }} />
          <Indicador valor={resumo.duvidas_sem_resposta} rotulo="dúvidas sem resposta" destaque />
          <div style={{ width: '1px', height: '40px', background: 'var(--border)' }} />
          <Indicador valor={resumo.denuncias_pendentes} rotulo="denúncias pendentes" destaque />
        </div>
      )}

      {/* Tabela */}
      <div
        className="rounded-xl"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {carregando ? (
          <p style={{ padding: '28px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Carregando indicadores...
          </p>
        ) : linhas.length === 0 ? (
          <div className="text-center" style={{ padding: '48px 24px' }}>
            <p
              className="font-medium"
              style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '5px' }}
            >
              Nenhuma disciplina ofertada neste ano-período
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
              Períodos ímpares da matriz são ofertados no primeiro semestre e pares no segundo.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 330px)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
              <thead>
                <tr>
                  <th style={{ ...cabecalho, textAlign: 'left', width: '26%' }}>Disciplina</th>
                  <th style={{ ...cabecalho, textAlign: 'left', width: '18%' }}>Responsáveis</th>
                  <th style={cabecalhoNumero}>Dúvidas</th>
                  <th style={cabecalhoNumero}>Sem resposta</th>
                  <th
                    style={cabecalhoNumero}
                    title="Tempo médio entre a publicação da dúvida e a primeira resposta recebida"
                  >
                    Espera média
                  </th>
                  <th style={cabecalhoNumero}>Alunos ativos</th>
                  <th style={cabecalhoNumero}>Denúncias</th>
                  <th style={{ ...cabecalho, textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(linha => (
                  <LinhaDisciplinaTabela
                    key={linha.disciplina_id}
                    linha={linha}
                    navegar={navigate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '12px', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Espera média</strong> é
        quanto tempo o aluno aguarda até receber a primeira resposta naquela
        disciplina. Serve para interpretar as demais colunas: poucas dúvidas
        com espera longa costumam indicar turma que desistiu de perguntar, e
        não turma sem dúvidas.
      </p>
    </div>
  )
}
