/**
 * PerfilPage — Perfil do usuario com reputacao por disciplina.
 *
 * Mostra:
 * - Dados do usuario (nome, email, CPF mascarado)
 * - Reputação total e por disciplina
 * - Historico de atividades (respostas, melhores respostas)
 * - Certificados emitidos
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'

import { useAuth } from '../../contexts/AuthContext'
import api from '../../services/api'

interface Andamento {
  disciplina_id: string
  disciplina_codigo: string
  disciplina_nome: string
  total_posts: number
  total_respostas: number
  total_melhores_respostas: number
}

interface Certificado {
  id: string
  codigo_validacao: string
  nome_oportunidade: string
  horas_realizadas: number
  emitido_em: string
}

interface Inscricao {
  id: string
  oportunidade: string
  oportunidade_titulo: string
  status: string
  status_display: string
  created_at: string
}

/**
 * Indicador do perfil.
 *
 * Sem cor por métrica: verde, âmbar e vermelho sugerem bom, atenção e ruim,
 * e nenhuma dessas contagens é boa ou ruim em si. A leitura vem do número e
 * do rótulo, e a cor fica reservada para o que de fato exige ação.
 */
function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div
        className="font-semibold"
        style={{
          fontSize: '24px',
          color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{label}</div>
    </div>
  )
}

/**
 * Item de lista que leva a algum lugar.
 *
 * O perfil listava disciplinas, inscrições e certificados como blocos inertes:
 * a informação estava ali, mas clicar não fazia nada, e nada na tela avisava
 * disso. Quem chega ao perfil vindo de uma notificação quer justamente abrir o
 * item — e a única saída era voltar ao menu e procurar de novo.
 *
 * O realce ao passar o mouse e a seta à direita existem para dizer, antes do
 * clique, que ali há um destino.
 */
function ItemClicavel({ children, aoClicar }: {
  children: React.ReactNode
  aoClicar: () => void
}) {
  const [sobre, setSobre] = useState(false)

  return (
    <div
      onClick={aoClicar}
      onMouseEnter={() => setSobre(true)}
      onMouseLeave={() => setSobre(false)}
      className="flex items-center rounded-xl cursor-pointer"
      style={{
        padding: '14px 18px', gap: '14px',
        background: sobre ? 'var(--bg-hover)' : 'var(--bg-card)',
        border: `1px solid ${sobre ? 'var(--accent-blue-border)' : 'var(--border)'}`,
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
    >
      {children}

      <svg
        className="w-4 h-4 flex-shrink-0"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
        style={{
          color: 'var(--text-tertiary)',
          opacity: sobre ? 1 : 0.35,
          transform: sobre ? 'translateX(2px)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </div>
  )
}

function RepCard({ rep, aoClicar }: { rep: Andamento; aoClicar: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className="rounded-xl cursor-pointer"
      onClick={aoClicar}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        padding: '18px 20px',
        background: hovered ? 'var(--bg-hover)' : 'var(--bg-card)',
        border: `1px solid ${hovered ? 'var(--accent-blue-border)' : 'var(--border)'}`,
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}>
      <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
        <span className="rounded-md font-medium" style={{ padding: '3px 10px', fontSize: '12px', background: 'var(--accent-blue-soft)', color: 'var(--accent-blue-text)' }}>
          {rep.disciplina_codigo}
        </span>
        <span className="font-bold" style={{ fontSize: '19px', color: 'var(--text-primary)' }}>
          {rep.total_posts} dúvida{rep.total_posts === 1 ? '' : 's'}
        </span>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
        {rep.disciplina_nome}
      </div>
      <div className="flex items-center" style={{ gap: '16px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
        <div className="flex items-center" style={{ gap: '4px' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
          {rep.total_respostas} respostas
        </div>
        <div className="flex items-center" style={{ gap: '4px' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {rep.total_melhores_respostas} melhores
        </div>
        <div className="flex items-center" style={{ gap: '4px' }}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
          {rep.pontuacao_recebidos || 0} votos
        </div>
      </div>
    </div>
  )
}

/**
 * Situação da inscrição.
 *
 * O estado é dito por escrito, não por cor. A escala anterior — âmbar,
 * verde, vermelho — classificava a inscrição em atenção, sucesso e fracasso,
 * e uma inscrição pendente não é um problema: é uma inscrição que a
 * organização ainda vai avaliar.
 *
 * O vermelho permanece só na recusa, que é a única situação em que a pessoa
 * precisa perceber de imediato que algo não seguiu adiante.
 */
const statusCores: Record<string, { bg: string; text: string }> = {
  pendente: { bg: 'var(--bg-input)', text: 'var(--text-secondary)' },
  aprovada: { bg: 'var(--accent-blue-soft)', text: 'var(--accent-blue-text)' },
  concluida: { bg: 'rgba(174,189,9,0.10)', text: 'var(--accent-oliva-texto)' },
  rejeitada: { bg: 'rgba(200,16,46,0.07)', text: 'var(--accent-red)' },
  desistente: { bg: 'var(--bg-input)', text: 'var(--text-tertiary)' },
  removida: { bg: 'var(--bg-input)', text: 'var(--text-tertiary)' },
}

export default function PerfilPage() {
  const { user, fetchMe } = useAuth()
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [sobreFoto, setSobreFoto] = useState(false)
  const navigate = useNavigate()
  const [reputacoes, setReputacoes] = useState<Andamento[]>([])
  const [certificados, setCertificados] = useState<Certificado[]>([])
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPerfil() {
      try {
        const [repRes, certRes, inscRes] = await Promise.allSettled([
          api.get('/forum/andamento/'),
          api.get('/voluntariado/certificados/'),
          api.get('/voluntariado/inscricoes/'),
        ])

        if (repRes.status === 'fulfilled') setReputacoes(Array.isArray(repRes.value.data) ? repRes.value.data : [])
        if (certRes.status === 'fulfilled') {
          const data = certRes.value.data
          setCertificados(Array.isArray(data) ? data : data.results || [])
        }
        if (inscRes.status === 'fulfilled') {
          const data = inscRes.value.data
          setInscricoes(Array.isArray(data) ? data : data.results || [])
        }
      } catch (err) {
        console.error('Erro ao carregar perfil:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPerfil()
  }, [])

  const totalTopicos = reputacoes.reduce((s, r) => s + r.total_posts, 0)
  const totalRespostas = reputacoes.reduce((s, r) => s + r.total_respostas, 0)
  const totalMelhores = reputacoes.reduce((s, r) => s + r.total_melhores_respostas, 0)

  /**
   * O vocabulário muda com o papel. "Ajudaram colegas" só faz sentido entre
   * estudantes; quem leciona ou coordena não tem colegas na turma, e ler isso
   * no próprio perfil soa como se o sistema não soubesse quem ele é.
   */
  const ensina = !!user && (user.e_professor || user.e_monitor || user.e_coordenacao)

  const rotulos = ensina
    ? { topicos: 'Tópicos abertos', melhores: 'Respostas de referência' }
    : { topicos: 'Dúvidas levantadas', melhores: 'Ajudaram colegas' }

  const initials = user?.nome_completo
    ? user.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  /**
   * Envia a nova imagem de perfil.
   *
   * O contexto de autenticação é recarregado depois do envio porque a imagem
   * aparece na barra superior e na lateral, não só nesta tela: atualizar
   * apenas o estado local deixaria as três versões divergentes até o próximo
   * recarregamento da página.
   */
  async function enviarFoto(arquivo: File) {
    if (arquivo.size > 4 * 1024 * 1024) {
      toast.error('A imagem passa de 4 MB.')
      return
    }

    const corpo = new FormData()
    corpo.append('foto', arquivo)

    setEnviandoFoto(true)
    try {
      await api.patch('/auth/me/', corpo, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await fetchMe()
      toast.success('Imagem atualizada.')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Não foi possível enviar a imagem.')
    } finally {
      setEnviandoFoto(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '60vh' }}>
        <div className="flex items-center" style={{ gap: '12px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Carregando perfil...
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      {/* Card do perfil */}
      <div className="rounded-xl" style={{ padding: '28px', background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: '24px' }}>
        <div className="flex items-start" style={{ gap: '20px' }}>
          {/* Foto do perfil.
              Para a organização parceira este é o logotipo que aparece em
              cada oportunidade publicada, e por isso a troca acontece aqui, no
              mesmo lugar em que ela vê como ficou. */}
          <label
            htmlFor="foto-perfil"
            onMouseEnter={() => setSobreFoto(true)}
            onMouseLeave={() => setSobreFoto(false)}
            className="relative flex items-center justify-center rounded-2xl flex-shrink-0 cursor-pointer"
            style={{
              width: '72px', height: '72px', overflow: 'hidden',
              background: user?.avatar_url ? 'var(--bg-input)' : 'var(--accent-blue)',
              border: '1px solid var(--border)',
              color: 'white', fontSize: '24px', fontWeight: 600,
            }}
            title="Trocar imagem"
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              initials
            )}

            {/* A faixa só aparece ao passar o mouse. Fixa, ela cobria a parte
                de baixo das iniciais e virava parte do desenho do avatar. */}
            <span
              className="absolute flex items-center justify-center"
              style={{
                left: 0, right: 0, bottom: 0, height: '20px',
                background: 'rgba(0,0,0,0.6)', color: '#FFFFFF', fontSize: '9.5px',
                letterSpacing: '0.04em', textTransform: 'uppercase',
                opacity: enviandoFoto || sobreFoto ? 1 : 0,
                transition: 'opacity 0.15s ease',
              }}
            >
              {enviandoFoto ? 'enviando' : 'trocar'}
            </span>
          </label>
          <input
            id="foto-perfil"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const arquivo = e.target.files?.[0]
              if (arquivo) enviarFoto(arquivo)
              e.target.value = ''
            }}
          />

          {/* Info */}
          <div className="flex-1">
            <h1 className="font-bold" style={{ fontSize: '22px', color: 'var(--text-primary)', marginBottom: '4px' }}>
              {user?.nome_completo || 'Usuario'}
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {user?.email || ''}
            </p>

            {/* Curso e período. É o que qualquer sistema acadêmico mostra logo
                abaixo do nome, e o que a pessoa procura ao abrir o próprio
                perfil para conferir se está tudo certo. */}
            {user?.curso_nome && (
              <p style={{ fontSize: '13.5px', color: 'var(--text-primary)', marginTop: '2px' }}>
                {user.curso_nome}
                {user.periodo_atual ? ` · ${user.periodo_atual}º período` : ''}
              </p>
            )}
            <div className="flex items-center" style={{ gap: '10px', marginTop: '6px' }}>
              <span
                className="rounded"
                style={{
                  padding: '3px 9px', fontSize: '11.5px', fontWeight: 600,
                  background: 'rgba(0,48,135,0.07)', color: 'var(--accent-blue)',
                }}
              >
                {user?.rotulo_perfil || 'Estudante'}
              </span>

              {user?.matricula && (
                <span style={{ fontSize: '12.5px', color: 'var(--text-tertiary)' }}>
                  Matrícula {user.matricula}
                </span>
              )}

              {user?.cpf && (
                <span style={{ fontSize: '12.5px', color: 'var(--text-tertiary)' }}>
                  CPF {user.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4')}
                </span>
              )}
            </div>

            {/* Vínculos por disciplina: é o que define o que a pessoa pode
                fazer, e estava invisível para ela até agora. */}
            {user?.papeis_disciplina && user.papeis_disciplina.length > 0 && (
              <div className="flex flex-wrap" style={{ gap: '6px', marginTop: '10px' }}>
                {user.papeis_disciplina.map(vinculo => (
                  <span
                    key={vinculo.disciplina_id}
                    className="rounded"
                    style={{
                      padding: '3px 8px', fontSize: '11.5px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {vinculo.disciplina_codigo}
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      {' · '}{vinculo.papel}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats resumo */}
        <div className="flex items-center justify-around" style={{ marginTop: '24px', padding: '20px 0 0', borderTop: '1px solid var(--border)' }}>
          <StatMini label={rotulos.topicos} value={totalTopicos.toString()} />
          <div style={{ width: '1px', height: '40px', background: 'var(--border)' }} />
          <StatMini label="Respostas" value={totalRespostas.toString()} />
          <div style={{ width: '1px', height: '40px', background: 'var(--border)' }} />
          <StatMini label={rotulos.melhores} value={totalMelhores.toString()} />
          <div style={{ width: '1px', height: '40px', background: 'var(--border)' }} />
          <StatMini label="Certificados" value={certificados.length.toString()} />
        </div>
      </div>

      {/* Reputação por disciplina */}
      {reputacoes.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: '14px' }}>
            <h2 className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Andamento por disciplina</h2>
            <button onClick={() => navigate('/andamento')} className="cursor-pointer font-medium"
              style={{ fontSize: '13px', color: 'var(--accent-blue)' }}>Ver painel completo</button>
          </div>
          <div className="grid grid-cols-2" style={{ gap: '12px' }}>
            {reputacoes.map(r => (
              <RepCard
                key={r.disciplina_codigo}
                rep={r}
                aoClicar={() => navigate(`/forum?disciplina=${r.disciplina_id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inscricoes de voluntariado */}
      {inscricoes.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '14px' }}>
            Minhas inscrições de voluntariado
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {inscricoes.map(insc => {
              const cores = statusCores[insc.status] || { bg: 'var(--bg-input)', text: 'var(--text-secondary)' }
              return (
                <ItemClicavel
                  key={insc.id}
                  aoClicar={() => navigate(`/voluntariado/${insc.oportunidade}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                      {insc.oportunidade_titulo}
                    </div>
                  </div>
                  <span className="rounded-md flex-shrink-0" style={{
                    padding: '3px 10px', fontSize: '12px', fontWeight: 500,
                    background: cores.bg, color: cores.text,
                  }}>
                    {insc.status_display}
                  </span>
                </ItemClicavel>
              )
            })}
          </div>
        </div>
      )}

      {/* Certificados */}
      {certificados.length > 0 && (
        <div>
          <h2 className="font-semibold" style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '14px' }}>
            Meus certificados
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {certificados.map(cert => (
              <ItemClicavel key={cert.id} aoClicar={() => navigate('/certificados')}>
                <div className="flex items-center justify-center rounded-lg flex-shrink-0"
                  style={{ width: '36px', height: '36px', background: 'var(--accent-blue-soft)', color: 'var(--accent-blue-text)' }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{cert.nome_oportunidade}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                    {cert.horas_realizadas} h · emitido em {new Date(cert.emitido_em).toLocaleDateString('pt-BR')} · código {cert.codigo_validacao}
                  </div>
                </div>
              </ItemClicavel>
            ))}
          </div>
        </div>
      )}

      {/* Mensagem se nao tem nada */}
      {reputacoes.length === 0 && inscricoes.length === 0 && certificados.length === 0 && (
        <div className="rounded-xl text-center" style={{ padding: '48px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="font-medium" style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Seu perfil está vazio
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            Participe do fórum e do voluntariado para construir sua reputação!
          </p>
        </div>
      )}
    </div>
  )
}
