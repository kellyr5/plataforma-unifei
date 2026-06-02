/**
 * Topbar — Barra superior com busca, notificacoes e avatar.
 */

import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { SunIcon, MoonIcon } from '../ui/Icons'

export function Topbar() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const initials = user?.nome_completo
    ? user.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <header
      className="flex items-center flex-shrink-0"
      style={{
        height: '56px',
        padding: '0 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)',
        gap: '16px',
      }}
    >
      {/* Busca */}
      <div
        className="flex items-center flex-1"
        style={{
          maxWidth: '400px', gap: '8px',
          background: 'var(--bg-input)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '8px 12px',
          fontSize: '13px', color: 'var(--text-tertiary)',
        }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar disciplinas, topicos, oportunidades..."
          className="flex-1 bg-transparent outline-none"
          style={{ fontSize: '13px', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Acoes a direita */}
      <div className="flex items-center" style={{ marginLeft: 'auto', gap: '12px' }}>
        {/* Toggle tema */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200"
          style={{ width: '36px', height: '36px', color: 'var(--text-secondary)' }}
        >
          {theme === 'light' ? MoonIcon : SunIcon}
        </button>

        {/* Notificacoes */}
        <button
          className="relative flex items-center justify-center rounded-lg cursor-pointer"
          style={{ width: '36px', height: '36px', color: 'var(--text-secondary)' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
          <div style={{
            position: 'absolute', top: '4px', right: '4px',
            width: '8px', height: '8px', borderRadius: '50%',
            background: 'var(--accent-red)', border: '2px solid var(--bg-card)',
          }} />
        </button>

        {/* Avatar */}
        <div
          className="flex items-center justify-center rounded-full cursor-pointer"
          style={{
            width: '34px', height: '34px',
            background: '#003087', color: 'white',
            fontSize: '13px', fontWeight: 500,
          }}
        >
          {initials}
        </div>
      </div>
    </header>
  )
}
