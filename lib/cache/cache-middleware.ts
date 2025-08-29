import { NextRequest, NextResponse } from 'next/server'
import { CACHE_TTL } from './cache-utils'
import { logger } from '@/lib/logger'
import crypto from 'crypto'
import { unifiedCache, CACHE_TAGS } from './unified-cache'
import { APP_CONFIG } from '@/lib/app-config'

// Конфигурация кеширования для разных роутов с тегами
const CACHE_CONFIG: Record<string, { ttl: number; methods: string[]; tags?: string[] }> = {
  // Продукты - кешируем GET запросы с тегами
  '/api/products': { 
    ttl: APP_CONFIG.CACHE.TTL.MEDIUM * 1000, 
    methods: ['GET'],
    tags: [CACHE_TAGS.PRODUCTS]
  },
  '/api/products/[id]': { 
    ttl: APP_CONFIG.CACHE.TTL.LONG * 1000, 
    methods: ['GET'],
    tags: [CACHE_TAGS.PRODUCTS]
  },
  '/api/products/[id]/characteristics': { 
    ttl: APP_CONFIG.CACHE.TTL.LONG * 1000, 
    methods: ['GET'],
    tags: [CACHE_TAGS.PRODUCTS]
  },
  '/api/products/[id]/variants': { 
    ttl: APP_CONFIG.CACHE.TTL.LONG * 1000, 
    methods: ['GET'],
    tags: [CACHE_TAGS.PRODUCTS]
  },
  
  // Категории - кешируем надолго с тегами
  '/api/categories': { 
    ttl: APP_CONFIG.CACHE.TTL.DAILY * 1000, 
    methods: ['GET'],
    tags: [CACHE_TAGS.CATEGORIES]
  },
  '/api/categories/[id]': { 
    ttl: APP_CONFIG.CACHE.TTL.DAILY * 1000, 
    methods: ['GET'],
    tags: [CACHE_TAGS.CATEGORIES]
  },
  '/api/categories/tree': { 
    ttl: APP_CONFIG.CACHE.TTL.DAILY * 1000, 
    methods: ['GET'],
    tags: [CACHE_TAGS.CATEGORIES]
  },
  
  // Характеристики
  '/api/characteristics': { 
    ttl: APP_CONFIG.CACHE.TTL.LONG * 1000, 
    methods: ['GET'],
    tags: [CACHE_TAGS.PRODUCTS]
  },
  '/api/characteristics/by-category': { 
    ttl: APP_CONFIG.CACHE.TTL.LONG * 1000, 
    methods: ['GET'],
    tags: [CACHE_TAGS.CATEGORIES]
  },
  '/api/characteristic-groups': { 
    ttl: APP_CONFIG.CACHE.TTL.DAILY * 1000, 
    methods: ['GET'],
    tags: [CACHE_TAGS.PRODUCTS]
  },
  
  // Медиа
  '/api/media/[id]': { 
    ttl: APP_CONFIG.CACHE.TTL.WEEKLY * 1000, 
    methods: ['GET'],
    tags: [CACHE_TAGS.MEDIA]
  },
  '/api/product-images': { 
    ttl: APP_CONFIG.CACHE.TTL.LONG * 1000, 
    methods: ['GET'],
    tags: [CACHE_TAGS.MEDIA, CACHE_TAGS.PRODUCTS]
  },
  
  // Поиск - короткий кеш
  '/api/search': { 
    ttl: APP_CONFIG.CACHE.TTL.SHORT * 1000, 
    methods: ['GET'],
    tags: [CACHE_TAGS.PRODUCTS]
  },
  
  // Настройки
  '/api/site-settings': {
    ttl: APP_CONFIG.CACHE.TTL.LONG * 1000,
    methods: ['GET'],
    tags: [CACHE_TAGS.SETTINGS]
  },
  
  // Производители
  '/api/manufacturers': {
    ttl: APP_CONFIG.CACHE.TTL.DAILY * 1000,
    methods: ['GET'],
    tags: [CACHE_TAGS.MANUFACTURERS]
  }
}

// Роуты, которые не нужно кешировать
const SKIP_CACHE_ROUTES = [
  '/api/auth',
  '/api/admin',
  '/api/cart',
  '/api/orders',
  '/api/user',
  '/api/redis-status',
  '/api/cleanup',
]

// Генерация ключа кеша из запроса
function generateCacheKey(request: NextRequest): string {
  const url = new URL(request.url)
  const pathname = url.pathname
  const searchParams = url.searchParams.toString()
  const method = request.method
  
  // Создаем уникальный ключ на основе URL и параметров
  const keyData = `${method}:${pathname}:${searchParams}`
  const hash = crypto.createHash('md5').update(keyData).digest('hex')
  
  return `api:${pathname.replace(/^\/api\//, '')}:${hash}`
}

// Проверка, нужно ли кешировать этот роут
function shouldCache(pathname: string, method: string): { cache: boolean; config?: typeof CACHE_CONFIG[string] } {
  // Проверяем skip-список
  if (SKIP_CACHE_ROUTES.some(route => pathname.startsWith(route))) {
    return { cache: false }
  }
  
  // Проверяем конфигурацию кеша
  for (const [route, config] of Object.entries(CACHE_CONFIG)) {
    // Простое сопоставление роутов (можно улучшить с помощью path-to-regexp)
    const routePattern = route.replace(/\[([^\]]+)\]/g, '([^/]+)')
    const regex = new RegExp(`^${routePattern}$`)
    
    if (regex.test(pathname) && config.methods.includes(method)) {
      return { cache: true, config }
    }
  }
  
  return { cache: false }
}

// Проверка необходимости пропустить кеш
function shouldSkipCache(url: URL): boolean {
  return url.searchParams.get('nocache') === 'true'
}

// Определение конфигурации кеша для запроса
function getCacheConfig(
  pathname: string,
  method: string,
  customTtl?: number
): { cache: boolean; config?: { ttl: number; methods: string[]; tags?: string[] } } {
  if (customTtl) {
    return { cache: true, config: { ttl: customTtl, methods: ['GET'] } }
  }
  
  return shouldCache(pathname, method)
}

// Middleware для кеширования API
export async function cacheMiddleware(
  request: NextRequest,
  handler: () => Promise<NextResponse>,
  customTtl?: number
): Promise<NextResponse> {
  const url = new URL(request.url)
  const pathname = url.pathname
  const method = request.method
  
  // Проверяем необходимость пропустить кеш
  if (shouldSkipCache(url)) {
    return handler()
  }
  
  // Получаем конфигурацию кеша
  const { cache, config } = getCacheConfig(pathname, method, customTtl)
  
  if (!cache || !config) {
    return handler()
  }
  
  const cacheKey = generateCacheKey(request)
  
  // Пробуем получить из кеша используя унифицированную систему
  try {
    const cachedData = await unifiedCache.get<{ data: any; headers: Record<string, string> }>(cacheKey)
    if (cachedData) {
      logger.debug(`API Cache hit: ${pathname}`)
      const response = NextResponse.json(cachedData.data)
      
      // Восстанавливаем заголовки
      Object.entries(cachedData.headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
      
      response.headers.set('X-Cache', 'HIT')
      response.headers.set('X-Cache-TTL', config.ttl.toString())
      return response
    }
  } catch (error) {
    logger.error('Cache middleware get error:', error)
    // Продолжаем без кеша при ошибке
  }
  
  // Выполняем обработчик
  const response = await handler()
  
  // Сохраняем в кеш используя унифицированную систему
  if (response.status === 200) {
    try {
      const responseClone = response.clone()
      const data = await responseClone.json()
      
      // Сохраняем важные заголовки
      const headers: Record<string, string> = {}
      const headersToCache = ['content-type', 'cache-control', 'etag']
      headersToCache.forEach(header => {
        const value = response.headers.get(header)
        if (value) headers[header] = value
      })
      
      // Сохраняем в унифицированный кеш с тегами
      await unifiedCache.set(
        cacheKey, 
        { data, headers },
        { ttl: config.ttl, tags: config.tags }
      )
      
      logger.debug(`API Cache set: ${pathname}, TTL: ${config.ttl}ms, tags: ${config.tags?.join(',')}`)
      
      response.headers.set('X-Cache', 'MISS')
      response.headers.set('X-Cache-TTL', config.ttl.toString())
    } catch (error) {
      logger.error('Cache middleware set error:', error)
      // Игнорируем ошибки кеша, не блокируем ответ
    }
  }
  
  return response
}

// Функция для обертывания API handlers
export function withCache<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  ttl?: number
): T {
  return (async (...args: Parameters<T>) => {
    const request = args[0] as NextRequest
    
    // Передаем кастомный TTL в middleware без мутации глобального конфига
    return cacheMiddleware(request, () => handler(...args), ttl)
  }) as T
}

// Hook для инвалидации кеша при мутациях используя теги
export async function invalidateApiCache(tags: string[]) {
  try {
    const invalidated = await unifiedCache.invalidateByTags(tags)
    logger.info('Cache invalidation complete', { tags, invalidated })
    return invalidated
  } catch (error) {
    logger.error('Cache invalidation error:', { tags, error })
    return 0
  }
}

// Утилиты для инвалидации по сущностям
export const invalidateCache = {
  products: () => invalidateApiCache([CACHE_TAGS.PRODUCTS]),
  categories: () => invalidateApiCache([CACHE_TAGS.CATEGORIES]),
  manufacturers: () => invalidateApiCache([CACHE_TAGS.MANUFACTURERS]),
  media: () => invalidateApiCache([CACHE_TAGS.MEDIA]),
  settings: () => invalidateApiCache([CACHE_TAGS.SETTINGS]),
  all: () => unifiedCache.clear()
}