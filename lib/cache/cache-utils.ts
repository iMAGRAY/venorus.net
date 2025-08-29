import { unifiedCache } from './unified-cache'
import { logger } from '@/lib/logger'

// Время жизни кеша в секундах - ОПТИМИЗИРОВАНО для лучшей производительности
export const CACHE_TTL = {
  SHORT: 600,      // 10 минут - увеличено для лучшего hit rate
  MEDIUM: 3600,    // 1 час - увеличено для лучшей производительности
  LONG: 7200,      // 2 часа - увеличено для редко меняющихся данных
  DAILY: 86400,    // 24 часа - для статичных данных
  WEEKLY: 604800,  // 7 дней - для очень статичных данных
}

// Версия кеша для инвалидации при изменении структуры
const CACHE_VERSION = 'v5' // Changed to v5 to clear all cached data

// Генерация ключей кеша
export const cacheKeys = {
  // Продукты
  product: (id: number) => `product:${CACHE_VERSION}:${id}`,
  productList: (params: any) => `products:${CACHE_VERSION}:${JSON.stringify(params)}`,
  productVariants: (productId: number) => `product-variants:${CACHE_VERSION}:${productId}`,
  productCharacteristics: (productId: number) => `product-chars:${CACHE_VERSION}:${productId}`,
  productImages: (productId: number) => `product-images:${CACHE_VERSION}:${productId}`,
  
  // Категории
  category: (id: number) => `category:${CACHE_VERSION}:${id}`,
  categoryList: () => `categories:${CACHE_VERSION}:all`,
  categoryTree: () => `categories:${CACHE_VERSION}:tree`,
  categoryProducts: (categoryId: number, page: number = 1) => `category-products:${CACHE_VERSION}:${categoryId}:${page}`,
  
  // Характеристики
  characteristics: () => `characteristics:${CACHE_VERSION}:all`,
  characteristicsByCategory: (categoryId: number) => `characteristics:${CACHE_VERSION}:category:${categoryId}`,
  characteristicGroups: () => `characteristic-groups:${CACHE_VERSION}:all`,
  
  // Страницы
  homePage: () => `page:${CACHE_VERSION}:home`,
  productPage: (id: number) => `page:${CACHE_VERSION}:product:${id}`,
  categoryPage: (id: number, page: number = 1) => `page:${CACHE_VERSION}:category:${id}:${page}`,
  
  // Медиа
  mediaFile: (id: number) => `media:${CACHE_VERSION}:${id}`,
  mediaUrl: (url: string) => `media:${CACHE_VERSION}:url:${Buffer.from(url).toString('base64')}`,
  
  // Поиск
  searchResults: (query: string, page: number = 1) => `search:${CACHE_VERSION}:${query}:${page}`,
  
  // Статистика
  productStats: (id: number) => `stats:${CACHE_VERSION}:product:${id}`,
  categoryStats: (id: number) => `stats:${CACHE_VERSION}:category:${id}`,
}

// Паттерны для инвалидации кеша
export const cachePatterns = {
  allProducts: `product*:${CACHE_VERSION}:*`,
  product: (id: number) => `product*:${CACHE_VERSION}:*${id}*`,
  allCategories: `categor*:${CACHE_VERSION}:*`,
  category: (id: number) => `category*:${CACHE_VERSION}:*${id}*`,
  allCharacteristics: `characteristic*:${CACHE_VERSION}:*`,
  allPages: `page:${CACHE_VERSION}:*`,
  allMedia: `media:${CACHE_VERSION}:*`,
  all: `*:${CACHE_VERSION}:*`
}

// Декоратор для кеширования функций
export function cached<T extends (...args: any[]) => Promise<any>>(
  cacheKeyFn: (...args: Parameters<T>) => string,
  ttl: number = CACHE_TTL.MEDIUM,
  cacheType: 'api' | 'product' | 'category' | 'page' | 'media' = 'api'
) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: Parameters<T>): Promise<ReturnType<T>> {
      const cacheKey = cacheKeyFn(...args)
      const tags = [cacheType] // Используем тип кеша как тег
      
      try {
        // Пробуем получить из кеша
        const cached = await unifiedCache.get(cacheKey)
        if (cached !== null) {
          logger.debug(`Cache hit: ${cacheKey}`)
          return cached as ReturnType<T>
        }
      } catch (error) {
        logger.error('Cache get error:', error)
      }

      // Если нет в кеше, выполняем оригинальный метод
      const result = await originalMethod.apply(this, args)
      
      // Сохраняем в кеш с тегами
      try {
        await unifiedCache.set(cacheKey, result, { ttl: ttl * 1000, tags }) // TTL в миллисекундах
        logger.debug(`Cache set: ${cacheKey}, TTL: ${ttl}s, tags: ${tags}`)
      } catch (error) {
        logger.error('Cache set error:', error)
      }

      return result
    }

    return descriptor
  }
}

// Функция для кеширования с использованием remember паттерна
export async function cacheRemember<T>(
  key: string,
  ttl: number,
  callback: () => Promise<T>,
  cacheType: 'api' | 'product' | 'category' | 'page' | 'media' = 'api'
): Promise<T> {
  // Пробуем получить из кеша
  const cached = await unifiedCache.get(key)
  if (cached !== null) {
    return cached as T
  }
  
  // Если нет в кеше, выполняем callback
  const result = await callback()
  
  // Сохраняем в кеш с тегом
  await unifiedCache.set(key, result, { ttl: ttl * 1000, tags: [cacheType] })
  
  return result
}

// Инвалидация кеша - использует новую унифицированную систему
export async function invalidateCache(patterns: string | string[]): Promise<number> {
  const patternsArray = Array.isArray(patterns) ? patterns : [patterns]
  let totalDeleted = 0

  for (const pattern of patternsArray) {
    try {
      // Используем унифицированную систему кеша
      const keys = await unifiedCache.getKeysByPattern(pattern)
      for (const key of keys) {
        const deleted = await unifiedCache.delete(key)
        if (deleted) totalDeleted++
      }
      logger.info(`Cache invalidated: ${pattern}, deleted: ${totalDeleted}`)
    } catch (error) {
      logger.error('Cache invalidation error:', error)
    }
  }

  return totalDeleted
}

// Прогрев кеша
export async function warmupCache(items: Array<{ key: string; loader: () => Promise<any>; ttl?: number }>) {
  const results = await Promise.allSettled(
    items.map(async ({ key, loader, ttl = CACHE_TTL.MEDIUM }) => {
      try {
        const data = await loader()
        await unifiedCache.set(key, data, { ttl: ttl * 1000 }) // TTL в миллисекундах
        return { key, status: 'success' }
      } catch (error) {
        logger.error(`Cache warmup failed for ${key}:`, error)
        return { key, status: 'failed', error }
      }
    })
  )

  const success = results.filter(r => r.status === 'fulfilled' && r.value.status === 'success').length
  const failed = results.length - success

  logger.info(`Cache warmup completed: ${success} success, ${failed} failed`)
  return { success, failed, total: results.length }
}

/**
 * Legacy функция для совместимости со старым API
 * @deprecated Используйте invalidateCache вместо этого
 * @param patterns Массив паттернов для инвалидации
 * @returns Количество удаленных ключей
 */
export async function invalidateRelated(patterns: string[]): Promise<number> {
  return invalidateCache(patterns)
}

// Мониторинг кеша
export async function getCacheStats() {
  const stats = unifiedCache.getStats()
  const metrics = unifiedCache.getMetrics()
  
  return {
    connected: true, // Унифицированный кеш всегда доступен
    keys: {
      total: stats.totalEntries,
      api: stats.tagStats?.api || 0,
      product: stats.tagStats?.product || 0,
      category: stats.tagStats?.category || 0,
      page: stats.tagStats?.page || 0,
      media: stats.tagStats?.media || 0
    },
    memory: {
      used: stats.memoryUsage
    },
    metrics
  }
}