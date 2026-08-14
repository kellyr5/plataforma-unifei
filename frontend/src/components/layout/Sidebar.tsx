/**
 * Sidebar — Navegacao lateral com identidade UNIFEI forte.
 *
 * Fundo azul institucional (gradiente profundo), itens com hover
 * deslizante, item ativo com destaque branco/glow, mini card de
 * usuario no rodape. Identidade visual imediata.
 */

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import logoSymbolDark from '../../assets/logo-unifei-symbol-dark.png'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  section?: string
  /* Quando presente, o item só aparece para quem satisfaz a condição. Vale
     apenas para a navegação: a permissão continua sendo verificada no
     backend a cada requisição. */
  visivelPara?: (usuario: UsuarioNavegacao) => boolean
}

interface UsuarioNavegacao {
  pode_moderar?: boolean
  e_coordenacao?: boolean
  e_organizacao?: boolean
  e_professor?: boolean
  e_monitor?: boolean
  papeis_disciplina?: { papel: string }[]
}

/* A organização parceira não participa do fórum: ela publica oportunidades,
   acompanha inscrições e emite certificados. Deixar o fórum visível para ela
   seria oferecer um caminho sem conteúdo e sem papel definido. */
const eEstudante = (u: UsuarioNavegacao) =>
  !u.e_organizacao && !u.e_coordenacao

const participaDoForum = (u: UsuarioNavegacao) => !u.e_organizacao

/**
 * Quem tem vínculo com alguma disciplina, em qualquer papel.
 *
 * A distinção que faltava: coordenar o curso não é participar das turmas. A
 * coordenação enxerga tudo para poder acompanhar, mas não cursa nem leciona —
 * ela não tem grupo de trabalho para entrar, nem conversa de equipe para
 * abrir. Exibir a aba levava a uma tela onde toda ação disponível terminava
 * em erro do servidor.
 *
 * O critério é o vínculo, e não o papel global, porque é o vínculo que define
 * pertencimento a uma turma.
 */
const temVinculoComDisciplina = (u: UsuarioNavegacao) =>
  (u.papeis_disciplina?.length ?? 0) > 0

/** Conduz ao menos uma turma, como professor ou monitor. */
const conduzTurma = (u: UsuarioNavegacao) =>
  (u.papeis_disciplina ?? []).some(
    v => v.papel === 'professor' || v.papel === 'monitor'
  )

const navItems: NavItem[] = [
  { section: 'Principal', label: 'Página inicial', path: '/dashboard', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg> },
  {
    /* O fórum é por disciplina, e só entra nele quem tem vínculo com alguma.
       A coordenação acompanha a discussão pelo painel do curso, que agrega
       por disciplina, e modera pela aba própria. Aqui ela via as dúvidas de
       turmas que não cursa nem leciona, ao lado de um aviso dizendo que não
       está em disciplina nenhuma — e de um botão de publicar que não teria
       onde publicar. */
    label: 'Fórum',
    path: '/forum',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 1.136.845 2.1 1.976 2.193 1.234.1 2.4.163 3.548.163" /></svg>,
    visivelPara: (u) => participaDoForum(u) && temVinculoComDisciplina(u),
  },
  { label: 'Voluntariado', path: '/voluntariado', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg> },
  {
    label: 'Meu andamento',
    path: '/andamento',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
    /* Andamento é acompanhamento do próprio percurso como estudante. Quem
       coordena vê o conjunto das disciplinas na própria página inicial. */
    visivelPara: (u) => participaDoForum(u) && !u.e_coordenacao,
  },
  {
    /* Trabalho em grupo pressupõe turma: quem não cursa nem leciona a
       disciplina não tem o que fazer aqui. */
    label: 'Trabalhos',
    path: '/trabalhos',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>,
    visivelPara: (u) => participaDoForum(u) && temVinculoComDisciplina(u),
  },
  {
    /* O monitor continua sendo estudante: mantém todas as abas de aluno e
       ganha esta, restrita às disciplinas em que exerce a monitoria. */
    label: 'Monitoria',
    path: '/monitoria',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>,
    visivelPara: (u) => !!u.e_monitor,
  },
  {
    /* Fila separada do fórum: aqui a dúvida vem de dentro de um grupo de
       trabalho, e chega com o recorte que o próprio grupo escolheu enviar. */
    label: 'Pedidos de ajuda',
    path: '/ajuda',
    /* Dúvida de grupo é atendida por quem conduz a turma. A coordenação
       modera conteúdo do curso inteiro, mas não acompanha o andamento de um
       trabalho específico — responder ali exigiria conhecer o enunciado e o
       momento do conteúdo. */
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>,
    visivelPara: (u) => conduzTurma(u),
  },
  {
    label: 'Moderação',
    path: '/moderacao',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
    visivelPara: (usuario) => !!usuario.pode_moderar,
  },
  { section: 'Conta', label: 'Notificações', path: '/notificacoes', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg> },
  {
    /* Certificado é documento do voluntário. Quem coordena o curso ou quem
       publica a oportunidade não recebe certificado, recebe quem participou. */
    label: 'Certificados',
    path: '/certificados',
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
    visivelPara: eEstudante,
  },
  { label: 'Meu perfil', path: '/perfil', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg> },
]

function NavButton({ item, isActive, collapsed, onClick }: {
  item: NavItem; isActive: boolean; collapsed: boolean; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      /* aria-current="page" é como o leitor de tela anuncia onde a pessoa
         está. Sem isso, o destaque branco do item ativo é informação que só
         existe para quem enxerga. Quando a barra está recolhida, o rótulo
         some da tela e precisa vir pelo aria-label. */
      aria-current={isActive ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className="w-full flex items-center rounded-xl cursor-pointer relative"
      style={{
        padding: collapsed ? '11px' : '11px 14px',
        gap: '12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: isActive ? 'rgba(255,255,255,0.12)' : (hovered ? 'rgba(255,255,255,0.06)' : 'transparent'),
        color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
        fontSize: '13.5px',
        fontWeight: isActive ? 600 : 450,
        transform: hovered && !isActive ? 'translateX(3px)' : 'translateX(0)',
        transition: 'all 0.18s ease',
      }}
    >
      {/* Barra lateral (item ativo) */}
      {isActive && (
        <div style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: '3px', height: '60%', borderRadius: '0 3px 3px 0',
          background: '#60A5FA', boxShadow: '0 0 10px rgba(96,165,250,0.7)',
        }} />
      )}
      <span className="flex-shrink-0" style={{
        transition: 'transform 0.18s ease',
        transform: hovered ? 'scale(1.1)' : 'scale(1)',
        color: isActive ? '#60A5FA' : 'inherit',
      }}>{item.icon}</span>
      {!collapsed && <span>{item.label}</span>}
    </button>
  )
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [logoutHovered, setLogoutHovered] = useState(false)

  const initials = user?.nome_completo
    ? user.nome_completo.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  // O aluno não enxerga a moderação nem as áreas exclusivas dos outros perfis.
  const itensVisiveis = navItems.filter(
    item => !item.visivelPara || item.visivelPara(user ?? {})
  )

  let lastSection = ''

  return (
    <aside
      aria-label="Navegação principal"
      className="h-screen flex flex-col flex-shrink-0 relative overflow-hidden"
      style={{
        width: collapsed ? '76px' : '248px',
        background: 'linear-gradient(180deg, #001233 0%, #001845 50%, #002150 100%)',
        transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Decoracao sutil de fundo */}
      <div style={{
        position: 'absolute', top: '-60px', right: '-60px', width: '180px', height: '180px',
        borderRadius: '50%', background: 'rgba(96,165,250,0.04)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '120px', left: '-40px', width: '120px', height: '120px',
        borderRadius: '50%', background: 'rgba(96,165,250,0.03)', pointerEvents: 'none',
      }} />

      {/* Logo + toggle */}
      <div className="flex items-center relative z-10" style={{
        padding: collapsed ? '18px 0' : '18px 16px 18px 20px',
        justifyContent: collapsed ? 'center' : 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* Assinatura da plataforma.
            O letreiro cromado usado antes vinha de um arquivo com as letras
            cortadas nas bordas da própria imagem, e a marca aparecia como
            "UNIFE!". Enquanto a assinatura oficial da SECOM não entra no
            projeto, o símbolo institucional acompanha o nome em texto, que ao
            menos é legível, redimensiona sem perda e não deforma. */}
        {collapsed ? (
          <img
            src={logoSymbolDark}
            alt="UNIFEI"
            style={{ height: '32px', transition: 'all 0.28s ease' }}
            className="object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex items-center" style={{ gap: '10px' }}>
            <img
              src={logoSymbolDark}
              alt=""
              style={{ height: '30px' }}
              className="object-contain flex-shrink-0"
              draggable={false}
            />
            <div style={{ lineHeight: 1.15 }}>
              <div style={{
                fontSize: '15px', fontWeight: 700, letterSpacing: '0.06em',
                color: '#FFFFFF',
              }}>
                UNIFEI
              </div>
              <div style={{
                fontSize: '9px', letterSpacing: '0.11em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap',
              }}>
                Fórum acadêmico
              </div>
            </div>
          </div>
        )}
        {!collapsed && (
          <button onClick={onToggle} className="cursor-pointer transition-colors"
            aria-label="Recolher a barra de navegação"
            style={{ color: 'rgba(255,255,255,0.4)', padding: '4px', background: 'none', border: 'none' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={onToggle} className="cursor-pointer flex items-center justify-center relative z-10"
          aria-label="Expandir a barra de navegação"
          style={{ padding: '8px 0', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      )}

      {/* Navegacao */}
      <nav aria-label="Seções da plataforma" className="flex-1 overflow-y-auto relative z-10" style={{ padding: '10px' }}>
        {itensVisiveis.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
          const showSection = item.section && item.section !== lastSection
          if (item.section) lastSection = item.section

          return (
            <div key={item.path}>
              {showSection && !collapsed && (
                <div style={{
                  padding: '16px 12px 6px', fontSize: '10.5px', color: 'rgba(255,255,255,0.3)',
                  textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: 600,
                }}>{item.section}</div>
              )}
              {showSection && collapsed && <div style={{ height: '14px' }} />}
              <div style={{ marginBottom: '3px' }}>
                <NavButton item={item} isActive={isActive} collapsed={collapsed} onClick={() => navigate(item.path)} />
              </div>
            </div>
          )
        })}
      </nav>

      {/* Mini card usuario + sair */}
      <div className="relative z-10" style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {!collapsed ? (
          <div className="rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', padding: '10px', marginBottom: '8px' }}>
            <div className="flex items-center" style={{ gap: '10px' }}>
              <div className="flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #3B82F6, #60A5FA)', color: 'white', fontSize: '13px', fontWeight: 600 }}>
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate" style={{ fontSize: '13px', color: '#FFFFFF' }}>
                  {user?.nome_completo?.split(' ').slice(0, 2).join(' ') || 'Usuário'}
                </div>
                <div className="truncate" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                  {user?.rotulo_perfil || 'Estudante'}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg"
            style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #3B82F6, #60A5FA)', color: 'white', fontSize: '13px', fontWeight: 600, margin: '0 auto 8px' }}>
            {initials}
          </div>
        )}

        <button
          onClick={logout}
          onMouseEnter={() => setLogoutHovered(true)}
          onMouseLeave={() => setLogoutHovered(false)}
          className="w-full flex items-center rounded-xl cursor-pointer"
          style={{
            padding: collapsed ? '10px' : '10px 14px',
            gap: '12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: logoutHovered ? '#FF8080' : 'rgba(255,255,255,0.55)',
            background: logoutHovered ? 'rgba(255,128,128,0.1)' : 'transparent',
            fontSize: '13.5px',
            transition: 'all 0.18s ease',
          }}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  )
}
