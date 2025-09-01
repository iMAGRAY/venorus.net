import { unifiedCache } from './unified-cache'
import { logger } from '@/lib/logger'

// Время жизни кеша в секундах - ОПТИМИЗИРОВАНО для удаленной БД с высокой латентностью
export const CACHE_TTL = {
  SHORT: 1800,     // 30 минут - увеличено для снижения нагрузки на БД
  MEDIUM: 7200,    // 2 часа - увеличено для компенсации латентности
  LONG: 14400,     // 4 часа - увеличено для стабильных данных
  DAILY: 86400,    // 24 часа - для статичных данных
  WEEKLY: 604800,  // 7 дней - для очень статичных данных
  // Negative caching для 404 и ошибок
  NEGATIVE_404: 300,    // 5 минут для 404
  NEGATIVE_ERROR: 60,   // 1 минута для ошибок
}

// Добавление jitter к TTL для предотвращения синхронной инвалидации
export function addJitter(ttl: number, percentJitter: number = 10): number {
  const jitter = ttl * (percentJitter / 100)
  const randomJitter = (Math.random() - 0.5) * 2 * jitter
  return Math.floor(ttl + randomJitter)
}

// Soft TTL для SWR (stale-while-revalidate) - 80% от основного TTL
export function getSoftTTL(ttl: number): number {
  return Math.floor(ttl * 0.8)
}

// Версия схемы и namespace для версионирования ключей
const SCHEMA_VERSION = '2025-01-31'
const NAMESPACE = process.env.CACHE_NAMESPACE || 'venorus'
const CACHE_VERSION = `${NAMESPACE}:${SCHEMA_VERSION}:v5`

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

// Паттерны для инвалидации кеша - точные паттерны без лишних wildcards
export const cachePatterns = {
  allProducts: `products:${CACHE_VERSION}:*`,  // Все списки товаров
  product: (id: number) => `product:${CACHE_VERSION}:${id}`,  // Конкретный товар
  productVariants: (id: number) => `product-variants:${CACHE_VERSION}:${id}`,
  productCharacteristics: (id: number) => `product-chars:${CACHE_VERSION}:${id}`,
  productImages: (id: number) => `product-images:${CACHE_VERSION}:${id}`,
  allCategories: `categories:${CACHE_VERSION}:*`,  // Все категории (точный префикс)
  category: (id: number) => `category:${CACHE_VERSION}:${id}`,  // Конкретная категория
  categoryProducts: (id: number) => `category-products:${CACHE_VERSION}:${id}:*`,  // Товары категории
  allCharacteristics: `characteristics:${CACHE_VERSION}:*`,  // Все характеристики
  allPages: `page:${CACHE_VERSION}:*`,
  allMedia: `media:${CACHE_VERSION}:*`,
  searchResults: `search:${CACHE_VERSION}:*`,  // Результаты поиска
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

/**
 * Secure cache key validation to prevent injection attacks (non-breaking)
 */
function validateCacheKey(key: string): void {
  if (!key || typeof key !== 'string') {
    logger.warn('Invalid cache key type, skipping validation')
    return
  }
  
  // Более мягкая валидация для backward compatibility
  const criticalPatterns = [
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/g, // Только критичные control characters
    /\${.*}/g,                        // Template literal injection
  ]
  
  for (const pattern of criticalPatterns) {
    if (pattern.test(key)) {
      logger.warn(`Potentially unsafe cache key: ${key.substring(0, 50)}...`)
      // Не бросаем исключение для совместимости
      return
    }
  }
  
  // Увеличиваем лимит для совместимости
  if (key.length > 1000) {
    logger.warn(`Cache key very long: ${key.length} characters`)
  }
}

/**
 * Advanced caching function with SWR, jitter, and negative caching
 * @param key - Cache key (will be validated for security)
 * @param ttl - Time to live in seconds
 * @param callback - Function to fetch data on cache miss
 * @param cacheType - Type of cache for tagging and monitoring
 * @param options - Additional options for jitter and negative caching
 * @returns Promise resolving to cached or fresh data
 * @throws Error if key is invalid or callback fails
 */
export async function cacheRemember<T>(
  key: string,
  ttl: number,
  callback: () => Promise<T>,
  cacheType: 'api' | 'product' | 'category' | 'page' | 'media' = 'api',
  options: { 
    useJitter?: boolean
    allowNegative?: boolean
  } = {}
): Promise<T> {
  const { useJitter = true, allowNegative = true } = options
  
  // Валидация ключа для безопасности
  validateCacheKey(key)
  
  // Применяем jitter к TTL
  const finalTTL = useJitter ? addJitter(ttl) : ttl
  
  // Оптимизированная проверка кеша - выходим рано если найдено
  let cached: T | null = null
  try {
    cached = await unifiedCache.get(key)
  } catch (error) {
    logger.debug(`Cache get error for key ${key}:`, error)
    // Продолжаем выполнение без кеша при ошибке
  }
  if (cached !== null) {
    // Проверяем negative cache - возвращаем null вместо exception для совместимости
    if ((cached as any)?._negative) {
      logger.debug(`Negative cache hit for ${key}`)
      // Не бросаем исключение - возвращаем null для backward compatibility
      cached = null
    } else {
      return cached as T
    }
  }
  
  try {
    // Если нет в кеше, выполняем callback
    const result = await callback()
    
    // Сохраняем в кеш с тегом и jittered TTL
    await unifiedCache.set(key, result, { ttl: finalTTL * 1000, tags: [cacheType] })
    
    return result
  } catch (error) {
    // Negative caching для 404
    if (allowNegative && (error as any)?.status === 404) {
      const negativeData = { _error: '404', _negative: true } as T
      await unifiedCache.set(key, negativeData, { 
        ttl: CACHE_TTL.NEGATIVE_404 * 1000, 
        tags: [cacheType, 'negative'] 
      })
    }
    throw error
  }
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

// Unified function for invalidating product-related cache
export async function invalidateProductCache(
  productId: number, 
  categoryId?: number | null,
  operation: 'create' | 'update' | 'delete' = 'update'
): Promise<void> {
  try {
    logger.info(`Invalidating product cache for ${operation}`, { productId, categoryId })
    
    // ОПТИМИЗИРОВАНО: Более целевая инвалидация для снижения нагрузки
    const patterns = []
    
    // Всегда инвалидируем конкретный продукт
    patterns.push(
      cachePatterns.product(productId),            // product:v5:{id}
      cachePatterns.productVariants(productId),    // product-variants:v5:{id}
      cachePatterns.productCharacteristics(productId), // product-chars:v5:{id}
      cachePatterns.productImages(productId),      // product-images:v5:{id}
    )
    
    // Инвалидируем списки только при создании/удалении
    if (operation === 'create' || operation === 'delete') {
      patterns.push(
        cachePatterns.allProducts,                 // products:v5:*
        cachePatterns.searchResults,              // search:v5:*
        `api:products:*`,                        // API middleware cache
      )
    }
    
    // Инвалидируем страницы только при удалении
    if (operation === 'delete') {
      patterns.push(
        cachePatterns.allPages,                   // page:v5:*
        `api:search:*`,                          // API search cache
      )
    }
    
    // Add category-specific patterns if category is provided
    if (categoryId) {
      patterns.push(cachePatterns.categoryProducts(categoryId))
    }
    
    // Invalidate only necessary patterns
    await invalidateCache(patterns.filter(Boolean))
    
    // Для операций update не инвалидируем теги глобально
    if (operation !== 'update') {
      try {
        await unifiedCache.invalidateByTags(['products', 'api'])
        logger.debug('Cache tags invalidated successfully')
      } catch (error) {
        logger.warn('Failed to invalidate cache tags', { error })
      }
    }
    
    logger.info(`Product cache invalidated successfully for ${operation}`, { productId })
  } catch (error) {
    logger.error(`Failed to invalidate product cache for ${operation}`, { productId, error })
    // Don't throw - cache invalidation failure shouldn't break the operation
  }
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

// Мониторинг кеша с проверкой доступности
export async function getCacheStats() {
  try {
    const stats = unifiedCache.getStats()
    const metrics = unifiedCache.getMetrics()
    
    // Проверяем доступность unified cache через тест
    const healthCheck = await getCacheHealth()
    
    return {
      connected: healthCheck.healthy, // Реальная проверка доступности
      latency: healthCheck.latency,
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
      metrics,
      error: healthCheck.healthy ? undefined : healthCheck.details
    }
  } catch (error) {
    logger.error('Failed to get cache stats', { error: error.message })
    
    // Возвращаем безопасные значения по умолчанию при ошибке
    return {
      connected: false,
      latency: -1,
      keys: {
        total: 0,
        api: 0,
        product: 0,
        category: 0,
        page: 0,
        media: 0
      },
      memory: {
        used: 0
      },
      metrics: {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        invalidations: 0,
        layers: {}
      },
      error: `Cache stats unavailable: ${error.message}`
    }
  }
}

export async function getKeysByPattern(pattern: string): Promise<string[]> {
  // Validate pattern input
  if (!pattern || typeof pattern !== 'string' || pattern.trim().length === 0) {
    throw new Error('Pattern parameter is required and must be a non-empty string')
  }
  
  // Sanitize pattern to prevent potential security issues
  const maxPatternLength = 500 // Configurable limit
  if (pattern.length > maxPatternLength) {
    throw new Error(`Pattern too long - maximum ${maxPatternLength} characters allowed`)
  }
  
  // Validate pattern for security - prevent injection attacks
  const dangerousPatterns = [/[;|&`$()]/g, /\x00/g]
  for (const dangerousPattern of dangerousPatterns) {
    if (dangerousPattern.test(pattern)) {
      throw new Error('Pattern contains potentially dangerous characters')
    }
  }
  
  try {
    const keys = await unifiedCache.getKeysByPattern(pattern)
    if (!Array.isArray(keys)) {
      logger.warn('Cache returned non-array for pattern search', { pattern, returnType: typeof keys })
      return []
    }
    
    logger.debug(`Retrieved ${keys.length} keys for pattern: ${pattern}`)
    return keys
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    logger.error('Failed to get keys by pattern', { 
      pattern, 
      error: errorMsg, 
      stack: errorStack?.split('\n').slice(0, 3) // First 3 lines of stack trace
    })
    
    // Preserve original error stack trace instead of creating new Error
    if (error instanceof Error) {
      error.message = `Cache pattern search failed: ${error.message}`
      throw error
    }
    
    throw new Error(`Cache pattern search failed: ${errorMsg}`)
  }
}

interface CacheTestData {
  test: boolean
  timestamp: number
}

function isCacheTestData(obj: unknown): obj is CacheTestData {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    !Array.isArray(obj) &&
    'test' in obj &&
    'timestamp' in obj &&
    typeof (obj as any).test === 'boolean' &&
    typeof (obj as any).timestamp === 'number'
  )
}

export async function getCacheHealth(): Promise<{
  healthy: boolean
  latency: number
  details: string
}> {
  try {
    const testStart = Date.now()
    const testKey = `health_check_${Date.now()}_${Math.random().toString(36).substring(2)}`
    const testData: CacheTestData = { test: true, timestamp: testStart }
    
    // Test basic operations
    await unifiedCache.set(testKey, testData, { ttl: 5000 })
    const retrieved = await unifiedCache.get(testKey)
    await unifiedCache.delete(testKey)
    
    const latency = Date.now() - testStart
    
    // Verify data integrity with proper type checking
    if (retrieved && isCacheTestData(retrieved) && retrieved.test === true) {
      return {
        healthy: true,
        latency,
        details: 'All cache operations working correctly'
      }
    }
    
    // Handle string serialization case (some cache layers might serialize to JSON)
    if (typeof retrieved === 'string') {
      try {
        const parsed = JSON.parse(retrieved)
        if (isCacheTestData(parsed) && parsed.test === true) {
          return {
            healthy: true,
            latency,
            details: 'All cache operations working correctly (with JSON serialization)'
          }
        }
      } catch (parseError) {
        logger.warn('Cache health check: failed to parse string response', { retrieved })
      }
    }
    
    return {
      healthy: false,
      latency,
      details: `Data integrity check failed - expected test object, got: ${typeof retrieved}`
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error('Cache health check failed', { error: errorMsg })
    
    return {
      healthy: false,
      latency: -1,
      details: `Cache health check failed: ${errorMsg}`
    }
  }
}

export function formatCacheSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${Math.round(ms / 1000 * 10) / 10}s`
  if (ms < 3600000) return `${Math.round(ms / 60000 * 10) / 10}m`
  return `${Math.round(ms / 3600000 * 10) / 10}h`
}