/**
 * AppLayout — Layout compartilhado das paginas internas.
 *
 * Estrutura: Sidebar fixa a esquerda + area principal (Topbar + conteudo).
 * Usado por todas as rotas protegidas.
 */

import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-main)' }}>
      {/* Primeiro elemento focável da página, por isso vem antes de tudo.
          Sem ele, quem navega por teclado percorre os treze itens da barra
          lateral a cada troca de página antes de alcançar o conteúdo. */}
      <a href="#conteudo" className="pular-para-conteudo">
        Pular para o conteúdo
      </a>

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />

        {/* tabIndex={-1} permite que o elemento receba foco por programa, sem
            entrar na ordem de tabulação. É o que faz o atalho acima realmente
            mover o foco, e não apenas rolar a página. */}
        <main
          id="conteudo"
          tabIndex={-1}
          className="flex-1 overflow-y-auto"
          style={{ padding: '24px', outline: 'none' }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
