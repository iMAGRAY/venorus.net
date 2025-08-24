// Экспорты системы кеширования 
// Только клиентская версия без Redis зависимостей
export { clientCache as unifiedCache, CacheHelpers } from './client-cache'

// Серверная версия доступна через отдельный файл server-only.ts
// НЕ импортируйте getServerCache в клиентском коде!

export type { 
  CacheEntry,
  CacheOptions, 
  CacheStats,
  CacheLayer,
  CacheConfig,
  CacheMetrics,
  CacheTag
} from './types'
export { CACHE_TAGS } from './types'

// Утилитарные функции для миграции со старых систем
import { clientCache } from './client-cache'

export const migrationHelpers = {
  // Миграция с lib/clients/api-client.ts
  migrateFromApiClient: async (oldCache: Map<string, any>) => {
    for (const [key, value] of oldCache.entries()) {
      if (value && value.expires && value.expires > Date.now()) {
        await clientCache.set(key, value.data, {
          ttl: value.expires - Date.now(),
          tags: ['migrated', 'api']
        })
      }
    }
    oldCache.clear()
  },

  // Миграция с dependency-injection cache
  migrateFromDICache: async (oldCache: Map<string, any>) => {
    for (const [key, value] of oldCache.entries()) {
      if (value && value.expires && value.expires > Date.now()) {
        await clientCache.set(key, value.data, {
          ttl: value.expires - Date.now(),
          tags: ['migrated', 'di']
        })
      }
    }
    oldCache.clear()
  }
}