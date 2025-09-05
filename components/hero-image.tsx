"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Image from "next/image"

const HeroImage = () => {
  const [scrollY, setScrollY] = useState(0)
  const ticking = useRef(false)

  // Дебаунсинг для скролла через requestAnimationFrame
  const updateScrollY = useCallback(() => {
    setScrollY(window.scrollY)
    ticking.current = false
  }, [])

  const handleScroll = useCallback(() => {
    if (!ticking.current) {
      requestAnimationFrame(updateScrollY)
      ticking.current = true
    }
  }, [updateScrollY])

  // Отслеживание скролла для эффекта параллакса с дебаунсингом
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (ticking.current) {
        ticking.current = false
      }
    }
  }, [handleScroll])

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Минималистичный градиентный фон */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-background/40 via-muted/20 to-background/30"
        style={{
          transform: `translateY(${scrollY * 0.2}px)`,
        }}
      />

      {/* Основное фоновое изображение с современной обработкой */}
      <Image
        src="/hero-main.png"
        alt="Фоновое изображение каталога"
        fill
        priority
        className="absolute inset-0 w-full h-full object-cover opacity-60"
        style={{
          transform: `translateY(${scrollY * 0.1}px)`,
          filter: "blur(0.5px) saturate(0.8)",
        }}
      />

      {/* Тонкий геометрический паттерн */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          transform: `translateY(${scrollY * 0.15}px)`,
          backgroundImage:
            "linear-gradient(hsl(var(--muted-foreground)) 1px, transparent 1px)," +
            "linear-gradient(90deg, hsl(var(--muted-foreground)) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Мягкий акцентный градиент */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          transform: `translateY(${scrollY * 0.05}px)`,
          background:
            "radial-gradient(800px 600px at 60% 40%, hsl(var(--primary) / 0.1), transparent 70%)",
        }}
      />
      
      {/* Темный градиент для улучшения читаемости текста */}
      <div 
        className="absolute inset-0 bg-gradient-to-r from-background/60 via-background/30 to-transparent"
        style={{
          transform: `translateY(${scrollY * 0.08}px)`,
        }}
      />
    </div>
  )
}

export default HeroImage