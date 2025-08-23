"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

const HeroImage = () => {
  const [scrollY, setScrollY] = useState(0)

  // Отслеживание скролла для эффекта параллакса
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Базовый фоновый слой (медленное движение) */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translateY(${scrollY * 0.3}px) scale(1.05)`,
          background: "linear-gradient(135deg, rgba(255,245,245,1) 0%, rgba(239,246,255,1) 100%)",
        }}
      />

      {/* Основное фоновое изображение */}
      <Image
        src="/hero.png"
        alt="Фоновое изображение каталога"
        fill
        priority
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          transform: `translateY(${scrollY * 0.15}px)`,
        }}
      />

      {/* Тонкая сетка (среднее движение) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translateY(${scrollY * 0.2}px)`,
          backgroundImage:
            "linear-gradient(rgba(15,23,42,0.10) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(15,23,42,0.10) 1px, transparent 1px)",
          backgroundSize: "32px 32px, 32px 32px",
          backgroundPosition: "-1px -1px, -1px -1px",
          opacity: 0.12,
        }}
      />

      {/* Акцентные мягкие радииальные градиенты (быстрое движение) */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translateY(${scrollY * 0.1}px)`,
          backgroundImage:
            "radial-gradient(800px 600px at 60% 40%, rgba(239, 68, 68, 0.14), transparent 60%)," +
            "radial-gradient(900px 700px at 30% 65%, rgba(37, 99, 235, 0.14), transparent 65%)",
        }}
      />

      {/* Дополнительные цветовые волны (самое быстрое движение) */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translateY(${scrollY * 0.06}px)`,
          backgroundImage:
            "radial-gradient(600px 450px at 85% 20%, rgba(255,255,255,0.25), transparent 55%)," +
            "radial-gradient(500px 400px at 15% 80%, rgba(255,255,255,0.20), transparent 60%)",
          filter: "blur(2px)",
        }}
      />
    </div>
  )
}

export default HeroImage