import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import { useAuth } from '../../contexts/AuthContext'
import { useMouseParallax } from '../../hooks/useMouseParallax'
import { login, register, activate, resendCode, getErrorMessage } from '../../services/auth'
import toast, { Toaster } from 'react-hot-toast'

import { InputField } from '../../components/ui/InputField'
import { GearShadow } from '../../components/ui/GearShadow'
import { Stat } from '../../components/ui/Stat'
import { BackgroundCarousel } from '../../components/layout/BackgroundCarousel'
import api from '../../services/api'

import {
  LockIcon, CpfIcon, EmailIcon, ShieldCheckIcon,
  ArrowRightIcon, ArrowLeftIcon, CheckIcon,
  SunIcon, MoonIcon, EyeIcon, EyeOffIcon,
} from '../../components/ui/Icons'

import logoSymbolDark from '../../assets/logo-unifei-symbol-dark.png'
import campusBg1 from '../../assets/campus-unifei.jpeg'
import campusBg2 from '../../assets/campus-unifei-entrada.jpg'

import '../../styles/login.css'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'primeiro-acesso' | 'codigo'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { isAuthenticated, fetchMe } = useAuth()
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)
  const [numeros, setNumeros] = useState({ estudantes: 0, topicos: 0, certificados: 0 })
  const parallaxRef = useRef<HTMLDivElement>(null)
  const t = useMouseParallax(parallaxRef, 7)

  /* Campos do formulario */
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState(['', '', '', '', '', ''])

  /* Redireciona se ja autenticado */
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 150)
    return () => clearTimeout(timer)
  }, [])

  /* Contagens da tela de entrada. Ficam em zero se a consulta falhar: a tela
     de login não pode deixar de abrir porque um número não chegou. */
  useEffect(() => {
    api.get('/auth/estatisticas/')
      .then(({ data }) => setNumeros(data))
      .catch(() => undefined)
  }, [])

  /* Formata CPF enquanto digita: 000.000.000-00 */
  function formatCpf(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
  }

  /* Extrai so os numeros do CPF formatado */
  function cpfDigits(formatted: string): string {
    return formatted.replace(/\D/g, '')
  }

  /* === HANDLERS === */

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const digits = cpfDigits(cpf)

    if (digits.length !== 11) {
      toast.error('CPF deve ter 11 dígitos.')
      return
    }
    if (!senha) {
      toast.error('Informe sua senha.')
      return
    }

    setLoading(true)
    try {
      const data = await login({ cpf: digits, password: senha })
      await fetchMe()
      toast.success('Login realizado com sucesso!')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    const digits = cpfDigits(cpf)

    if (!email || !digits || !senha) {
      toast.error('Preencha todos os campos.')
      return
    }
    if (digits.length !== 11) {
      toast.error('CPF deve ter 11 dígitos.')
      return
    }

    setLoading(true)
    try {
      await register({
        cpf: digits,
        email,
        nome_completo: nome || email.split('@')[0],
        password: senha,
      })
      toast.success('Código enviado para seu email!')
      setMode('codigo')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault()
    const codigoStr = codigo.join('')

    if (codigoStr.length !== 6) {
      toast.error('Insira o codigo completo de 6 digitos.')
      return
    }

    setLoading(true)
    try {
      const data = await activate({ email, codigo: codigoStr })
      await fetchMe()
      toast.success('Conta ativada com sucesso!')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleResendCode() {
    if (!email) {
      toast.error('Email nao encontrado. Volte ao passo anterior.')
      return
    }
    try {
      await resendCode(email)
      toast.success('Código reenviado!')
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  /* Handler dos inputs OTP: avanca automaticamente */
  function handleOtpChange(index: number, value: string) {
    if (value.length > 1) value = value[value.length - 1]
    if (value && !/^\d$/.test(value)) return

    const newCodigo = [...codigo]
    newCodigo[index] = value
    setCodigo(newCodigo)

    /* Avanca pro proximo campo */
    if (value && index < 5) {
      const next = document.querySelector<HTMLInputElement>(`input[data-otp="${index + 1}"]`)
      next?.focus()
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !codigo[index] && index > 0) {
      const prev = document.querySelector<HTMLInputElement>(`input[data-otp="${index - 1}"]`)
      prev?.focus()
    }
  }

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
      <Toaster position="top-right" toastOptions={{
        duration: 4000,
        style: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border)' },
      }} />

      {/* ============ PAINEL ESQUERDO (55%) ============ */}
      <div
        ref={parallaxRef}
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col cursor-default login-hero"
      >
        <BackgroundCarousel images={[campusBg1, campusBg2]} interval={8000} />

        <div className="relative z-10 flex flex-col h-full" style={{ padding: '40px' }}>
          {/* O arquivo do letreiro tem as letras cortadas nas bordas da própria
              imagem, e a marca aparecia como "UNIFE!". Até a assinatura oficial
              da SECOM entrar no projeto, o nome vai em texto. */}
          <div
            className="login-hero__logo-top"
            style={{
              animation: mounted ? 'fade-up 0.6s ease-out' : 'none',
              opacity: mounted ? 1 : 0,
              lineHeight: 1.2,
            }}
          >
            <div className="text-white font-bold" style={{ fontSize: '19px', letterSpacing: '0.09em' }}>
              UNIFEI
            </div>
            <div style={{
              fontSize: '9.5px', letterSpacing: '0.13em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)', marginTop: '2px',
            }}>
              Fórum acadêmico
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative login-hero__logo-3d" style={{
              marginBottom: '40px',
              animation: mounted ? 'logo-entry 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both' : 'none',
              transform: `perspective(800px) rotateX(${t.rx}deg) rotateY(${t.ry}deg)`,
            }}>
              <div className="absolute inset-0 flex items-center justify-center" style={{ transform: 'translateZ(-20px)' }}>
                <GearShadow size={280} speed={40} />
              </div>
              <div className="absolute rounded-full blur-3xl login-hero__glow"
                style={{ top: '-64px', right: '-64px', bottom: '-64px', left: '-64px' }} />
              <div className="absolute left-1/2 rounded-full blur-xl" style={{
                bottom: '-24px', width: '144px', height: '20px', background: 'rgba(0,0,0,0.25)',
                transform: `translateX(-50%) translateX(${t.x}px)`, transition: 'transform 0.3s ease-out',
              }} />
              <div style={{ animation: 'logo-float 5s ease-in-out infinite' }}>
                <img src={logoSymbolDark} alt="Símbolo da UNIFEI"
                  className="relative z-10 object-contain login-hero__logo-img"
                  style={{ width: '192px', height: '192px', transform: `translateZ(30px) translateX(${t.x}px) translateY(${t.y}px)` }}
                  draggable={false} />
              </div>
            </div>

            <div className="text-center" style={{ maxWidth: '32rem', animation: mounted ? 'fade-up 0.7s ease-out 0.5s both' : 'none' }}>
              <h1 className="text-white font-bold tracking-tight login-hero__title" style={{ lineHeight: '1.1', marginBottom: '16px' }}>
                Revelemo-nos, mais por atos do que por palavras,
                <br />
                {/* Sem quebra de linha dentro do span: o JSX transforma a
                    quebra em espaço, e a palavra aparecia partida como
                    "D ignos" na tela. */}
                <span className="bg-clip-text text-transparent login-hero__gradient-text">dignos de possuir este grande país</span>
              </h1>
              <p className="text-white/35 leading-relaxed" style={{ fontSize: '15px', maxWidth: '28rem', margin: '0 auto' }}>
                Fórum acadêmico por disciplina, integrado ao voluntariado universitário.
              </p>
            </div>

            <div className="flex items-center" style={{ gap: '48px', marginTop: '40px', animation: mounted ? 'fade-up 0.7s ease-out 0.7s both' : 'none' }}>
              {/* Contagens reais, vindas da API. Eram valores fixos escritos
                  no código — número inventado numa tela institucional não
                  sobrevive à primeira pergunta sobre de onde ele vem. */}
              <Stat target={numeros.estudantes} suffix="" label="Estudantes" delay={1000} />
              <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.1)' }} />
              <Stat target={numeros.topicos} suffix="" label="Tópicos" delay={1200} />
              <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.1)' }} />
              <Stat target={numeros.certificados} suffix="" label="Certificados" delay={1400} />
            </div>
          </div>

          <div className="text-center" style={{ animation: mounted ? 'fade-in 0.5s ease-out 1.2s both' : 'none' }}>
            <p className="text-white/15 tracking-wide" style={{ fontSize: '12px' }}>
              Universidade Federal de Itajubá — Ciência da Computação, 2026
            </p>
          </div>
        </div>
      </div>

      {/* ============ PAINEL DIREITO (45%) ============ */}
      <div className="flex-1 flex items-center justify-center relative overflow-y-auto"
        style={{ padding: '32px 48px', animation: mounted ? 'slide-in 0.5s ease-out 0.3s both' : 'none' }}>

        <button onClick={toggleTheme}
          className="absolute flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer login-form__toggle-theme"
          style={{ top: '24px', right: '24px', width: '40px', height: '40px' }}>
          {theme === 'light' ? MoonIcon : SunIcon}
        </button>

        <div className="lg:hidden absolute" style={{ top: '24px', left: '24px', lineHeight: 1.2 }}>
          <div className="font-bold" style={{
            fontSize: '17px', letterSpacing: '0.09em', color: 'var(--text-primary)',
          }}>
            UNIFEI
          </div>
          <div style={{
            fontSize: '9px', letterSpacing: '0.13em', textTransform: 'uppercase',
            color: 'var(--text-tertiary)', marginTop: '2px',
          }}>
            Fórum acadêmico
          </div>
        </div>

        <div style={{ width: '100%', maxWidth: '440px' }}>

          {/* ========== TELA: LOGIN ========== */}
          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
                <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Entrar</h2>
                <button type="button" onClick={() => setMode('primeiro-acesso')}
                  className="font-medium rounded-2xl transition-all duration-200 cursor-pointer login-form__btn-alt"
                  style={{ fontSize: '14px', padding: '2px 14px' }}>
                  Primeiro Acesso
                </button>
              </div>

              <div className="flex items-center rounded-xl login-form__badge" style={{ gap: '1px', padding: '2px 5px', marginBottom: '6px' }}>
                {ShieldCheckIcon}
                {/* O selo descrevia o login como se ele usasse a senha do
                    SIGAA. Não usa: o SIGAA entra uma única vez, no primeiro
                    acesso, para confirmar que a pessoa é da universidade. A
                    senha daqui é própria e fica só aqui. */}
                <span className="login-form__badge-text" style={{ fontSize: '13px' }}>
                  Acesso restrito à comunidade da UNIFEI
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <InputField label="CPF" placeholder="000.000.000-00" icon={CpfIcon}
                  value={cpf} onChange={(v) => setCpf(formatCpf(v))} />

                <InputField label="Senha" type={showPassword ? 'text' : 'password'} placeholder="Senha"
                  icon={LockIcon} rightElement={EyeToggle}
                  value={senha} onChange={setSenha}
                  labelRight={<button type="button" className="cursor-pointer font-medium login-form__link" style={{ fontSize: '13px' }}>Esqueceu a senha?</button>} />

                <button type="submit" disabled={loading}
                  className="w-full rounded-xl font-semibold text-white transition-all duration-200 cursor-pointer flex items-center justify-center login-form__btn-primary"
                  style={{ padding: '5px', fontSize: '14px', gap: '6px', marginTop: '6px', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Entrando...' : 'Entrar'}
                  {!loading && ArrowRightIcon}
                </button>
              </div>
            </form>
          )}

          {/* ========== TELA: PRIMEIRO ACESSO ========== */}
          {mode === 'primeiro-acesso' && (
            <form onSubmit={handleRegister}>
              <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
                <div>
                  <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Primeiro Acesso</h2>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Confirmamos seu vínculo pelo SIGAA e você cria sua senha
                  </p>
                </div>
                <button type="button" onClick={() => setMode('login')}
                  className="font-medium rounded-2xl transition-all duration-200 cursor-pointer login-form__btn-secondary"
                  style={{ fontSize: '13px', padding: '2px 12px' }}>
                  Já tenho conta
                </button>
              </div>

              <div className="flex items-center" style={{ gap: '12px', marginBottom: '10px' }}>
                <div className="flex items-center" style={{ gap: '8px' }}>
                  <div className="rounded-full flex items-center justify-center font-bold text-white login-steps__active"
                    style={{ width: '24px', height: '24px', fontSize: '11px' }}>1</div>
                  <span className="font-medium login-steps__label-active" style={{ fontSize: '13px' }}>Validação do vínculo</span>
                </div>
                <div className="flex-1" style={{ height: '1px', background: 'var(--border)' }} />
                <div className="flex items-center" style={{ gap: '2px', opacity: 0.4 }}>
                  <div className="rounded-full flex items-center justify-center font-bold login-steps__inactive"
                    style={{ width: '24px', height: '24px', fontSize: '11px' }}>2</div>
                  <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Verificação</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <InputField label="Email cadastrado no SIGAA" type="email" placeholder="seu.email@unifei.edu.br"
                  icon={EmailIcon} value={email} onChange={setEmail} />
                <InputField label="CPF" placeholder="000.000.000-00" icon={CpfIcon}
                  value={cpf} onChange={(v) => setCpf(formatCpf(v))} />
                {/* Esta é a senha que a pessoa passa a usar na plataforma. A
                    do SIGAA nunca é pedida nem armazenada aqui: o vínculo é
                    conferido pelo CPF e pelo email institucional. */}
                <InputField label="Crie uma senha para esta plataforma" type={showPassword ? 'text' : 'password'} placeholder="Mínimo de 8 caracteres"
                  icon={LockIcon} rightElement={EyeToggle}
                  value={senha} onChange={setSenha} />

                <button type="submit" disabled={loading}
                  className="w-full rounded-xl font-semibold text-white transition-all duration-200 cursor-pointer flex items-center justify-center login-form__btn-primary"
                  style={{ padding: '4px', fontSize: '14px', gap: '8px', marginTop: '8px', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Enviando...' : 'Continuar'}
                  {!loading && ArrowRightIcon}
                </button>
              </div>
            </form>
          )}

          {/* ========== TELA: CODIGO OTP ========== */}
          {mode === 'codigo' && (
            <form onSubmit={handleActivate}>
              <div style={{ marginBottom: '12px' }}>
                <button type="button" onClick={() => setMode('primeiro-acesso')}
                  className="flex items-center cursor-pointer transition-colors"
                  style={{ gap: '4px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  {ArrowLeftIcon} Voltar
                </button>
                <h2 className="font-bold tracking-tight" style={{ fontSize: '24px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Verifique seu email
                </h2>
                <p className="leading-relaxed" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Enviamos um código de 6 dígitos para <strong>{email}</strong>. Insira o código abaixo para ativar sua conta.
                </p>
              </div>

              <div className="flex items-center" style={{ gap: '12px', marginBottom: '24px' }}>
                <div className="flex items-center" style={{ gap: '8px', opacity: 0.4 }}>
                  <div className="rounded-full flex items-center justify-center font-bold login-steps__completed"
                    style={{ width: '24px', height: '24px', fontSize: '11px' }}>{CheckIcon}</div>
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Dados</span>
                </div>
                <div className="flex-1" style={{ height: '1px', background: 'rgba(0,48,135,0.2)' }} />
                <div className="flex items-center" style={{ gap: '8px' }}>
                  <div className="rounded-full flex items-center justify-center font-bold text-white login-steps__active"
                    style={{ width: '24px', height: '24px', fontSize: '11px' }}>2</div>
                  <span className="font-medium login-steps__label-active" style={{ fontSize: '12px' }}>Verificação</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="block font-medium" style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Código de verificação
                  </label>
                  <div className="flex" style={{ gap: '12px' }}>
                    {codigo.map((digit, i) => (
                      <input
                        key={i}
                        data-otp={i}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        className="w-full aspect-square rounded-xl text-center font-bold outline-none transition-all duration-200 login-otp__input"
                        style={{ fontSize: '20px', maxWidth: '56px' }}
                      />
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full rounded-xl font-semibold text-white transition-all duration-200 cursor-pointer flex items-center justify-center login-form__btn-primary"
                  style={{ padding: '4px', fontSize: '14px', gap: '8px', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Ativando...' : 'Ativar conta'}
                  {!loading && CheckIcon}
                </button>

                <p className="text-center" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Não recebeu o código?{' '}
                  <button type="button" onClick={handleResendCode}
                    className="font-medium cursor-pointer login-form__link-reenviar">Reenviar</button>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
