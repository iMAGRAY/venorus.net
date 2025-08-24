/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ]
  },
  eslint: {
    // Игнорируем ESLint при production-сборке (решает проблему "Failed to load config \"next/core-web-vitals\"")
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Включаем TypeScript проверки при сборке для предотвращения ошибок типов
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3.twcstorage.ru',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 's3.example.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
    // Включаем оптимизацию изображений для производительности
    unoptimized: false,
    // Современные форматы для лучшего сжатия
    formats: ['image/webp', 'image/avif'],
    // Правильное кеширование - 1 час
    minimumCacheTTL: 3600,
    // Адаптивные размеры для разных устройств
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Убираем опасное разрешение SVG для повышения безопасности
    dangerouslyAllowSVG: false,
    // Улучшаем CSP для защиты от XSS
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; object-src 'none'; sandbox;",
  },
}

export default nextConfig
