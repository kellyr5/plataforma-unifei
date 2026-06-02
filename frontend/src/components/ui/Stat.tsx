import { useCountUp } from '../../hooks/useCountUp'

interface StatProps {
  /** Valor numerico final */
  target: number
  /** Sufixo apos o numero (ex: "+") */
  suffix: string
  /** Texto descritivo abaixo do numero */
  label: string
  /** Atraso antes de iniciar a contagem em ms */
  delay: number
}

/**
 * Card de estatistica com contagem animada (count-up).
 * Usado no painel esquerdo da tela de login.
 */
export function Stat({ target, suffix, label, delay }: StatProps) {
  const value = useCountUp(target, 1200, delay)

  return (
    <div className="text-center">
      <div className="text-white font-bold text-2xl tracking-tight">
        {value}{suffix}
      </div>
      <div className="text-white/30 text-[11px] mt-1 tracking-widest uppercase">
        {label}
      </div>
    </div>
  )
}
