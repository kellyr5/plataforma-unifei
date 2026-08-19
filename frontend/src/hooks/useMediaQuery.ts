/**
 * useMediaQuery — responde se a tela satisfaz uma condicao de largura.
 *
 * Existe porque boa parte do layout e decidida em JavaScript, e nao em CSS:
 * a barra lateral muda de comportamento, nao apenas de aparencia. Em telas
 * estreitas ela sai do fluxo e vira gaveta sobreposta, o que nao se resolve
 * com classe condicional — o componente precisa saber em qual modo esta.
 *
 * Usa matchMedia, e nao a largura da janela, porque o navegador so avisa
 * quando o resultado da condicao muda. Escutar o evento de redimensionamento
 * dispararia a cada pixel arrastado.
 */

import { useEffect, useState } from 'react'

export function useMediaQuery(consulta: string): boolean {
  const [combina, setCombina] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(consulta).matches
  })

  useEffect(() => {
    const lista = window.matchMedia(consulta)

    const aoMudar = (evento: MediaQueryListEvent) => setCombina(evento.matches)

    /* O valor pode ter mudado entre a montagem e este efeito — por exemplo,
       quando o aparelho e girado durante o carregamento. */
    setCombina(lista.matches)
    lista.addEventListener('change', aoMudar)

    return () => lista.removeEventListener('change', aoMudar)
  }, [consulta])

  return combina
}

/**
 * O ponto de virada e 1024 pixels.
 *
 * Abaixo disso, a barra lateral recolhida ainda ocupava 76 dos 360 pixels de
 * um telefone comum, e o que sobrava nao comportava um cartao com titulo e
 * texto lado a lado. O valor coincide com o `lg` do Tailwind, o que mantem as
 * classes utilitarias e esta decisao falando da mesma medida.
 */
export const useEhTelaEstreita = () => useMediaQuery('(max-width: 1023px)')
