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

export interface CacheOptions {
  ttl?: number // время жизни в миллисекундах
  tags?: string[] // теги для инвалидации
  priority?: 'low' | 'normal' | 'high' // приоритет кеширования
  namespace?: string // пространство имен
}

export interface CacheStats {
  totalEntries: number
  memoryUsage: number
  hitRate: number
  missRate: number
  tagStats: Record<string, number>
}

export enum CacheLayer {
  MEMORY = 'memory',
  SERVER = 'server', 
  REDIS = 'redis'
}

export interface CacheConfig {
  layers: CacheLayer[]
  defaultTTL: number
  maxMemoryEntries: number
  maxMemorySize: number // в байтах
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
  layers: Record<CacheLayer, {
    hits: number
    misses: number
    errors: number
  }>
}

// Стандартные теги для инвалидации
export const CACHE_TAGS = {
  PRODUCTS: 'products',
  PRODUCT: (id: string) => `product:${id}`,
  CATEGORIES: 'categories',
  CATEGORY: (id: string) => `category:${id}`,
  MANUFACTURERS: 'manufacturers', 
  MANUFACTURER: (id: string) => `manufacturer:${id}`,
  SETTINGS: 'settings',
  USER: (id: string) => `user:${id}`,
  SESSION: (id: string) => `session:${id}`,
  API: (endpoint: string) => `api:${endpoint.replace(/\//g, ':')}`
} as const

export type CacheTag = typeof CACHE_TAGS[keyof typeof CACHE_TAGS] | string