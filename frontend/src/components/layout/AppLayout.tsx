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
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Area principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />

        {/* Conteudo da pagina (scroll independente) */}
        <main className="flex-1 overflow-y-auto" style={{ padding: '24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
