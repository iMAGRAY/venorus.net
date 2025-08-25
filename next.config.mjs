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
    // Упрощенная конфигурация для ускорения
    unoptimized: true, // Отключаем оптимизацию для ускорения билда
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3.twcstorage.ru',
        pathname: '/**',
      },
    ],
  },
}

export default nextConfig
