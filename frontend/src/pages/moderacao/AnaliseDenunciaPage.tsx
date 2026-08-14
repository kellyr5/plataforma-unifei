/**
 * AnaliseDenunciaPage — Análise de uma denúncia assumida.
 *
 * A decisão saiu da fila e ganhou tela própria por um motivo prático: julgar
 * exige ler o conteúdo denunciado inteiro, e não o título com o motivo da
 * denúncia. Uma lista comporta a triagem — o que existe, quem assumiu — mas
 * não a leitura.
 *
 * A observação escrita aqui não fica no sistema: ela chega ao autor do
 * conteúdo quando a denúncia é procedente, e ao denunciante nos dois casos. É
 * a diferença entre um post que some sem explicação e uma decisão que a
 * pessoa pode entender e contestar.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'

import api from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'

interface Alerta {
  id: string
  denunciante: string
  denunciante_nome: string
  post: string
  post_titulo: string
  post_conteudo: string
  post_autor_nome: string
  post_criado_em: string
  post_removido: boolean
  topico_id: string
  disciplina_codigo: string
  motivo: string
  status: 'pendente' | 'em_analise' | 'procedente' | 'improcedente'
  assumido_por: string | null
  assumido_por_nome: string | null
  resolvido_por_nome: string | null
  resolucao: string
  created_at: string
  resolvido_em: string | null
}

const AZUL = 'var(--accent-blue)'

const SITUACAO: Record<Alerta['status'], string> = {
  pendente: 'Aguardando análise',
  em_analise: 'Em análise',
  procedente: 'Julgada procedente',
  improcedente: 'Julgada improcedente',
}

function dataHora(valor: string): string {
  return new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl" style={{
      padding: '18px 20px', background: 'var(--bg-card)',
      border: '1px solid var(--border)',
    }}>
      <h2 className="font-semibold" style={{
        fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'var(--text-tertiary)', marginBottom: '11px',
      }}>
        {titulo}
      </h2>
      {children}
    </section>
  )
}

export default function AnaliseDenunciaPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [alerta, setAlerta] = useState<Alerta | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [decisao, setDecisao] = useState<'procedente' | 'improcedente' | ''>('')
  const [observacao, setObservacao] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    api.get(`/forum/alertas/${id}/`)
      .then(({ data }) => setAlerta(data))
      .catch(() => {
        toast.error('Denúncia não encontrada ou fora das suas disciplinas.')
        navigate('/moderacao')
      })
      .finally(() => setCarregando(false))
  }, [id, navigate])

  async function assumir() {
    try {
      const { data } = await api.post(`/forum/alertas/${id}/assumir/`)
      setAlerta(data)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Não foi possível assumir a denúncia.')
    }
  }

  async function liberar() {
    try {
      const { data } = await api.post(`/forum/alertas/${id}/liberar/`)
      setAlerta(data)
      toast.success('Denúncia devolvida à fila.')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Não foi possível liberar a denúncia.')
    }
  }

  async function resolver() {
    if (!decisao) {
      toast.error('Escolha a decisão antes de encerrar.')
      return
    }

    if (!observacao.trim()) {
      toast.error('Escreva a justificativa: ela é o que a pessoa vai receber.')
      return
    }

    setEnviando(true)
    try {
      const { data } = await api.post(`/forum/alertas/${id}/resolver/`, {
        decisao,
        resolucao: observacao.trim(),
      })
      setAlerta(data)
      toast.success('Denúncia encerrada e as partes avisadas.')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Não foi possível encerrar a denúncia.')
    } finally {
      setEnviando(false)
    }
  }

  if (carregando) {
    return <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Carregando denúncia...</p>
  }

  if (!alerta) return null

  const resolvida = alerta.status === 'procedente' || alerta.status === 'improcedente'
  const minha = alerta.assumido_por === user?.id
  const outroAnalisa = !!alerta.assumido_por && !minha

  return (
    <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Toaster position="top-right" toastOptions={{
        duration: 3500,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      {/* Cabeçalho */}
      <div className="flex items-start" style={{ gap: '13px' }}>
        <button
          onClick={() => navigate('/moderacao')}
          className="flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
          style={{
            width: '34px', height: '34px', background: 'var(--bg-card)',
            border: '1px solid var(--border)', color: 'var(--text-secondary)',
          }}
          aria-label="Voltar à fila"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center" style={{ gap: '9px', marginBottom: '3px' }}>
            <span className="font-semibold" style={{ fontSize: '12px', color: AZUL }}>
              {alerta.disciplina_codigo}
            </span>
            <span className="rounded-md" style={{
              padding: '2px 9px', fontSize: '11px',
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
            }}>
              {SITUACAO[alerta.status]}
            </span>
          </div>

          <h1 className="font-bold tracking-tight" style={{ fontSize: '20px', color: 'var(--text-primary)' }}>
            Análise de denúncia
          </h1>
          <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            Registrada por {alerta.denunciante_nome} em {dataHora(alerta.created_at)}
          </p>
        </div>
      </div>

      {/* O que foi alegado */}
      <Secao titulo="Motivo da denúncia">
        <p style={{ fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
          {alerta.motivo}
        </p>
      </Secao>

      {/* O conteúdo em julgamento */}
      <Secao titulo="Conteúdo denunciado">
        <div className="flex items-center justify-between" style={{ gap: '12px', marginBottom: '9px' }}>
          <div className="min-w-0">
            <div className="font-medium truncate" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
              {alerta.post_titulo}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
              {alerta.post_autor_nome} · {dataHora(alerta.post_criado_em)}
              {alerta.post_removido && ' · removido'}
            </div>
          </div>

          <button
            onClick={() => navigate(`/forum/${alerta.topico_id}`)}
            className="rounded-md cursor-pointer flex-shrink-0"
            style={{
              padding: '6px 12px', fontSize: '12.5px',
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            Ver na discussão
          </button>
        </div>

        <div className="rounded-lg" style={{
          padding: '13px 15px', background: 'var(--bg-input)',
          border: '1px solid var(--border)', borderLeft: `3px solid ${AZUL}`,
          fontSize: '13.5px', color: 'var(--text-primary)',
          lineHeight: 1.65, whiteSpace: 'pre-wrap',
        }}>
          {alerta.post_conteudo}
        </div>
      </Secao>

      {/* Decisão */}
      {resolvida ? (
        <Secao titulo="Decisão">
          <p style={{ fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
            {alerta.resolucao}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '10px' }}>
            {SITUACAO[alerta.status]} por {alerta.resolvido_por_nome}
            {alerta.resolvido_em && ` em ${dataHora(alerta.resolvido_em)}`}
          </p>
        </Secao>
      ) : outroAnalisa ? (
        <Secao titulo="Em análise">
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {alerta.assumido_por_nome} assumiu esta denúncia. Duas pessoas
            decidindo o mesmo caso produzem decisões contraditórias, então a
            análise fica com quem assumiu primeiro.
          </p>
        </Secao>
      ) : !minha ? (
        <Secao titulo="Assumir a análise">
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '13px' }}>
            Assumir avisa os demais moderadores de que este caso já tem
            responsável. Você pode devolvê-lo à fila depois, se não for concluir.
          </p>
          <button
            onClick={assumir}
            className="rounded-lg font-medium text-white cursor-pointer"
            style={{ padding: '9px 18px', fontSize: '13.5px', border: 'none', background: AZUL }}
          >
            Assumir esta denúncia
          </button>
        </Secao>
      ) : (
        <Secao titulo="Sua decisão">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '15px' }}>
            {([
              ['procedente', 'Procedente', 'A denúncia se confirma. O conteúdo é removido do fórum e o autor recebe a justificativa.'],
              ['improcedente', 'Improcedente', 'O conteúdo permanece. Apenas o denunciante é avisado do desfecho.'],
            ] as const).map(([chave, rotulo, explicacao]) => (
              <label
                key={chave}
                className="flex items-start rounded-lg cursor-pointer"
                style={{
                  gap: '11px', padding: '12px 14px',
                  background: decisao === chave ? 'rgba(0,48,135,0.05)' : 'var(--bg-input)',
                  border: `1px solid ${decisao === chave ? 'rgba(0,48,135,0.45)' : 'var(--border)'}`,
                }}
              >
                <input
                  type="radio"
                  name="decisao"
                  checked={decisao === chave}
                  onChange={() => setDecisao(chave)}
                  style={{ marginTop: '3px', accentColor: AZUL }}
                />
                <span>
                  <span className="font-medium" style={{ fontSize: '13.5px', color: 'var(--text-primary)', display: 'block' }}>
                    {rotulo}
                  </span>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                    {explicacao}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <label className="block font-medium" style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '6px' }}>
            Justificativa
          </label>
          <p style={{ fontSize: '12.5px', color: 'var(--text-tertiary)', marginBottom: '8px', lineHeight: 1.5 }}>
            Este texto é enviado às pessoas envolvidas. Escreva o que a decisão
            se baseou, não apenas que ela foi tomada.
          </p>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={4}
            placeholder="Ex.: o pedido de compartilhamento de prova aplicada contraria o uso restrito do material de avaliação."
            className="w-full rounded-lg outline-none"
            style={{
              padding: '11px 13px', fontSize: '13px', resize: 'vertical',
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          />

          <div className="flex items-center" style={{ gap: '10px', marginTop: '14px' }}>
            <button
              onClick={resolver}
              disabled={enviando}
              className="rounded-lg font-medium text-white cursor-pointer"
              style={{
                padding: '9px 18px', fontSize: '13.5px', border: 'none',
                background: AZUL, opacity: enviando ? 0.6 : 1,
              }}
            >
              {enviando ? 'Encerrando...' : 'Encerrar denúncia'}
            </button>
            <button
              onClick={liberar}
              disabled={enviando}
              className="cursor-pointer"
              style={{ fontSize: '13px', background: 'none', border: 'none', color: 'var(--text-tertiary)' }}
            >
              Devolver à fila
            </button>
          </div>
        </Secao>
      )}
    </div>
  )
}
