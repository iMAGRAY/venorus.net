import { 
  CacheEntry, 
  CacheOptions, 
  CacheStats, 
  CacheLayer, 
  CacheConfig, 
  CacheMetrics, 
  CACHE_TAGS
} from './types'
import { logger } from '../logger'

/**
 * Unified Cache Manager - объединяет все уровни кеширования
 * Memory -> Server -> Redis с автоматическим fallback
 */
export class UnifiedCacheManager {
  private memoryCache = new Map<string, CacheEntry>()
  private tagToKeys = new Map<string, Set<string>>()
  private keyToTags = new Map<string, Set<string>>()
  private metrics: CacheMetrics
  private config: CacheConfig
  private cleanupInterval?: NodeJS.Timeout

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
        [CacheLayer.SERVER]: { hits: 0, misses: 0, errors: 0 },
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
   * Сохранение данных во все доступные слои
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
   * Инвалидация по тегам - ОСНОВНАЯ ФИЧА!
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

    // Удаляем каждый ключ
    for (const key of keysToInvalidate) {
      const deleted = await this.delete(key)
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
   * Получение метрик для мониторинга
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics }
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
      const { redis } = await import('../redis-client')
      const data = await redis.getJson<CacheEntry<T>>(key)
      
      if (data && data.expires > Date.now()) {
        return data
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
      const { redis } = await import('../redis-client')
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
      const { redis } = await import('../redis-client')
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
      const { redis } = await import('../redis-client')
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
      size += JSON.stringify(entry.data).length * 2
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
    }
    this.clear()
  }
}

// Экспортируем предконфигурированный экземпляр
export const unifiedCache = new UnifiedCacheManager({
  namespace: 'venorus',
  enableDebug: process.env.NODE_ENV === 'development',
  enableMetrics: true
})

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