import { useState, useEffect } from 'react'

interface BackgroundCarouselProps {
  /** Array de URLs das imagens */
  images: string[]
  /** Intervalo entre trocas em ms (padrao: 8000) */
  interval?: number
}

/**
 * Carrossel de imagens de fundo com crossfade suave.
 * Alterna entre as imagens automaticamente.
 *
 * Para ajustar a visibilidade da foto, modifique as classes
 * CSS em login.css:
 * - .login-hero__carousel-img { filter: brightness(X) }
 * - .login-hero__overlay { background: ... }
 */
export function BackgroundCarousel({
  images,
  interval = 8000,
}: BackgroundCarouselProps) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const timer = setInterval(
      () => setCurrent(c => (c + 1) % images.length),
      interval
    )
    return () => clearInterval(timer)
  }, [images.length, interval])

  return (
    <div className="absolute inset-0">
      {/* Imagens com crossfade */}
      {images.map((img, i) => (
        <img
          key={i}
          src={img}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[2000ms] login-hero__carousel-img"
          style={{ opacity: i === current ? 1 : 0 }}
        />
      ))}

      {/* Overlay gradiente sobre as fotos */}
      <div className="absolute inset-0 login-hero__overlay" />
    </div>
  )
}
