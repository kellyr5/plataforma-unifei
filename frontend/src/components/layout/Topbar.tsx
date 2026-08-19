/**
 * Topbar — Barra superior com busca, notificacoes e avatar.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../contexts/AuthContext'
import { useNotificacoes } from '../../contexts/NotificacoesContext'
import { useTheme } from '../../contexts/ThemeContext'
import { SunIcon, MoonIcon } from '../ui/Icons'

interface TopbarProps {
  mostrarBotaoMenu?: boolean
  onAbrirMenu?: () => void
}

export function Topbar({ mostrarBotaoMenu = false, onAbrirMenu }: TopbarProps) {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { naoLidas } = useNotificacoes()
  const navigate = useNavigate()
  const [consulta, setConsulta] = useState('')

  const initials = user?.nome_completo
    ? user.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  return (
    <header
      className="flex items-center flex-shrink-0"
      style={{
        height: '56px',
        padding: mostrarBotaoMenu ? '0 12px' : '0 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-card)',
        gap: mostrarBotaoMenu ? '8px' : '16px',
      }}
    >
      {/* Única porta de entrada da navegação no telefone, já que a barra
          lateral sai da tela. Fica à esquerda, onde o polegar alcança. */}
      {mostrarBotaoMenu && (
        <button
          onClick={onAbrirMenu}
          aria-label="Abrir o menu de navegação"
          className="flex items-center justify-center rounded-lg cursor-pointer flex-shrink-0"
          style={{
            width: '40px', height: '40px', border: 'none',
            background: 'transparent', color: 'var(--text-secondary)',
          }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      )}

      {/* Busca no fórum. A consulta vai para /busca, que decide entre
          comparação por significado e correspondência de termos conforme o
          que o servidor tem disponível. */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const termo = consulta.trim()
          if (termo) navigate(`/busca?q=${encodeURIComponent(termo)}`)
        }}
        className="flex items-center flex-1 min-w-0"
        style={{
          maxWidth: '400px', gap: '8px',
          background: 'var(--bg-input)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '8px 12px',
          fontSize: '13px', color: 'var(--text-tertiary)',
        }}
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        {/* Duas adaptações ao telefone.
            O texto longo não cabe num campo estreito: aparecia cortado no meio
            de uma palavra, sem indicar o que fazer.
            E abaixo de 16 pixels o navegador aproxima a página sozinho ao
            focar o campo, deixando a pessoa com o layout ampliado sem ter
            pedido. */}
        <input
          type="text"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          placeholder={
            mostrarBotaoMenu
              ? 'Buscar no fórum...'
              : 'Descreva a dúvida e procure no fórum...'
          }
          aria-label="Buscar no fórum"
          className="flex-1 min-w-0 bg-transparent outline-none"
          style={{
            fontSize: mostrarBotaoMenu ? '16px' : '13px',
            color: 'var(--text-primary)',
          }}
        />
      </form>

      {/* Acoes a direita */}
      <div
        className="flex items-center flex-shrink-0"
        style={{ marginLeft: 'auto', gap: mostrarBotaoMenu ? '2px' : '12px' }}
      >
        {/* Botão só com ícone precisa de nome acessível: sem ele, o leitor de
            tela anuncia apenas "botão" e a pessoa não sabe o que aciona. */}
        <button
          onClick={toggleTheme}
          aria-label={
            theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'
          }
          className="flex items-center justify-center rounded-lg cursor-pointer transition-all duration-200"
          style={{ width: '36px', height: '36px', color: 'var(--text-secondary)' }}
        >
          {theme === 'light' ? MoonIcon : SunIcon}
        </button>

        {/* Notificações — o contador chega pelo WebSocket, sem recarregar a página */}
        <button
          onClick={() => navigate('/notificacoes')}
          aria-label={
            naoLidas > 0
              ? `Notificações: ${naoLidas} não lidas`
              : 'Notificações'
          }
          className="relative flex items-center justify-center rounded-lg cursor-pointer"
          style={{ width: '36px', height: '36px', color: 'var(--text-secondary)' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>

          {naoLidas > 0 && (
            <span
              className="flex items-center justify-center"
              style={{
                position: 'absolute', top: '2px', right: '2px',
                minWidth: '17px', height: '17px', padding: '0 4px',
                borderRadius: '9px',
                background: 'var(--accent-red)', color: 'white',
                fontSize: '10px', fontWeight: 600, lineHeight: 1,
                border: '2px solid var(--bg-card)',
              }}
            >
              {/* O número já é anunciado pelo aria-label do botão; repeti-lo
                  aqui faria o leitor dizer a contagem duas vezes. */}
              <span aria-hidden="true">{naoLidas > 99 ? '99+' : naoLidas}</span>
            </span>
          )}
        </button>

        {/* Era uma <div> com cursor de mão e nenhum comportamento: parecia
            clicável, não respondia ao clique e o teclado não a alcançava.
            Virou botão de verdade, que leva ao perfil. */}
        <button
          onClick={() => navigate('/perfil')}
          aria-label={`Abrir o perfil de ${user?.nome_completo || 'usuário'}`}
          className="flex items-center justify-center rounded-full cursor-pointer"
          style={{
            width: '34px', height: '34px', border: 'none',
            background: 'var(--accent-blue)', color: 'white',
            fontSize: '13px', fontWeight: 500,
          }}
        >
          <span aria-hidden="true">{initials}</span>
        </button>
      </div>
    </header>
  )
}
