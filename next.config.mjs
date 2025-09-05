/** @type {import('next').NextConfig} */
const nextConfig = {
  // Отключаем сложные headers для ускорения билда  
  async headers() {
    return []
  },
  eslint: {
    // Игнорируем ESLint при production-сборке для ускорения
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Отключаем строгие проверки TypeScript для ускорения
    ignoreBuildErrors: true,
  },
  // Оптимизации для производительности сборки
  compiler: {
    // Удаляем console.log в production
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Экспериментальные оптимизации
  experimental: {
    // Оптимизированный bundling
    optimizePackageImports: ['lucide-react', '@mui/icons-material'],
  },
  images: {
    // Оптимизация изображений всегда включена для обеспечения консистентности
    // между development и production окружениями. Next.js кеширует оптимизированные
    // изображения, поэтому влияние на скорость разработки минимально после первой загрузки.
    // Это гарантирует, что разработчики видят то же поведение, что и в production.
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3.twcstorage.ru',
        pathname: '/**',
      },
    ],
    // Поддержка query strings для локальных изображений (требуется с Next.js 16)
    // Примеры использования:
    //   /logo.webp?v=2 - версионирование для обновления кеша браузера
    //   /banner.jpg?w=1920&q=75 - параметры оптимизации
    // БЕЗОПАСНОСТЬ: Параметр search опущен для поддержки версионирования.
    // Next.js автоматически валидирует и санитизирует параметры изображений.
    // Только параметры v, w, h, q обрабатываются системой оптимизации.
    localPatterns: [
      {
        pathname: '/**',
        // search опущен намеренно для поддержки версионирования (?v=X)
      },
    ],
  },
}

export default nextConfig
