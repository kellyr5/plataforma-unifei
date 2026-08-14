/**
 * SeloOrganizacao — Identificação visual de quem publica uma oportunidade.
 *
 * Numa lista de voluntariado, a instituição é lida antes do título: as pessoas
 * decidem por quem oferece tanto quanto pelo que é oferecido. Uma listagem sem
 * marca obriga a percorrer cada linha de texto para descobrir de quem é a
 * ação, e o reconhecimento visual resolve isso sem custo de leitura.
 *
 * Quando não há imagem enviada, o componente desenha as iniciais em vez de
 * deixar um vazio. Um espaço em branco no lugar do logotipo desalinha a grade
 * e faz o cartão parecer quebrado; as iniciais ocupam a mesma área e ainda
 * distinguem uma organização da outra.
 */

interface Props {
  nome: string
  foto?: string | null
  /** Lado do quadrado, em pixels. */
  tamanho?: number
}

function iniciais(nome: string): string {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean)

  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()

  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export function SeloOrganizacao({ nome, foto, tamanho = 30 }: Props) {
  const estiloBase = {
    width: `${tamanho}px`,
    height: `${tamanho}px`,
    borderRadius: '7px',
    flexShrink: 0,
    overflow: 'hidden',
  } as const

  if (foto) {
    return (
      <img
        src={foto}
        alt={`Logotipo de ${nome}`}
        style={{
          ...estiloBase,
          objectFit: 'contain',
          background: 'var(--bg-input)',
          border: '1px solid var(--border)',
          display: 'block',
        }}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center font-semibold"
      style={{
        ...estiloBase,
        fontSize: `${Math.round(tamanho * 0.38)}px`,
        letterSpacing: '0.02em',
        background: 'var(--accent-blue-soft)',
        color: 'var(--accent-blue-text)',
        border: '1px solid var(--accent-blue-border)',
      }}
      title={nome}
    >
      {iniciais(nome)}
    </span>
  )
}
