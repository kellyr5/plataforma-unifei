interface GearShadowProps {
  /** Tamanho em pixels */
  size: number
  /** Velocidade de rotacao em segundos (maior = mais lento) */
  speed: number
}

/**
 * Engrenagem SVG com dentes trapezoidais que gira continuamente.
 * Usada como sombra/decoracao atras do logo da UNIFEI.
 *
 * Os dentes seguem o padrao trapezoidal do brasao da UNIFEI
 * (dentes largos com vales entre eles).
 */
export function GearShadow({ size, speed }: GearShadowProps) {
  const teeth = 10
  const outerR = 48
  const midR = 42
  const innerR = 36

  let d = 'M'
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2
    const a1 = ((i + 0.15) / teeth) * Math.PI * 2
    const a2 = ((i + 0.35) / teeth) * Math.PI * 2
    const a3 = ((i + 0.5) / teeth) * Math.PI * 2
    const a4 = ((i + 0.65) / teeth) * Math.PI * 2
    const a5 = ((i + 0.85) / teeth) * Math.PI * 2

    /* Dente trapezoidal */
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
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="absolute"
      style={{ animation: `gear-spin ${speed}s linear infinite` }}
    >
      <path
        d={d}
        fill="rgba(255,255,255,0.07)"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="0.5"
      />
      <circle cx="50" cy="50" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="12" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
    </svg>
  )
}
