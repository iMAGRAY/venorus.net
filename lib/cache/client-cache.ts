'use client'
import { 
  CacheEntry, 
  CacheOptions, 
  CacheStats, 
  CacheMetrics, 
  CacheLayer,
  CACHE_TAGS
} from './types'
import { logger } from '../logger'

/**
 * Client-only Cache Manager - только Memory + Server API
 * БЕЗ прямого Redis подключения для клиентского кода
 */
export class ClientCacheManager {
  private memoryCache = new Map<string, CacheEntry>()
  private tagToKeys = new Map<string, Set<string>>()
  private keyToTags = new Map<string, Set<string>>()
  private metrics: CacheMetrics
  private cleanupInterval?: NodeJS.Timeout

  constructor() {
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

    // Очистка каждые 5 минут
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)

    // Очистка при закрытии страницы
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.destroy()
      })
    }
  }

  /**
   * Получение данных из кеша
   */
  async get<T>(key: string): Promise<T | null> {
    const now = Date.now()
    
    // 1. Проверяем Memory кеш
    const memoryEntry = this.memoryCache.get(key)
    if (memoryEntry && memoryEntry.expires > now) {
      if (memoryEntry.metadata) {
        memoryEntry.metadata.accessed = now
        memoryEntry.metadata.hits++
      }
      this.metrics.hits++
      this.metrics.layers[CacheLayer.MEMORY].hits++
      return memoryEntry.data as T
    }

    // 2. Пробуем Server API
    try {
      const response = await fetch('/api/cache/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data) {
          // Сохраняем в memory для следующих запросов
          const entry: CacheEntry<T> = {
            data: result.data,
            expires: Date.now() + (5 * 60 * 1000), // 5 минут в memory
            tags: new Set(result.tags || []),
            metadata: {
              created: Date.now(),
              accessed: Date.now(), 
              hits: 1
            }
          }
          
          this.memoryCache.set(key, entry)
          this.updateTagMaps(key, entry.tags)
          
          this.metrics.hits++
          this.metrics.layers[CacheLayer.SERVER].hits++
          return result.data as T
        }
      }

      this.metrics.layers[CacheLayer.SERVER].misses++
    } catch (error) {
      this.metrics.layers[CacheLayer.SERVER].errors++
      logger.error('Server cache error:', error)
    }

    this.metrics.misses++
    return null
  }

  /**
   * Сохранение данных
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<boolean> {
    const ttl = options.ttl || 300000 // 5 минут по умолчанию
    const tags = new Set(options.tags || [])
    
    // Сохраняем в memory
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

    this.memoryCache.set(key, entry)
    this.updateTagMaps(key, tags)

    // Сохраняем на сервер асинхронно
    this.saveToServer(key, data, options).catch(error => {
      logger.error('Failed to save to server cache:', error)
    })

    this.metrics.sets++
    return true
  }

  /**
   * Удаление по ключу
   */
  async delete(key: string): Promise<boolean> {
    // Удаляем из memory
    const entry = this.memoryCache.get(key)
    if (entry) {
      this.removeFromTagMaps(key, entry.tags)
      this.memoryCache.delete(key)
    }

    // Удаляем с сервера асинхронно
    this.deleteFromServer(key).catch(error => {
      logger.error('Failed to delete from server cache:', error)
    })

    this.metrics.deletes++
    return true
  }

  /**
   * Инвалидация по тегам
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    const keysToInvalidate = new Set<string>()
    
    for (const tag of tags) {
      const tagKeys = this.tagToKeys.get(tag)
      if (tagKeys) {
        tagKeys.forEach(key => keysToInvalidate.add(key))
      }
    }

    // Удаляем из memory
    for (const key of keysToInvalidate) {
      const entry = this.memoryCache.get(key)
      if (entry) {
        this.removeFromTagMaps(key, entry.tags)
        this.memoryCache.delete(key)
      }
    }

    // Инвалидируем на сервере асинхронно
    if (keysToInvalidate.size > 0) {
      this.invalidateOnServer(tags).catch(error => {
        logger.error('Failed to invalidate on server:', error)
      })
    }

    this.metrics.invalidations++
    return keysToInvalidate.size
  }

  /**
   * Полная очистка
   */
  async clear(): Promise<boolean> {
    this.memoryCache.clear()
    this.tagToKeys.clear()
    this.keyToTags.clear()

    // Очищаем сервер асинхронно
    fetch('/api/cache/clear', { method: 'POST' }).catch(error => {
      logger.error('Failed to clear server cache:', error)
    })

    return true
  }

  /**
   * Получение статистики
   */
  getStats(): CacheStats {
    return {
      totalEntries: this.memoryCache.size,
      memoryUsage: this.estimateMemorySize(),
      hitRate: this.metrics.hits + this.metrics.misses > 0 
        ? this.metrics.hits / (this.metrics.hits + this.metrics.misses) 
        : 0,
      missRate: this.metrics.hits + this.metrics.misses > 0 
        ? this.metrics.misses / (this.metrics.hits + this.metrics.misses) 
        : 0,
      tagStats: {}
    }
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics }
  }

  /**
   * Уничтожение экземпляра
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.memoryCache.clear()
    this.tagToKeys.clear()
    this.keyToTags.clear()
  }

  // === ПРИВАТНЫЕ МЕТОДЫ ===

  private async saveToServer<T>(key: string, data: T, options: CacheOptions): Promise<void> {
    try {
      await fetch('/api/cache/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          data,
          ttl: options.ttl,
          tags: Array.from(options.tags || [])
        })
      })
    } catch (error) {
      // Логируем, но не бросаем ошибку
      logger.debug('Server cache set failed:', error)
    }
  }

  private async deleteFromServer(key: string): Promise<void> {
    try {
      await fetch('/api/cache/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      })
    } catch (error) {
      logger.debug('Server cache delete failed:', error)
    }
  }

  private async invalidateOnServer(tags: string[]): Promise<void> {
    try {
      await fetch('/api/cache/invalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags })
      })
    } catch (error) {
      logger.debug('Server cache invalidate failed:', error)
    }
  }

  private updateTagMaps(key: string, tags: Set<string>): void {
    // Обновляем tag -> keys mapping
    for (const tag of tags) {
      if (!this.tagToKeys.has(tag)) {
        this.tagToKeys.set(tag, new Set())
      }
      this.tagToKeys.get(tag)!.add(key)
    }

    // Обновляем key -> tags mapping
    this.keyToTags.set(key, new Set(tags))
  }

  private removeFromTagMaps(key: string, tags: Set<string>): void {
    // Удаляем из tag -> keys mapping
    for (const tag of tags) {
      const tagKeys = this.tagToKeys.get(tag)
      if (tagKeys) {
        tagKeys.delete(key)
        if (tagKeys.size === 0) {
          this.tagToKeys.delete(tag)
        }
      }
    }

    // Удаляем key -> tags mapping
    this.keyToTags.delete(key)
  }

  private cleanup(): void {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expires <= now) {
        this.removeFromTagMaps(key, entry.tags)
        this.memoryCache.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned ${cleanedCount} expired entries`)
    }
  }

  private estimateMemorySize(): number {
    let size = 0
    for (const entry of this.memoryCache.values()) {
      size += JSON.stringify(entry.data).length * 2 // Примерная оценка
    }
    return size
  }
}

// Singleton экземпляр для использования в клиентском коде
export const clientCache = new ClientCacheManager()

// Хелперы для удобства использования
export const CacheHelpers = {
  invalidateProducts: () => clientCache.invalidateByTags([CACHE_TAGS.PRODUCTS]),
  invalidateCategories: () => clientCache.invalidateByTags([CACHE_TAGS.CATEGORIES]), 
  invalidateSettings: () => clientCache.invalidateByTags([CACHE_TAGS.SETTINGS]),
  invalidateAll: () => clientCache.clear(),
  getStats: () => clientCache.getStats(),
  getMetrics: () => clientCache.getMetrics()
}