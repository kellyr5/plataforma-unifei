import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from '../../contexts/ThemeContext'

import logoSymbolDark from '../../assets/logo-unifei-symbol-dark.png'
import logoFullDark from '../../assets/logo-unifei-full-dark.png'
import logoFullLight from '../../assets/logo-unifei-full-light.png'
import campusBg1 from '../../assets/campus-unifei.jpeg'
import campusBg2 from '../../assets/campus-unifei-entrada.jpg'

/* ============================================================
   HOOK: Mouse Parallax
   ============================================================ */
function useMouseParallax(ref: React.RefObject<HTMLDivElement | null>, intensity = 6) {
  const [t, setT] = useState({ rx: 0, ry: 0, x: 0, y: 0 })
  const handleMove = useCallback((e: MouseEvent) => {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    const x = (e.clientX - r.left - r.width / 2) / (r.width / 2)
    const y = (e.clientY - r.top - r.height / 2) / (r.height / 2)
    requestAnimationFrame(() => setT({ rx: -y * intensity, ry: x * intensity, x: x * 5, y: y * 5 }))
  }, [ref, intensity])
  const handleLeave = useCallback(() => setT({ rx: 0, ry: 0, x: 0, y: 0 }), [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.addEventListener('mousemove', handleMove)
    el.addEventListener('mouseleave', handleLeave)
    return () => { el.removeEventListener('mousemove', handleMove); el.removeEventListener('mouseleave', handleLeave) }
  }, [ref, handleMove, handleLeave])
  return t
}

/* ============================================================
   HOOK: Count-up
   ============================================================ */
function useCountUp(target: number, duration = 1200, delay = 800) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = Date.now()
      const tick = () => {
        const p = Math.min((Date.now() - start) / duration, 1)
        setV(Math.round((1 - Math.pow(1 - p, 3)) * target))
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, delay)
    return () => clearTimeout(timeout)
  }, [target, duration, delay])
  return v
}

/* ============================================================
   COMPONENTE: Engrenagem SVG (sombra giratoria)
   ============================================================ */
function GearShadow({ size, speed }: { size: number; speed: number }) {
  const teeth = 10
  const outerR = 48, midR = 42, innerR = 36
  let d = `M`
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2
    const a1 = ((i + 0.15) / teeth) * Math.PI * 2
    const a2 = ((i + 0.35) / teeth) * Math.PI * 2
    const a3 = ((i + 0.5) / teeth) * Math.PI * 2
    const a4 = ((i + 0.65) / teeth) * Math.PI * 2
    const a5 = ((i + 0.85) / teeth) * Math.PI * 2

    /* Dente trapezoidal: sobe pelo inner, topo largo no outer, desce pelo inner */
    d += `${50 + Math.cos(a0) * midR},${50 + Math.sin(a0) * midR} `
    d += `L${50 + Math.cos(a1) * outerR},${50 + Math.sin(a1) * outerR} `
    d += `L${50 + Math.cos(a2) * outerR},${50 + Math.sin(a2) * outerR} `
    d += `L${50 + Math.cos(a3) * midR},${50 + Math.sin(a3) * midR} `
    /* Vale entre dentes */
    d += `L${50 + Math.cos(a4) * innerR},${50 + Math.sin(a4) * innerR} `
    d += `L${50 + Math.cos(a5) * innerR},${50 + Math.sin(a5) * innerR} `
  }
  d += 'Z'
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="absolute"
      style={{ animation: `gear-spin ${speed}s linear infinite` }}>
      <path d={d} fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="12" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
    </svg>
  )
}

/* ============================================================
   COMPONENTE: Stat
   ============================================================ */
function Stat({ target, suffix, label, delay }: { target: number; suffix: string; label: string; delay: number }) {
  const v = useCountUp(target, 1200, delay)
  return (
    <div className="text-center">
      <div className="text-white font-bold text-2xl tracking-tight">{v}{suffix}</div>
      <div className="text-white/30 text-[11px] mt-1 tracking-widest uppercase">{label}</div>
    </div>
  )
}

/* ============================================================
   COMPONENTE: Carrossel de fundo
   ============================================================ */
function BackgroundCarousel() {
  const [current, setCurrent] = useState(0)
  const images = [campusBg1, campusBg2]

  useEffect(() => {
    const interval = setInterval(() => setCurrent(c => (c + 1) % images.length), 8000)
    return () => clearInterval(interval)
  }, [images.length])

  return (
    <div className="absolute inset-0">
      {images.map((img, i) => (
        <img key={i} src={img} alt="" draggable={false}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[2000ms]"
          style={{ opacity: i === current ? 1 : 0, filter: 'saturate(0.6) brightness(0.3)' }} />
      ))}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(0,18,51,0.5) 0%, rgba(0,18,51,0.4) 40%, rgba(0,18,51,0.8) 100%)' }} />
    </div>
  )
}

/* ============================================================
   COMPONENTE: Input
   ============================================================ */
function InputField({
  label, type = 'text', placeholder, icon, rightElement, labelRight,
}: {
  label: string; type?: string; placeholder: string
  icon: React.ReactNode; rightElement?: React.ReactNode; labelRight?: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{label}</label>
        {labelRight}
      </div>
      <div className="flex items-center gap-3 px-4 py-10 rounded-xl transition-all duration-200"
        style={{
          background: 'var(--bg-input)',
          border: focused ? '1.5px solid #003087' : '1.5px solid var(--border)',
          boxShadow: focused ? '0 0 0 3px rgba(0,48,135,0.08)' : 'none',
        }}>
        <span style={{ color: focused ? '#003087' : 'var(--text-tertiary)' }}
          className="transition-colors duration-200 flex-shrink-0">{icon}</span>
        <input type={type} placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-[14px] min-w-0"
          style={{ color: 'var(--text-primary)' }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
        {rightElement}
      </div>
    </div>
  )
}

/* ============================================================
   PAGINA DE LOGIN
   ============================================================ */
export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'primeiro-acesso' | 'codigo'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const parallaxRef = useRef<HTMLDivElement>(null)
  const t = useMouseParallax(parallaxRef, 7)

  useEffect(() => { const tm = setTimeout(() => setMounted(true), 150); return () => clearTimeout(tm) }, [])

  const EyeToggle = (
    <button type="button" onClick={() => setShowPassword(!showPassword)}
      className="p-1 cursor-pointer transition-colors flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        {showPassword
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          : <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>
        }
      </svg>
    </button>
  )

  /* Icone de cadeado */
  const LockIcon = <svg className="w-[20px] h-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
  const UserIcon = <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" /></svg>
  const EmailIcon = <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-main)' }}>

      <style>{`
        @keyframes gear-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes glow { 0%, 100% { opacity: 0.1; } 50% { opacity: 0.18; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes logoFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes logoEntry { from { opacity: 0; transform: scale(0.85) rotateY(-12deg); } to { opacity: 1; transform: scale(1) rotateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>

      {/* ============ PAINEL ESQUERDO (55%) ============ */}
      <div ref={parallaxRef}
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col cursor-default"
        style={{ perspective: '1000px' }}>

        <BackgroundCarousel />

        {/* Conteudo */}
        <div className="relative z-10 flex flex-col h-full p-10">

          {/* Header — logo mais visivel */}
          <div style={{ animation: mounted ? 'fadeUp 0.6s ease-out' : 'none', opacity: mounted ? 1 : 0 }}>
            <img src={logoFullDark} alt="UNIFEI" className="h-10 object-contain drop-shadow-lg" draggable={false}
              style={{ filter: 'brightness(1.3) drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }} />
          </div>

          {/* Centro */}
          <div className="flex-1 flex flex-col items-center justify-center">

            {/* Logo com engrenagem-sombra + parallax + float */}
            <div className="relative mb-10" style={{
              animation: mounted ? 'logoEntry 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both' : 'none',
              transform: `perspective(800px) rotateX(${t.rx}deg) rotateY(${t.ry}deg)`,
              transition: 'transform 0.3s ease-out', transformStyle: 'preserve-3d',
            }}>
              {/* Engrenagem-sombra girando atras do logo */}
              <div className="absolute inset-0 flex items-center justify-center" style={{ transform: 'translateZ(-20px)' }}>
                <GearShadow size={280} speed={40} />
              </div>

              {/* Glow sutil */}
              <div className="absolute -inset-16 rounded-full blur-3xl"
                style={{ background: 'radial-gradient(circle, rgba(0,48,135,0.2) 0%, transparent 70%)', animation: 'glow 5s ease-in-out infinite' }} />

              {/* Sombra no chao */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-36 h-5 rounded-full blur-xl bg-black/25"
                style={{ transform: `translateX(${t.x}px)`, transition: 'transform 0.3s ease-out' }} />

              {/* Logo real com flutuacao */}
              <div style={{ animation: 'logoFloat 5s ease-in-out infinite' }}>
                <img src={logoSymbolDark} alt="UNIFEI"
                  className="relative z-10 w-48 h-48 object-contain"
                  style={{
                    transform: `translateZ(30px) translateX(${t.x}px) translateY(${t.y}px)`,
                    transition: 'transform 0.3s ease-out',
                    filter: 'drop-shadow(0 16px 32px rgba(0,0,0,0.4))',
                  }} draggable={false} />
              </div>
            </div>

            {/* Texto */}
            <div className="text-center max-w-lg" style={{ animation: mounted ? 'fadeUp 0.7s ease-out 0.5s both' : 'none' }}>
              <h1 className="text-white font-bold leading-[1.1] mb-4 tracking-tight"
                style={{ fontSize: 'clamp(30px, 3.2vw, 40px)' }}>
                Conectando mentes.
                <br />
                <span className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(135deg, #4B9CD3, #93C5E8)' }}>
                  Transformando Itajuba.
                </span>
              </h1>
              <p className="text-white/35 text-[15px] leading-relaxed max-w-md mx-auto">
                Forum academico por disciplina integrado com voluntariado universitario.
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-12 mt-10" style={{ animation: mounted ? 'fadeUp 0.7s ease-out 0.7s both' : 'none' }}>
              <Stat target={1200} suffix="+" label="Estudantes" delay={1000} />
              <div className="w-px h-8 bg-white/10" />
              <Stat target={350} suffix="+" label="Topicos" delay={1200} />
              <div className="w-px h-8 bg-white/10" />
              <Stat target={89} suffix="" label="Certificados" delay={1400} />
            </div>
          </div>

          {/* Rodape */}
          <div className="text-center" style={{ animation: mounted ? 'fadeIn 0.5s ease-out 1.2s both' : 'none' }}>
            <p className="text-white/15 text-xs tracking-wide">Universidade Federal de Itajuba — Ciencia da Computacao 2026</p>
          </div>
        </div>
      </div>

      {/* ============ PAINEL DIREITO (45%) ============ */}
      <div className="flex-1 flex items-center justify-center p-8 sm:p-12 relative overflow-y-auto"
        style={{ animation: mounted ? 'slideIn 0.5s ease-out 0.3s both' : 'none' }}>

        {/* Toggle tema */}
        <button onClick={toggleTheme}
          className="absolute top-6 right-6 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105"
          style={{ background: 'var(--bg-input)', border: '2px solid var(--border)', color: 'var(--text-secondary)' }}>
          {theme === 'light'
            ? <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>
            : <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.59１M5.25 １２H３m4.２２７-４．７７３L５．６３６ ５．６３６M１５．７５ １２a３．７５ ３．７５ ０ １１-７．５ ０ ３．７５ ３．７５ ０ ０１７．５ ０z" /></svg>
          }
        </button>

        {/* Logo mobile */}
        <div className="lg:hidden absolute top-6 left-6">
          <img src={theme === 'dark' ? logoFullDark : logoFullLight} alt="UNIFEI" className="h-8 object-contain" draggable={false} />
        </div>

        <div className="w-full max-w-[440px]">

          {/* ====== TELA: LOGIN ====== */}
          {mode === 'login' && (
            <div>
              {/* Header com tabs lado a lado */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Entrar</h2>
                </div>
                <button onClick={() => setMode('primeiro-acesso')}
                  className="text-[14px] font-medium px-10 py-5 rounded-xl transition-all duration-200 cursor-pointer"
                  style={{ background: 'rgba(0,48,135,0.06)', color: '#003087', border: '1px solid rgba(0,48,135,0.1)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,48,135,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,48,135,0.06)'}>
                  Primeiro acesso
                </button>
              </div>

              {/* Badge */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-6"
                style={{ background: 'rgba(0,48,135,0.04)', border: '1px solid rgba(0,48,135,0.08)' }}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#003087" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <span className="text-[13px]" style={{ color: '#0f141d' }}>Use suas credenciais do SIGAA</span>
              </div>

              {/* Campos */}
              <div className="space-y-9">
                <InputField label="CPF" placeholder="000.000.000-00" icon={UserIcon} />
                <InputField label="Senha do SIGAA" type={showPassword ? 'text' : 'password'} placeholder="Senha"
                  labelRight={<button className="text-[12px] cursor-pointer font-medium" style={{ color: '#003087' }}>Esqueceu a senha?</button>}
                  icon={LockIcon} rightElement={EyeToggle} />

                <button className="w-full py-10 rounded-xl text-[14px] font-semibold text-white transition-all duration-200 cursor-pointer hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #003087 0%, #001845 100%)', boxShadow: '0 4px 16px rgba(0,48,135,0.3)' }}>
                  Entrar
                  <svg className="w-10 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </button>
              </div>
            </div>
          )}

          {/* ====== TELA: PRIMEIRO ACESSO ====== */}
          {mode === 'primeiro-acesso' && (
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Primeiro acesso</h2>
                  <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>Vincule sua conta do SIGAA a plataforma</p>
                </div>
                <button onClick={() => setMode('login')}
                  className="text-[13px] font-medium px-4 py-2 rounded-lg transition-all duration-200 cursor-pointer"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#003087'; e.currentTarget.style.color = '#003087' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}>
                  Ja tenho conta
                </button>
              </div>

              {/* Passos */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: '#003087' }}>1</div>
                  <span className="text-[12px] font-medium" style={{ color: '#003087' }}>Dados do SIGAA</span>
                </div>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <div className="flex items-center gap-2 opacity-40">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: 'var(--border)', color: 'var(--text-tertiary)' }}>2</div>
                  <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>Verificacao</span>
                </div>
              </div>

              {/* Campos */}
              <div className="space-y-5">
                <InputField label="Email cadastrado no SIGAA" type="email" placeholder="seu.email@unifei.edu.br" icon={EmailIcon} />
                <InputField label="CPF" placeholder="000.000.000-00" icon={UserIcon} />
                <InputField label="Senha do SIGAA" type={showPassword ? 'text' : 'password'} placeholder="Sua senha do SIGAA"
                  icon={LockIcon} rightElement={EyeToggle} />

                <button onClick={() => setMode('codigo')}
                  className="w-full py-10 rounded-xl text-[14px] font-semibold text-white transition-all duration-200 cursor-pointer hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #003087 0%, #001845 100%)', boxShadow: '0 4px 16px rgba(0,48,135,0.3)' }}>
                  Continuar
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                </button>
              </div>
            </div>
          )}

          {/* ====== TELA: CODIGO DE VERIFICACAO ====== */}
          {mode === 'codigo' && (
            <div>
              <div className="mb-8">
                <button onClick={() => setMode('primeiro-acesso')}
                  className="flex items-center gap-1 text-[13px] mb-4 cursor-pointer transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#003087'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
                  Voltar
                </button>
                <h2 className="text-2xl font-bold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>Verifique seu email</h2>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Enviamos um codigo de 6 digitos para o email cadastrado no SIGAA. Insira o codigo abaixo para ativar sua conta.
                </p>
              </div>

              {/* Passos */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center gap-2 opacity-40">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                    style={{ background: 'rgba(0,48,135,0.15)', color: '#003087' }}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                  </div>
                  <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>Dados</span>
                </div>
                <div className="flex-1 h-px" style={{ background: '#003087', opacity: 0.2 }} />
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: '#003087' }}>2</div>
                  <span className="text-[12px] font-medium" style={{ color: '#003087' }}>Verificacao</span>
                </div>
              </div>

              {/* Input de codigo */}
              <div className="space-y-5">
                <div>
                  <label className="block text-[13px] font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Codigo de verificacao</label>
                  <div className="flex gap-3">
                    {[0,1,2,3,4,5].map(i => (
                      <input key={i} type="text" maxLength={1}
                        className="w-full aspect-square rounded-xl text-center text-xl font-bold outline-none transition-all duration-200"
                        style={{
                          background: 'var(--bg-input)',
                          border: '1.5px solid var(--border)',
                          color: 'var(--text-primary)',
                          maxWidth: '56px',
                        }}
                        onFocus={e => { e.target.style.borderColor = '#003087'; e.target.style.boxShadow = '0 0 0 3px rgba(0,48,135,0.08)' }}
                        onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                      />
                    ))}
                  </div>
                </div>

                <button className="w-full py-4 rounded-xl text-[14px] font-semibold text-white transition-all duration-200 cursor-pointer hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #003087 0%, #001845 100%)', boxShadow: '0 4px 16px rgba(0,48,135,0.3)' }}>
                  Ativar conta
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                </button>

                <p className="text-center text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                  Nao recebeu o codigo?{' '}
                  <button className="font-medium cursor-pointer" style={{ color: '#003087' }}>Reenviar</button>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
