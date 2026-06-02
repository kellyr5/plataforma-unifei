import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { useMouseParallax } from '../../hooks/useMouseParallax'

import { InputField } from '../../components/ui/InputField'
import { GearShadow } from '../../components/ui/GearShadow'
import { Stat } from '../../components/ui/Stat'
import { BackgroundCarousel } from '../../components/layout/BackgroundCarousel'

import {
  LockIcon, CpfIcon, EmailIcon, ShieldCheckIcon,
  ArrowRightIcon, ArrowLeftIcon, CheckIcon,
  SunIcon, MoonIcon, EyeIcon, EyeOffIcon,
} from '../../components/ui/Icons'

import logoSymbolDark from '../../assets/logo-unifei-symbol-dark.png'
import logoFullDark from '../../assets/logo-unifei-full-dark.png'
import logoFullLight from '../../assets/logo-unifei-full-light.png'
import campusBg1 from '../../assets/campus-unifei.jpeg'
import campusBg2 from '../../assets/campus-unifei-entrada.jpg'

import '../../styles/login.css'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'primeiro-acesso' | 'codigo'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const parallaxRef = useRef<HTMLDivElement>(null)
  const t = useMouseParallax(parallaxRef, 7)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 150)
    return () => clearTimeout(timer)
  }, [])

  const EyeToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(!showPassword)}
      className="cursor-pointer transition-colors flex-shrink-0"
      style={{ padding: '4px', color: 'var(--text-tertiary)' }}
    >
      {showPassword ? EyeOffIcon : EyeIcon}
    </button>
  )

  return (
    <div className="login-page">

      {/* ============ PAINEL ESQUERDO (55%) ============ */}
      <div
        ref={parallaxRef}
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col cursor-default login-hero"
      >
        <BackgroundCarousel images={[campusBg1, campusBg2]} interval={8000} />

        <div className="relative z-10 flex flex-col h-full" style={{ padding: '40px' }}>

          <div style={{ animation: mounted ? 'fade-up 0.6s ease-out' : 'none', opacity: mounted ? 1 : 0 }}>
            <img
              src={logoFullDark}
              alt="UNIFEI"
              className="object-contain drop-shadow-lg login-hero__logo-top"
              style={{ height: '40px' }}
              draggable={false}
            />
          </div>

          <div className="flex-1 flex flex-col items-center justify-center">

            <div
              className="relative login-hero__logo-3d"
              style={{
                marginBottom: '40px',
                animation: mounted ? 'logo-entry 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both' : 'none',
                transform: `perspective(800px) rotateX(${t.rx}deg) rotateY(${t.ry}deg)`,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center" style={{ transform: 'translateZ(-20px)' }}>
                <GearShadow size={280} speed={40} />
              </div>

              <div className="absolute rounded-full blur-3xl login-hero__glow"
                style={{ top: '-64px', right: '-64px', bottom: '-64px', left: '-64px' }} />

              <div
                className="absolute left-1/2 rounded-full blur-xl"
                style={{
                  bottom: '-24px', width: '144px', height: '20px',
                  background: 'rgba(0,0,0,0.25)',
                  transform: `translateX(-50%) translateX(${t.x}px)`,
                  transition: 'transform 0.3s ease-out',
                }}
              />

              <div style={{ animation: 'logo-float 5s ease-in-out infinite' }}>
                <img
                  src={logoSymbolDark}
                  alt="Simbolo UNIFEI"
                  className="relative z-10 object-contain login-hero__logo-img"
                  style={{
                    width: '192px', height: '192px',
                    transform: `translateZ(30px) translateX(${t.x}px) translateY(${t.y}px)`,
                  }}
                  draggable={false}
                />
              </div>
            </div>

            <div className="text-center" style={{ maxWidth: '32rem', animation: mounted ? 'fade-up 0.7s ease-out 0.5s both' : 'none' }}>
              <h1 className="text-white font-bold tracking-tight login-hero__title" style={{ lineHeight: '1.1', marginBottom: '16px' }}>
                Conectando mentes.
                <br />
                <span className="bg-clip-text text-transparent login-hero__gradient-text">
                  Transformando Itajuba.
                </span>
              </h1>
              <p className="text-white/35 leading-relaxed" style={{ fontSize: '15px', maxWidth: '28rem', margin: '0 auto' }}>
                Forum academico por disciplina integrado com voluntariado universitario.
              </p>
            </div>

            <div
              className="flex items-center"
              style={{ gap: '48px', marginTop: '40px', animation: mounted ? 'fade-up 0.7s ease-out 0.7s both' : 'none' }}
            >
              <Stat target={1200} suffix="+" label="Estudantes" delay={1000} />
              <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.1)' }} />
              <Stat target={350} suffix="+" label="Topicos" delay={1200} />
              <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.1)' }} />
              <Stat target={89} suffix="" label="Certificados" delay={1400} />
            </div>
          </div>

          <div className="text-center" style={{ animation: mounted ? 'fade-in 0.5s ease-out 1.2s both' : 'none' }}>
            <p className="text-white/15 tracking-wide" style={{ fontSize: '12px' }}>
              Universidade Federal de Itajuba — Ciencia da Computacao 2026
            </p>
          </div>
        </div>
      </div>

      {/* ============ PAINEL DIREITO (45%) ============ */}
      <div
        className="flex-1 flex items-center justify-center relative overflow-y-auto"
        style={{ padding: '32px 48px', animation: mounted ? 'slide-in 0.5s ease-out 0.3s both' : 'none' }}
      >
        <button
          onClick={toggleTheme}
          className="absolute flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer login-form__toggle-theme"
          style={{ top: '24px', right: '24px', width: '40px', height: '40px' }}
        >
          {theme === 'light' ? MoonIcon : SunIcon}
        </button>

        <div className="lg:hidden absolute" style={{ top: '24px', left: '24px' }}>
          <img
            src={theme === 'dark' ? logoFullDark : logoFullLight}
            alt="UNIFEI"
            className="object-contain"
            style={{ height: '32px' }}
            draggable={false}
          />
        </div>

        <div style={{ width: '100%', maxWidth: '440px' }}>

          {/* ========== TELA: LOGIN ========== */}
          {mode === 'login' && (
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
                <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  Entrar
                </h2>
                <button
                  onClick={() => setMode('primeiro-acesso')}
                  className="font-medium rounded-2xl transition-all duration-200 cursor-pointer login-form__btn-alt"
                  style={{ fontSize: '14px', padding: '2px 14px' }}
                >
                  Primeiro Acesso
                </button>
              </div>

              <div className="flex items-center rounded-xl login-form__badge" style={{ gap: '1px', padding: '2px 5px', marginBottom: '6px' }}>
                {ShieldCheckIcon}
                <span className="login-form__badge-text" style={{ fontSize: '13px' }}>
                  Use suas credenciais do SIGAA
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <InputField label="CPF" placeholder="000.000.000-00" icon={CpfIcon} />

                <InputField
                  label="Senha do SIGAA"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Senha"
                  icon={LockIcon}
                  rightElement={EyeToggle}
                  labelRight={
                    <button className="cursor-pointer font-medium login-form__link" style={{ fontSize: '13px' }}>
                      Esqueceu a senha?
                    </button>
                  }
                />

                <button
                  className="w-full rounded-xl font-semibold text-white transition-all duration-200 cursor-pointer flex items-center justify-center login-form__btn-primary"
                  style={{ padding: '5px', fontSize: '14px', gap: '6px', marginTop: '6px' }}
                >
                  Entrar
                  {ArrowRightIcon}
                </button>
              </div>
            </div>
          )}

          {/* ========== TELA: PRIMEIRO ACESSO ========== */}
          {mode === 'primeiro-acesso' && (
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
                <div>
                  <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Primeiro Acesso
                  </h2>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Vincule sua conta do SIGAA a plataforma
                  </p>
                </div>
                <button
                  onClick={() => setMode('login')}
                  className="font-medium rounded-2xl transition-all duration-200 cursor-pointer login-form__btn-secondary"
                  style={{ fontSize: '13px', padding: '2px 12px' }}
                >
                  Já tenho conta
                </button>
              </div>

              <div className="flex items-center" style={{ gap: '12px', marginBottom: '10px' }}>
                <div className="flex items-center" style={{ gap: '8px' }}>
                  <div
                    className="rounded-full flex items-center justify-center font-bold text-white login-steps__active"
                    style={{ width: '24px', height: '24px', fontSize: '11px' }}
                  >1</div>
                  <span className="font-medium login-steps__label-active" style={{ fontSize: '13px' }}>Dados do SIGAA</span>
                </div>
                <div className="flex-1" style={{ height: '1px', background: 'var(--border)' }} />
                <div className="flex items-center" style={{ gap: '2px', opacity: 0.4 }}>
                  <div
                    className="rounded-full flex items-center justify-center font-bold login-steps__inactive"
                    style={{ width: '24px', height: '24px', fontSize: '11px' }}
                  >2</div>
                  <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Verificacao</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <InputField label="Email cadastrado no SIGAA" type="email" placeholder="seu.email@unifei.edu.br" icon={EmailIcon} />
                <InputField label="CPF" placeholder="000.000.000-00" icon={CpfIcon} />
                <InputField
                  label="Senha do SIGAA"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Sua senha do SIGAA"
                  icon={LockIcon}
                  rightElement={EyeToggle}
                />

                <button
                  onClick={() => setMode('codigo')}
                  className="w-full rounded-xl font-semibold text-white transition-all duration-200 cursor-pointer flex items-center justify-center login-form__btn-primary"
                  style={{ padding: '4px', fontSize: '14px', gap: '8px', marginTop: '8px' }}
                >
                  Continuar
                  {ArrowRightIcon}
                </button>
              </div>
            </div>
          )}

          {/* ========== TELA: CODIGO OTP ========== */}
          {mode === 'codigo' && (
            <div>
              <div style={{ marginBottom: '12px' }}>
                <button
                  onClick={() => setMode('primeiro-acesso')}
                  className="flex items-center cursor-pointer transition-colors"
                  style={{ gap: '4px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}
                >
                  {ArrowLeftIcon}
                  Voltar
                </button>
                <h2 className="font-bold tracking-tight" style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Verifique seu email
                </h2>
                <p className="leading-relaxed" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Enviamos um código de 6 dígitos para o email cadastrado no SIGAA.
                  Insira o código abaixo para ativar sua conta.
                </p>
              </div>

              <div className="flex items-center" style={{ gap: '12px', marginBottom: '24px' }}>
                <div className="flex items-center" style={{ gap: '8px', opacity: 0.4 }}>
                  <div
                    className="rounded-full flex items-center justify-center font-bold login-steps__completed"
                    style={{ width: '24px', height: '24px', fontSize: '11px' }}
                  >{CheckIcon}</div>
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Dados</span>
                </div>
                <div className="flex-1" style={{ height: '1px', background: 'rgba(0,48,135,0.2)' }} />
                <div className="flex items-center" style={{ gap: '8px' }}>
                  <div
                    className="rounded-full flex items-center justify-center font-bold text-white login-steps__active"
                    style={{ width: '24px', height: '24px', fontSize: '11px' }}
                  >2</div>
                  <span className="font-medium login-steps__label-active" style={{ fontSize: '12px' }}>Verificacao</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="block font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Codigo de verificacao
                  </label>
                  <div className="flex" style={{ gap: '12px' }}>
                    {[0, 1, 2, 3, 4, 5].map(i => (
                      <input
                        key={i}
                        type="text"
                        maxLength={1}
                        className="w-full aspect-square rounded-xl text-center font-bold outline-none transition-all duration-200 login-otp__input"
                        style={{ fontSize: '20px', maxWidth: '56px' }}
                      />
                    ))}
                  </div>
                </div>

                <button
                  className="w-full rounded-xl font-semibold text-white transition-all duration-200 cursor-pointer flex items-center justify-center login-form__btn-primary"
                  style={{ padding: '4px', fontSize: '14px', gap: '8px' }}
                >
                  Ativar conta
                  {CheckIcon}
                </button>

                <p className="text-center" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Nao recebeu o codigo?{' '}
                  <button className="font-medium cursor-pointer login-form__link-reenviar">
                    Reenviar
                  </button>
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
