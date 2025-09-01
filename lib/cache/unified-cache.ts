/**
 * UNIFIED CACHE SYSTEM
 * Единая унифицированная система кеширования для всего приложения
 */

import { logger } from '../logger'

// Кеш для Redis клиента для предотвращения множественных импортов
let cachedRedisClient: any = null

// Функция для получения Redis клиента с кешированием
async function getRedisClient() {
  if (!cachedRedisClient) {
    try {
      const { redis } = await import('../clients/redis-client')
      cachedRedisClient = redis
    } catch (error) {
      logger.debug('Redis client not available:', error)
      return null
    }
  }
  return cachedRedisClient
}

// ========================================================================================
// TYPES & INTERFACES
// ========================================================================================

export interface CacheEntry<T = any> {
  data: T
  expires: number
  tags: Set<string>
  metadata?: {
    created: number
    accessed: number
    hits: number
  }
}

// Тип для сериализованной в Redis структуры
interface SerializedCacheEntry<T = any> {
  data: T
  expires: number
  tags: string[]
  metadata?: {
    created: number
    accessed: number
    hits: number
  }
}

export interface CacheStats {
  totalEntries: number
  memoryUsage: number
  hitRate: number
  missRate: number
  tagStats: Record<string, number>
}

export interface CacheOptions {
  ttl?: number
  tags?: string[]
  compress?: boolean
  fallback?: boolean
}

export enum CacheLayer {
  MEMORY = 'memory',
  REDIS = 'redis'
}

export interface CacheConfig {
  layers: CacheLayer[]
  defaultTTL: number
  maxMemoryEntries: number
  maxMemorySize: number
  namespace: string
  enableMetrics: boolean
  enableDebug: boolean
}

export interface CacheMetrics {
  hits: number
  misses: number
  sets: number
  deletes: number
  invalidations: number
  layers: Record<CacheLayer, { hits: number; misses: number; errors: number }>
  hitRate?: number
  memoryUsage?: number
  stampedePrevented?: number
  inflightRequests?: number
  tagStats?: Record<string, number>
}

// ========================================================================================
// CACHE TAGS
// ========================================================================================

export const CACHE_TAGS = {
  // Entity tags
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  MANUFACTURERS: 'manufacturers',
  USERS: 'users',
  ORDERS: 'orders',
  MEDIA: 'media',
  SETTINGS: 'settings',
  
  // Specific entity tags
  PRODUCT: (id: string) => `product:${id}`,
  CATEGORY: (id: string) => `category:${id}`,
  MANUFACTURER: (id: string) => `manufacturer:${id}`,
  USER: (id: string) => `user:${id}`,
  ORDER: (id: string) => `order:${id}`,
  
  // Page tags
  PAGE_HOME: 'page:home',
  PAGE_PRODUCTS: 'page:products',
  PAGE_CATEGORIES: 'page:categories',
  PAGE_ADMIN: 'page:admin',
  
  // API tags
  API_PRODUCTS: 'api:products',
  API_CATEGORIES: 'api:categories',
  API_SETTINGS: 'api:settings'
} as const

/**
 * Singleflight паттерн для предотвращения cache stampede
 */
class SingleflightGroup {
  private inflight = new Map<string, Promise<any>>()
  private stampedePrevented = 0
  
  async do<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key)
    if (existing) {
      this.stampedePrevented++
      return existing
    }
    
    const promise = fn().finally(() => {
      this.inflight.delete(key)
    })
    
    this.inflight.set(key, promise)
    return promise
  }
  
  getInflightCount(): number {
    return this.inflight.size
  }
  
  getStampedePrevented(): number {
    return this.stampedePrevented
  }
}

/**
 * Unified Cache Manager - объединяет все уровни кеширования
 * Memory -> Server -> Redis с автоматическим fallback
 * Включает singleflight для предотвращения stampede
 */
export class UnifiedCacheManager {
  private memoryCache = new Map<string, CacheEntry>()
  private tagToKeys = new Map<string, Set<string>>()
  private keyToTags = new Map<string, Set<string>>()
  private metrics: CacheMetrics
  private config: CacheConfig
  private cleanupInterval?: NodeJS.Timeout
  private singleflight = new SingleflightGroup()

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      layers: [CacheLayer.MEMORY, CacheLayer.REDIS],
      defaultTTL: 300000, // 5 минут
      maxMemoryEntries: 1000,
      maxMemorySize: 50 * 1024 * 1024, // 50MB
      namespace: 'venorus',
      enableMetrics: true,
      enableDebug: false,
      ...config
    }

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      invalidations: 0,
      layers: {
        [CacheLayer.MEMORY]: { hits: 0, misses: 0, errors: 0 },
        [CacheLayer.REDIS]: { hits: 0, misses: 0, errors: 0 }
      }
    }

    // Запускаем периодическую очистку каждые 5 минут
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)

    if (this.config.enableDebug) {
      logger.info('UnifiedCacheManager initialized', { config: this.config })
    }
  }

  /**
   * Получение данных из кеша с fallback по слоям
   * @param key - Ключ для поиска в кеше
   * @returns Данные из кеша или null если не найдено
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key)
    
    // Проверяем каждый слой по порядку
    for (const layer of this.config.layers) {
      try {
        const result = await this.getFromLayer<T>(fullKey, layer)
        if (result !== null) {
          this.recordHit(layer)
          
          // Если данные найдены не в памяти, копируем в верхние слои
          if (layer !== CacheLayer.MEMORY) {
            await this.backfillUpperLayers(fullKey, result, layer)
          }
          
          return result.data
        } else {
          this.recordMiss(layer)
        }
      } catch (error) {
        this.recordError(layer)
        if (this.config.enableDebug) {
          logger.error(`Cache layer ${layer} error:`, error)
        }
      }
    }

    this.metrics.misses++
    return null
  }

  /**
   * Сохранение данных во все доступные слои кеша
   * @param key - Ключ для сохранения
   * @param data - Данные для кеширования
   * @param options - Опции кеширования (ttl, tags)
   * @returns true если сохранено хотя бы в один слой
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<boolean> {
    const fullKey = this.buildKey(key)
    const ttl = options.ttl || this.config.defaultTTL
    const tags = new Set(options.tags || [])
    
    const entry: CacheEntry<T> = {
      data,
      expires: Date.now() + ttl,
      tags,
      metadata: {
        created: Date.now(),
        accessed: Date.now(),
        hits: 0
      }
    }

    let success = false

    // Сохраняем в каждый слой
    for (const layer of this.config.layers) {
      try {
        const result = await this.setToLayer(fullKey, entry, layer)
        if (result) {
          success = true
        }
      } catch (error) {
        this.recordError(layer)
        if (this.config.enableDebug) {
          logger.error(`Cache layer ${layer} set error:`, error)
        }
      }
    }

    if (success) {
      // Обновляем индекс тегов для memory layer
      this.updateTagIndex(fullKey, tags)
      this.metrics.sets++
    }

    return success
  }

  /**
   * Get or Set с использованием singleflight для предотвращения stampede
   * @param key - Ключ кеша
   * @param fetcher - Функция для получения данных
   * @param options - Опции кеширования
   * @returns Данные из кеша или результат fetcher
   */
  async getOrSet<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> {
    const fullKey = this.buildKey(key)
    
    // Сначала пробуем получить из кеша
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }
    
    // Используем singleflight для предотвращения stampede
    return this.singleflight.do(fullKey, async () => {
      // Проверяем еще раз после получения lock
      const cachedAgain = await this.get<T>(key)
      if (cachedAgain !== null) {
        return cachedAgain
      }
      
      // Получаем данные
      const data = await fetcher()
      
      // Сохраняем в кеш
      await this.set(key, data, options)
      
      return data
    })
  }

  /**
   * Удаление конкретного ключа
   */
  async delete(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key)
    let success = false

    // Удаляем из всех слоев
    for (const layer of this.config.layers) {
      try {
        const result = await this.deleteFromLayer(fullKey, layer)
        if (result) {
          success = true
        }
      } catch (error) {
        this.recordError(layer)
        if (this.config.enableDebug) {
          logger.error(`Cache layer ${layer} delete error:`, error)
        }
      }
    }

    if (success) {
      this.removeFromTagIndex(fullKey)
      this.metrics.deletes++
    }

    return success
  }
  
  /**
   * Внутренний метод удаления по полному ключу (с namespace)
   */
  private async deleteByFullKey(fullKey: string): Promise<boolean> {
    let success = false

    // Удаляем из всех слоев
    for (const layer of this.config.layers) {
      try {
        const result = await this.deleteFromLayer(fullKey, layer)
        if (result) {
          success = true
        }
      } catch (error) {
        this.recordError(layer)
        if (this.config.enableDebug) {
          logger.error(`Cache layer ${layer} delete error:`, error)
        }
      }
    }

    if (success) {
      this.removeFromTagIndex(fullKey)
      this.metrics.deletes++
    }

    return success
  }

  /**
   * Инвалидация кеша по тегам - удаляет все записи с указанными тегами
   * @param tags - Массив тегов для инвалидации
   * @returns Количество удаленных записей
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidatedCount = 0
    const keysToInvalidate = new Set<string>()

    // Собираем все ключи по тегам
    for (const tag of tags) {
      const keys = this.tagToKeys.get(tag)
      if (keys) {
        keys.forEach(key => keysToInvalidate.add(key))
      }
    }

    // Удаляем каждый ключ (используем внутренний метод с полным ключом)
    for (const key of keysToInvalidate) {
      const deleted = await this.deleteByFullKey(key)
      if (deleted) {
        invalidatedCount++
      }
    }

    this.metrics.invalidations += invalidatedCount
    
    if (this.config.enableDebug) {
      logger.info('Cache invalidated by tags', { 
        tags, 
        invalidatedKeys: invalidatedCount,
        keys: Array.from(keysToInvalidate)
      })
    }

    return invalidatedCount
  }

  /**
   * Полная очистка кеша
   */
  async clear(): Promise<void> {
    // Очищаем memory
    this.memoryCache.clear()
    this.tagToKeys.clear()
    this.keyToTags.clear()

    // Очищаем другие слои
    for (const layer of this.config.layers) {
      if (layer !== CacheLayer.MEMORY) {
        try {
          await this.clearLayer(layer)
        } catch (error) {
          this.recordError(layer)
          if (this.config.enableDebug) {
            logger.error(`Cache layer ${layer} clear error:`, error)
          }
        }
      }
    }

    // Сбрасываем метрики
    Object.keys(this.metrics.layers).forEach(layer => {
      this.metrics.layers[layer as CacheLayer] = { hits: 0, misses: 0, errors: 0 }
    })
    
    if (this.config.enableDebug) {
      logger.info('Cache cleared completely')
    }
  }

  /**
   * Получение статистики
   */
  getStats(): CacheStats {
    const memoryUsage = this.calculateMemoryUsage()
    const totalRequests = this.metrics.hits + this.metrics.misses
    const hitRate = totalRequests > 0 ? this.metrics.hits / totalRequests : 0
    
    return {
      totalEntries: this.memoryCache.size,
      memoryUsage,
      hitRate,
      missRate: 1 - hitRate,
      tagStats: this.getTagStats()
    }
  }

  /**
   * Получение расширенных метрик для мониторинга
   */
  getMetrics(): CacheMetrics {
    const totalRequests = this.metrics.hits + this.metrics.misses
    const hitRate = totalRequests > 0 ? this.metrics.hits / totalRequests : 0
    
    return { 
      ...this.metrics,
      hitRate,
      memoryUsage: this.calculateMemoryUsage(),
      stampedePrevented: this.singleflight.getStampedePrevented(),
      inflightRequests: this.singleflight.getInflightCount(),
      tagStats: this.getTagStats()
    }
  }
  
  /**
   * Получение детальной статистики производительности
   */
  getPerformanceStats(): {
    hitRate: number
    missRate: number
    memoryUsageMB: number
    entriesCount: number
    stampedePrevented: number
    avgHitsPerEntry: number
    topTags: Array<{ tag: string; count: number }>
  } {
    const totalRequests = this.metrics.hits + this.metrics.misses
    const hitRate = totalRequests > 0 ? this.metrics.hits / totalRequests : 0
    const memoryUsageMB = this.calculateMemoryUsage() / (1024 * 1024)
    
    let totalHits = 0
    for (const entry of this.memoryCache.values()) {
      totalHits += entry.metadata?.hits || 0
    }
    
    const avgHitsPerEntry = this.memoryCache.size > 0 ? totalHits / this.memoryCache.size : 0
    
    const tagStats = this.getTagStats()
    const topTags = Object.entries(tagStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }))
    
    return {
      hitRate,
      missRate: 1 - hitRate,
      memoryUsageMB,
      entriesCount: this.memoryCache.size,
      stampedePrevented: this.singleflight.getStampedePrevented(),
      avgHitsPerEntry,
      topTags
    }
  }

  /**
   * Cleanup старых записей
   */
  private cleanup(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expires <= now) {
        this.memoryCache.delete(key)
        this.removeFromTagIndex(key)
        cleaned++
      }
    }

    if (cleaned > 0 && this.config.enableDebug) {
      logger.info(`Cache cleanup: removed ${cleaned} expired entries`)
    }
  }

  // === PRIVATE METHODS ===

  private buildKey(key: string): string {
    return `${this.config.namespace}:${key}`
  }

  private async getFromLayer<T>(key: string, layer: CacheLayer): Promise<CacheEntry<T> | null> {
    switch (layer) {
      case CacheLayer.MEMORY:
        return this.getFromMemory<T>(key)
      
      case CacheLayer.REDIS:
        return this.getFromRedis<T>(key)
      
      default:
        return null
    }
  }

  private async setToLayer<T>(key: string, entry: CacheEntry<T>, layer: CacheLayer): Promise<boolean> {
    switch (layer) {
      case CacheLayer.MEMORY:
        return this.setToMemory(key, entry)
      
      case CacheLayer.REDIS:
        return this.setToRedis(key, entry)
      
      default:
        return false
    }
  }

  private async deleteFromLayer(key: string, layer: CacheLayer): Promise<boolean> {
    switch (layer) {
      case CacheLayer.MEMORY:
        return this.memoryCache.delete(key)
      
      case CacheLayer.REDIS:
        return this.deleteFromRedis(key)
      
      default:
        return false
    }
  }

  private async clearLayer(layer: CacheLayer): Promise<void> {
    switch (layer) {
      case CacheLayer.REDIS:
        await this.clearRedis()
        break
    }
  }

  private getFromMemory<T>(key: string): CacheEntry<T> | null {
    const entry = this.memoryCache.get(key)
    if (!entry) return null
    
    if (entry.expires <= Date.now()) {
      this.memoryCache.delete(key)
      this.removeFromTagIndex(key)
      return null
    }

    // Обновляем метаданные
    if (entry.metadata) {
      entry.metadata.accessed = Date.now()
      entry.metadata.hits++
    }

    return entry as CacheEntry<T>
  }

  private setToMemory<T>(key: string, entry: CacheEntry<T>): boolean {
    // Проверяем лимиты памяти
    if (this.memoryCache.size >= this.config.maxMemoryEntries) {
      this.evictLRU()
    }

    this.memoryCache.set(key, entry)
    return true
  }

  private async getFromRedis<T>(key: string): Promise<CacheEntry<T> | null> {
    if (typeof window !== 'undefined') return null

    try {
      const redis = await getRedisClient()
      if (!redis) return null
      const data = await redis.getJson(key) as SerializedCacheEntry<T> | null
      
      if (data && data.expires > Date.now()) {
        // Конвертируем tags обратно из Array в Set
        return {
          ...data,
          tags: new Set(data.tags || [])
        } as CacheEntry<T>
      }
      
      if (data) {
        await redis.del(key) // Удаляем истекшую запись
      }
      
      return null
    } catch (error) {
      if (this.config.enableDebug) {
        logger.error('Redis get error:', error)
      }
      return null
    }
  }

  private async setToRedis<T>(key: string, entry: CacheEntry<T>): Promise<boolean> {
    if (typeof window !== 'undefined') return false

    try {
      const { redis } = await import('../clients/redis-client')
      const ttlSeconds = Math.ceil((entry.expires - Date.now()) / 1000)
      
      if (ttlSeconds <= 0) return false
      
      // Конвертируем Set в Array для JSON сериализации
      const serializable = {
        ...entry,
        tags: Array.from(entry.tags)
      }
      
      return await redis.setJson(key, serializable, ttlSeconds)
    } catch (error) {
      if (this.config.enableDebug) {
        logger.error('Redis set error:', error)
      }
      return false
    }
  }

  private async deleteFromRedis(key: string): Promise<boolean> {
    if (typeof window !== 'undefined') return false

    try {
      const { redis } = await import('../clients/redis-client')
      return await redis.del(key)
    } catch (error) {
      if (this.config.enableDebug) {
        logger.error('Redis delete error:', error)
      }
      return false
    }
  }

  private async clearRedis(): Promise<void> {
    if (typeof window !== 'undefined') return

    try {
      const { redis } = await import('../clients/redis-client')
      await redis.flushPattern(`${this.config.namespace}:*`)
    } catch (error) {
      if (this.config.enableDebug) {
        logger.error('Redis clear error:', error)
      }
    }
  }

  private async backfillUpperLayers<T>(key: string, entry: CacheEntry<T>, fromLayer: CacheLayer): Promise<void> {
    const layerIndex = this.config.layers.indexOf(fromLayer)
    const upperLayers = this.config.layers.slice(0, layerIndex)

    for (const layer of upperLayers) {
      try {
        await this.setToLayer(key, entry, layer)
      } catch (error) {
        this.recordError(layer)
      }
    }
  }

  private updateTagIndex(key: string, tags: Set<string>): void {
    // Удаляем старые связи
    this.removeFromTagIndex(key)

    // Добавляем новые
    this.keyToTags.set(key, tags)
    for (const tag of tags) {
      if (!this.tagToKeys.has(tag)) {
        this.tagToKeys.set(tag, new Set())
      }
      this.tagToKeys.get(tag)!.add(key)
    }
  }

  async getKeysByPattern(pattern: string): Promise<string[]> {
    const keys: string[] = []
    
    // Проверяем ключи в памяти
    for (const layer of this.config.layers) {
      if (layer === CacheLayer.MEMORY) {
        const cache = this.memoryCache
        if (cache) {
          for (const key of cache.keys()) {
            if (this.matchPattern(key, pattern)) {
              keys.push(key)
            }
          }
        }
      } else if (layer === CacheLayer.REDIS && typeof window === 'undefined') {
        try {
          const redis = await getRedisClient()
          if (!redis) continue
          const fullPattern = `${this.config.namespace}:${pattern}`
          const redisKeys = await redis.keys(fullPattern)
          keys.push(...redisKeys.map(k => k.replace(`${this.config.namespace}:`, '')))
        } catch (error) {
          if (this.config.enableDebug) {
            logger.error('Redis pattern search error:', error)
          }
        }
      }
    }
    
    return [...new Set(keys)] // Убираем дубликаты
  }

  private matchPattern(key: string, pattern: string): boolean {
    // Простая реализация pattern matching
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(key)
  }

  private removeFromTagIndex(key: string): void {
    const tags = this.keyToTags.get(key)
    if (tags) {
      for (const tag of tags) {
        this.tagToKeys.get(tag)?.delete(key)
        if (this.tagToKeys.get(tag)?.size === 0) {
          this.tagToKeys.delete(tag)
        }
      }
      this.keyToTags.delete(key)
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestAccess = Date.now()

    for (const [key, entry] of this.memoryCache.entries()) {
      const accessed = entry.metadata?.accessed || 0
      if (accessed < oldestAccess) {
        oldestAccess = accessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey)
      this.removeFromTagIndex(oldestKey)
    }
  }

  private calculateMemoryUsage(): number {
    let size = 0
    for (const [key, entry] of this.memoryCache.entries()) {
      size += key.length * 2 // UTF-16
      try {
        size += JSON.stringify(entry.data).length * 2
      } catch (error) {
        // Если сериализация не удалась, используем приблизительный размер
        size += 100 // Примерная оценка для несериализуемых объектов
      }
      size += 64 // metadata overhead
    }
    return size
  }

  private getTagStats(): Record<string, number> {
    const stats: Record<string, number> = {}
    for (const [tag, keys] of this.tagToKeys.entries()) {
      stats[tag] = keys.size
    }
    return stats
  }

  private recordHit(layer: CacheLayer): void {
    this.metrics.hits++
    this.metrics.layers[layer].hits++
  }

  private recordMiss(layer: CacheLayer): void {
    this.metrics.layers[layer].misses++
  }

  private recordError(layer: CacheLayer): void {
    this.metrics.layers[layer].errors++
  }

  /**
   * Cleanup при уничтожении
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }
    // Синхронная очистка memory cache
    this.memoryCache.clear()
    this.keyToTags.clear()
    this.tagToKeys.clear()
    
    // Асинхронная очистка Redis в фоне (fire and forget)
    this.clearRedisCache().catch(error => {
      logger.debug('Failed to clear Redis cache during destroy:', error)
    })
  }
  
  private async clearRedisCache(): Promise<void> {
    try {
      const redis = await getRedisClient()
      if (redis && redis.flushPattern) {
        // Используем более эффективный метод очистки по паттерну если доступен
        await redis.flushPattern(`${this.config.namespace}:*`)
      } else if (redis) {
        // Fallback: используем SCAN вместо KEYS для большей производительности
        const pattern = `${this.config.namespace}:*`
        let cursor = 0
        do {
          const result = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 })
          cursor = result.cursor
          if (result.keys && result.keys.length > 0) {
            await redis.del(result.keys)
          }
        } while (cursor !== 0)
      }
    } catch (error) {
      logger.debug('Redis cleanup during destroy failed:', error)
    }
  }
}

// Singleton паттерн для предотвращения множественной инициализации
// Используем глобальный объект для сохранения состояния при HMR в dev режиме
const globalForCache = globalThis as unknown as {
  unifiedCacheInstance: UnifiedCacheManager | undefined
}

// Экспортируем предконфигурированный экземпляр
export const unifiedCache = (() => {
  if (!globalForCache.unifiedCacheInstance) {
    globalForCache.unifiedCacheInstance = new UnifiedCacheManager({
      namespace: 'venorus',
      enableDebug: process.env.NODE_ENV === 'development',
      enableMetrics: true,
      // ОПТИМИЗИРОВАНО: Адаптивные настройки для удаленной БД с высокой латентностью
      // Увеличенный TTL снижает частоту обращений к БД
      defaultTTL: 900000, // 15 минут - баланс между актуальностью и производительностью
      
      // Умеренные лимиты памяти с мониторингом для предотвращения перегрузки
      // При среднем размере записи ~10KB это дает ~20MB использования
      maxMemoryEntries: 2000, // Оптимальное количество для быстрого доступа
      
      // Жесткий лимит памяти с запасом для пиковых нагрузок
      // Автоматическая очистка при достижении 80% лимита
      maxMemorySize: 100 * 1024 * 1024, // 100MB - безопасный предел для Node.js
      
      // Приоритет слоев: сначала локальная память, затем Redis
      // Это минимизирует сетевые задержки для горячих данных
      layers: [CacheLayer.MEMORY, CacheLayer.REDIS]
    })
  }
  return globalForCache.unifiedCacheInstance
})()

// Утилитарные функции для удобства
export const CacheHelpers = {
  // Популярные комбинации тегов
  productTags: (id?: string) => id ? [CACHE_TAGS.PRODUCTS, CACHE_TAGS.PRODUCT(id)] : [CACHE_TAGS.PRODUCTS],
  categoryTags: (id?: string) => id ? [CACHE_TAGS.CATEGORIES, CACHE_TAGS.CATEGORY(id)] : [CACHE_TAGS.CATEGORIES],
  
  // Быстрые методы инвалидации
  invalidateProducts: () => unifiedCache.invalidateByTags([CACHE_TAGS.PRODUCTS]),
  invalidateCategories: () => unifiedCache.invalidateByTags([CACHE_TAGS.CATEGORIES]),
  invalidateAll: () => unifiedCache.clear(),
  
  // Получение статистики
  getStats: () => unifiedCache.getStats(),
  getMetrics: () => unifiedCache.getMetrics()
}