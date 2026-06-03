/**
 * Sidebar — Navegacao lateral colapsavel.
 *
 * Itens de navegacao definidos em array (config-driven).
 * Usa useLocation do React Router pra destacar a rota ativa.
 * Colapsavel: icones + labels (expandido) ou so icones (colapsado).
 */

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import logoFullDark from '../../assets/logo-unifei-full-dark.png'
import logoFullLight from '../../assets/logo-unifei-full-light.png'
import logoSymbolDark from '../../assets/logo-unifei-symbol-dark.png'
import logoSymbolLight from '../../assets/logo-unifei-symbol-light.png'
import { useTheme } from '../../contexts/ThemeContext'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  badge?: number
  section?: string
}

const navItems: NavItem[] = [
  { section: 'Principal', label: 'Dashboard', path: '/dashboard', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg> },
  { label: 'Forum', path: '/forum', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 1.136.845 2.1 1.976 2.193 1.234.1 2.4.163 3.548.163" /></svg> },
  { label: 'Voluntariado', path: '/voluntariado', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg> },
  { label: 'Ranking', path: '/ranking', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 01-5.54 0" /></svg> },

  { section: 'Conta', label: 'Notificações', path: '/notificacoes', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg> },
  { label: 'Certificados', path: '/certificados', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg> },
  { label: 'Meu perfil', path: '/perfil', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg> },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { theme } = useTheme()

  const logoFull = theme === 'dark' ? logoFullDark : logoFullLight
  const logoSymbol = theme === 'dark' ? logoSymbolDark : logoSymbolLight

  let lastSection = ''

  return (
    <aside
      className="h-screen flex flex-col transition-all duration-300 flex-shrink-0"
      style={{
        width: collapsed ? '68px' : '240px',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between" style={{ padding: collapsed ? '16px' : '16px 16px 16px 20px', borderBottom: '1px solid var(--border)' }}>
        {collapsed
          ? <img src={logoSymbol} alt="UNIFEI" style={{ height: '28px' }} className="object-contain" draggable={false} />
          : <img src={logoFull} alt="UNIFEI" style={{ height: '28px' }} className="object-contain" draggable={false} />
        }
        <button onClick={onToggle} className="cursor-pointer" style={{ color: 'var(--text-tertiary)', padding: '4px' }}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            {collapsed
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            }
          </svg>
        </button>
      </div>

      {/* Navegacao */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '8px' }}>
        {navItems.map((item, i) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
          const showSection = item.section && item.section !== lastSection
          if (item.section) lastSection = item.section

          return (
            <div key={item.path}>
              {showSection && !collapsed && (
                <div style={{ padding: '16px 12px 6px', fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {item.section}
                </div>
              )}
              {showSection && collapsed && <div style={{ height: '16px' }} />}

              <button
                onClick={() => navigate(item.path)}
                className="w-full flex items-center rounded-lg cursor-pointer transition-all duration-150"
                style={{
                  padding: collapsed ? '10px' : '10px 12px',
                  gap: '10px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: isActive ? 'rgba(0,48,135,0.08)' : 'transparent',
                  color: isActive ? '#003087' : 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && item.badge && (
                  <span style={{
                    marginLeft: 'auto', background: '#003087', color: 'white',
                    fontSize: '11px', padding: '1px 7px', borderRadius: '10px', fontWeight: 500,
                  }}>{item.badge}</span>
                )}
              </button>
            </div>
          )
        })}
      </nav>

      {/* Botao de sair */}
      <div style={{ padding: '8px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={logout}
          className="w-full flex items-center rounded-lg cursor-pointer transition-all duration-150"
          style={{
            padding: collapsed ? '10px' : '10px 12px',
            gap: '10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--text-secondary)',
            fontSize: '13px',
          }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  )
}
