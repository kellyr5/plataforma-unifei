import { useState, useEffect } from 'react'

/**
 * Hook que anima um numero de 0 ate o valor alvo.
 * Usa easing cubico para desaceleracao natural.
 *
 * @param target - Valor final da contagem
 * @param duration - Duracao da animacao em ms (padrao: 1200)
 * @param delay - Atraso antes de iniciar em ms (padrao: 800)
 *
 * @example
 * const count = useCountUp(1200, 1200, 900)
 * <span>{count}+</span>
 */
export function useCountUp(
  target: number,
  duration = 1200,
  delay = 800
) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = Date.now()

      const tick = () => {
        const elapsed = Date.now() - start
        const progress = Math.min(elapsed / duration, 1)
        /* Easing: ease-out cubico */
        const eased = 1 - Math.pow(1 - progress, 3)

        setValue(Math.round(eased * target))

        if (progress < 1) {
          requestAnimationFrame(tick)
        }
      }

      requestAnimationFrame(tick)
    }, delay)

    return () => clearTimeout(timeout)
  }, [target, duration, delay])

  return value
}
