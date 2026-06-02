import { useState, useEffect, useCallback } from 'react'

/**
 * Hook que rastreia a posicao do mouse e calcula rotacao 3D
 * para efeito de perspectiva/parallax.
 *
 * Usa requestAnimationFrame para manter 60fps.
 *
 * @param ref - Referencia ao elemento container
 * @param intensity - Intensidade da rotacao (padrao: 6)
 *
 * @example
 * const ref = useRef<HTMLDivElement>(null)
 * const { rx, ry, x, y } = useMouseParallax(ref, 8)
 *
 * <div ref={ref}>
 *   <img style={{ transform: `rotateX(${rx}deg) rotateY(${ry}deg)` }} />
 * </div>
 */
export function useMouseParallax(
  ref: React.RefObject<HTMLDivElement | null>,
  intensity = 6
) {
  const [transform, setTransform] = useState({ rx: 0, ry: 0, x: 0, y: 0 })

  const handleMove = useCallback((e: MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2)
    const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2)

    requestAnimationFrame(() => {
      setTransform({
        rx: -y * intensity,
        ry: x * intensity,
        x: x * 5,
        y: y * 5,
      })
    })
  }, [ref, intensity])

  const handleLeave = useCallback(() => {
    setTransform({ rx: 0, ry: 0, x: 0, y: 0 })
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    el.addEventListener('mousemove', handleMove)
    el.addEventListener('mouseleave', handleLeave)

    return () => {
      el.removeEventListener('mousemove', handleMove)
      el.removeEventListener('mouseleave', handleLeave)
    }
  }, [ref, handleMove, handleLeave])

  return transform
}
