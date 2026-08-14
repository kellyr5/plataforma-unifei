/**
 * NovaOportunidade — Publicação de vaga de voluntariado.
 *
 * O formulário está organizado na ordem em que o estudante lê o anúncio: o
 * que é, o que ele vai fazer, o que se espera dele, onde e quando. Campos
 * administrativos, como a política de aprovação, ficam por último porque não
 * interessam a quem se inscreve.
 *
 * Serve também para edição, quando recebe um identificador na rota.
 */

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'

import api from '../../services/api'

const AZUL = 'var(--accent-blue)'

const AREAS = [
  ['educacao', 'Educação'],
  ['saude', 'Saúde'],
  ['meio_ambiente', 'Meio ambiente'],
  ['assistencia_social', 'Assistência social'],
  ['direitos_humanos', 'Direitos humanos'],
  ['cultura', 'Cultura e arte'],
  ['tecnologia', 'Tecnologia'],
  ['esporte', 'Esporte'],
  ['outro', 'Outro'],
]

const campo = {
  width: '100%', padding: '10px 13px', fontSize: '13.5px', borderRadius: '9px',
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  border: '1px solid var(--border)',
}

const rotulo = {
  fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)',
  display: 'block', marginBottom: '5px',
}

const ajuda = {
  fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '4px',
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl" style={{
      padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', gap: '14px',
    }}>
      <h2 className="font-semibold" style={{ fontSize: '14.5px', color: 'var(--text-primary)' }}>
        {titulo}
      </h2>
      {children}
    </section>
  )
}

export default function NovaOportunidade() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const editando = !!id

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [oQueFazer, setOQueFazer] = useState('')
  const [requisitos, setRequisitos] = useState('')
  const [area, setArea] = useState('educacao')
  const [local, setLocal] = useState('')
  const [vagas, setVagas] = useState('5')
  const [cargaHoraria, setCargaHoraria] = useState('20')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [prazo, setPrazo] = useState('')
  const [requerAprovacao, setRequerAprovacao] = useState(true)
  const [imagem, setImagem] = useState<File | null>(null)
  const [imagemAtual, setImagemAtual] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!editando) return

    api.get(`/voluntariado/oportunidades/${id}/`).then(({ data }) => {
      setTitulo(data.titulo)
      setDescricao(data.descricao)
      setOQueFazer(data.o_que_fazer || '')
      setRequisitos(data.requisitos || '')
      setArea(data.area)
      setLocal(data.local)
      setVagas(String(data.vagas))
      setCargaHoraria(String(data.carga_horaria_total))
      setDataInicio(data.data_inicio)
      setDataFim(data.data_fim)
      setPrazo(data.prazo_inscricao)
      setRequerAprovacao(data.requer_aprovacao)
      setImagemAtual(data.imagem_url)
    }).catch(() => toast.error('Não foi possível carregar a oportunidade.'))
  }, [editando, id])

  async function publicar(e: React.FormEvent) {
    e.preventDefault()

    if (!titulo.trim()) return toast.error('Dê um título à oportunidade.')
    if (!descricao.trim()) return toast.error('Descreva a oportunidade.')
    if (!local.trim()) return toast.error('Informe o local.')
    if (!dataInicio || !dataFim || !prazo) return toast.error('Preencha as três datas.')

    if (prazo > dataInicio) {
      return toast.error('O prazo de inscrição precisa ser anterior ao início.')
    }
    if (dataFim < dataInicio) {
      return toast.error('A data de término não pode ser anterior ao início.')
    }

    const corpo = new FormData()
    corpo.append('titulo', titulo.trim())
    corpo.append('descricao', descricao.trim())
    corpo.append('o_que_fazer', oQueFazer.trim())
    corpo.append('requisitos', requisitos.trim())
    corpo.append('area', area)
    corpo.append('local', local.trim())
    corpo.append('vagas', vagas)
    corpo.append('carga_horaria_total', cargaHoraria)
    corpo.append('data_inicio', dataInicio)
    corpo.append('data_fim', dataFim)
    corpo.append('prazo_inscricao', prazo)
    corpo.append('requer_aprovacao', String(requerAprovacao))
    if (imagem) corpo.append('imagem', imagem)

    setEnviando(true)
    try {
      const rota = editando
        ? `/voluntariado/oportunidades/${id}/`
        : '/voluntariado/oportunidades/'

      const { data } = await api({
        url: rota,
        method: editando ? 'patch' : 'post',
        data: corpo,
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      toast.success(editando ? 'Oportunidade atualizada.' : 'Oportunidade publicada.')
      navigate(`/organizacao/oportunidade/${data.id}`)
    } catch (err: any) {
      const dados = err.response?.data || {}
      const primeiro = dados.detail
        || Object.values(dados).flat()[0]
        || 'Não foi possível publicar.'
      toast.error(String(primeiro))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ maxWidth: '760px' }}>
      <Toaster position="top-right" toastOptions={{
        duration: 3500,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      <div className="flex items-center" style={{ gap: '14px', marginBottom: '20px' }}>
        <button
          onClick={() => navigate(-1)}
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
        <div>
          <h1 className="font-bold tracking-tight" style={{ fontSize: '22px', color: 'var(--text-primary)' }}>
            {editando ? 'Editar oportunidade' : 'Nova oportunidade'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Descreva a ação como o estudante precisa entendê-la para decidir se participa.
          </p>
        </div>
      </div>

      <form onSubmit={publicar} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <Secao titulo="Identificação">
          <div>
            <label style={rotulo}>Título</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Oficina de lógica para o ensino médio"
              style={campo}
              className="outline-none"
            />
          </div>

          <div>
            <label style={rotulo}>Área</label>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              style={campo}
              className="cursor-pointer outline-none"
            >
              {AREAS.map(([valor, nome]) => (
                <option key={valor} value={valor}>{nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={rotulo}>Imagem de capa</label>

            {imagemAtual && !imagem && (
              <img
                src={imagemAtual}
                alt=""
                style={{
                  width: '100%', maxHeight: '150px', objectFit: 'cover',
                  borderRadius: '9px', marginBottom: '8px',
                }}
              />
            )}

            <label
              htmlFor="capa"
              className="inline-flex items-center rounded-lg font-medium cursor-pointer"
              style={{
                padding: '9px 15px', gap: '7px', fontSize: '13px', color: AZUL,
                background: 'rgba(0,48,135,0.06)', border: '1px solid rgba(0,48,135,0.25)',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              {imagem ? imagem.name : 'Escolher imagem'}
            </label>
            <input
              id="capa"
              type="file"
              accept="image/*"
              onChange={(e) => setImagem(e.target.files?.[0] || null)}
              style={{ display: 'none' }}
            />
            <p style={ajuda}>Opcional. Aparece no cartão que o estudante vê na listagem.</p>
          </div>
        </Secao>

        <Secao titulo="O que será feito">
          <div>
            <label style={rotulo}>Descrição</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
              placeholder="Qual o propósito da ação e quem ela atende."
              style={{ ...campo, resize: 'vertical' }}
              className="outline-none"
            />
          </div>

          <div>
            <label style={rotulo}>Atividades do voluntário</label>
            <textarea
              value={oQueFazer}
              onChange={(e) => setOQueFazer(e.target.value)}
              rows={3}
              placeholder="O que a pessoa vai fazer no dia a dia da ação."
              style={{ ...campo, resize: 'vertical' }}
              className="outline-none"
            />
          </div>

          <div>
            <label style={rotulo}>Requisitos</label>
            <textarea
              value={requisitos}
              onChange={(e) => setRequisitos(e.target.value)}
              rows={2}
              placeholder="Conhecimento prévio, disponibilidade, documentos."
              style={{ ...campo, resize: 'vertical' }}
              className="outline-none"
            />
            <p style={ajuda}>Deixe em branco se não houver exigência.</p>
          </div>
        </Secao>

        <Secao titulo="Onde e quando">
          <div>
            <label style={rotulo}>Local</label>
            <input
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex.: Escola Estadual Wenceslau Braz, Itajubá"
              style={campo}
              className="outline-none"
            />
          </div>

          <div className="flex" style={{ gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={rotulo}>Início</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                style={campo} className="outline-none" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={rotulo}>Término</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                style={campo} className="outline-none" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={rotulo}>Inscrições até</label>
              <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)}
                style={campo} className="outline-none" />
            </div>
          </div>

          <div className="flex" style={{ gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={rotulo}>Vagas</label>
              <input type="number" min={1} value={vagas} onChange={(e) => setVagas(e.target.value)}
                style={campo} className="outline-none" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={rotulo}>Carga horária total</label>
              <input type="number" min={1} value={cargaHoraria} onChange={(e) => setCargaHoraria(e.target.value)}
                style={campo} className="outline-none" />
              <p style={ajuda}>Em horas. É o que constará no certificado.</p>
            </div>
          </div>
        </Secao>

        <Secao titulo="Inscrições">
          <label className="flex items-start cursor-pointer" style={{ gap: '10px' }}>
            <input
              type="checkbox"
              checked={requerAprovacao}
              onChange={(e) => setRequerAprovacao(e.target.checked)}
              style={{ marginTop: '3px' }}
            />
            <span>
              <span style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>
                Avaliar cada inscrição antes de aceitar
              </span>
              <span style={{ ...ajuda, display: 'block' }}>
                Desmarcado, quem se inscrever é aceito automaticamente enquanto
                houver vaga. Marcado, você decide caso a caso.
              </span>
            </span>
          </label>
        </Secao>

        <div className="flex items-center" style={{ gap: '10px' }}>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-xl font-medium text-white cursor-pointer"
            style={{
              padding: '11px 22px', fontSize: '14px', border: 'none',
              background: AZUL, opacity: enviando ? 0.6 : 1,
            }}
          >
            {enviando ? 'Salvando...' : (editando ? 'Salvar alterações' : 'Publicar oportunidade')}
          </button>

          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="cursor-pointer"
            style={{ fontSize: '13px', background: 'none', border: 'none', color: 'var(--text-tertiary)' }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
