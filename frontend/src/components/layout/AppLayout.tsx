/**
 * AppLayout — Layout compartilhado das paginas internas.
 *
 * No computador: barra lateral fixa a esquerda, que pode ser recolhida.
 * No telefone: a barra sai do fluxo e vira gaveta sobreposta, aberta pelo
 * botao de menu da barra superior.
 *
 * A distincao importa. Enquanto a barra participava do fluxo em qualquer
 * largura, ela consumia 76 pixels de uma tela de 360 mesmo recolhida, e o
 * conteudo era espremido numa coluna estreita demais para uma palavra caber
 * inteira — o texto quebrava letra a letra.
 */

import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useEhTelaEstreita } from '../../hooks/useMediaQuery'

export function AppLayout() {
  const [recolhida, setRecolhida] = useState(false)
  const [gavetaAberta, setGavetaAberta] = useState(false)
  const ehTelaEstreita = useEhTelaEstreita()
  const localizacao = useLocation()

  /* Navegar fecha a gaveta. Sem isso, quem toca num item do menu vai para a
     pagina nova com a barra ainda cobrindo a tela, e precisa de um segundo
     toque para ver aonde chegou. */
  useEffect(() => {
    setGavetaAberta(false)
  }, [localizacao.pathname])

  /* Enquanto a gaveta cobre a tela, rolar o dedo deve mover o menu, e nao a
     pagina atras dele. */
  useEffect(() => {
    if (!ehTelaEstreita || !gavetaAberta) return

    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = anterior
    }
  }, [ehTelaEstreita, gavetaAberta])

  /* Ao voltar para uma tela larga com a gaveta aberta, o estado precisa ser
     descartado: a barra volta ao fluxo e a sobreposicao nao faz mais sentido. */
  useEffect(() => {
    if (!ehTelaEstreita) setGavetaAberta(false)
  }, [ehTelaEstreita])

  useEffect(() => {
    if (!gavetaAberta) return

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setGavetaAberta(false)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [gavetaAberta])

  return (
    <div
      className="flex h-dvh overflow-hidden"
      style={{ background: 'var(--bg-main)' }}
    >
      {/* Primeiro elemento focável da página, por isso vem antes de tudo.
          Sem ele, quem navega por teclado percorre os treze itens da barra
          lateral a cada troca de página antes de alcançar o conteúdo. */}
      <a href="#conteudo" className="pular-para-conteudo">
        Pular para o conteúdo
      </a>

      {/* Véu que escurece o conteúdo enquanto a gaveta está aberta. Também é
          a área de toque que fecha o menu, gesto que as pessoas já esperam. */}
      {ehTelaEstreita && gavetaAberta && (
        <div
          onClick={() => setGavetaAberta(false)}
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: 'rgba(0,0,0,0.5)',
          }}
        />
      )}

      <Sidebar
        collapsed={!ehTelaEstreita && recolhida}
        onToggle={() => setRecolhida(!recolhida)}
        modoGaveta={ehTelaEstreita}
        gavetaAberta={gavetaAberta}
        onFecharGaveta={() => setGavetaAberta(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          mostrarBotaoMenu={ehTelaEstreita}
          onAbrirMenu={() => setGavetaAberta(true)}
        />

        {/* tabIndex={-1} permite que o elemento receba foco por programa, sem
            entrar na ordem de tabulação. É o que faz o atalho acima realmente
            mover o foco, e não apenas rolar a página. */}
        <main
          id="conteudo"
          tabIndex={-1}
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{
            padding: ehTelaEstreita ? '16px' : '24px',
            outline: 'none',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
