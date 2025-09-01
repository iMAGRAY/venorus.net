import { createClient, RedisClientType } from 'redis'
import { RUNTIME_CONFIG } from '../app-config'
import { logger } from '../logger'

class RedisManager {
  private client: RedisClientType | null = null
  private isConnected = false
  private connectionAttempts = 0
  private maxRetries = 5 // Увеличили количество попыток
  private emergencyMode = false
  private circuitBreakerOpen = false
  private lastFailTime = 0
  private circuitBreakerTimeout = 60000 // 1 минута для circuit breaker
  private lastErrorLogTime = 0
  private isConnecting = false

  constructor() {
    // Отключаем аварийный режим только если явно указан EMERGENCY_NO_REDIS
    if (process.env.EMERGENCY_NO_REDIS === 'true') {
      logger.warn('🚨 EMERGENCY MODE: Redis connection disabled by EMERGENCY_NO_REDIS flag')
      this.emergencyMode = true
      this.isConnected = false
    } else {
      // Пытаемся подключиться к Redis в любом режиме
      this.connect()
    }
  }

  private async connect(): Promise<void> {
    if (this.isConnecting) {
      return // Предотвращаем множественные одновременные подключения
    }
    
    this.isConnecting = true
    
    try {
      if (this.client) {
        await this.client.disconnect()
      }

      this.client = createClient({
        socket: {
          host: RUNTIME_CONFIG.CACHE.REDIS.HOST,
          port: RUNTIME_CONFIG.CACHE.REDIS.PORT,
          connectTimeout: RUNTIME_CONFIG.CACHE.REDIS.CONNECT_TIMEOUT
        },
        username: RUNTIME_CONFIG.CACHE.REDIS.USERNAME,
        password: RUNTIME_CONFIG.CACHE.REDIS.PASSWORD,
        database: RUNTIME_CONFIG.CACHE.REDIS.DATABASE
      })

      this.client.on('error', (err) => {
        const now = Date.now()
        // Логируем ошибки Redis не чаще чем раз в 5 секунд
        if (now - this.lastErrorLogTime > 5000) {
          logger.error('Redis Client Error:', err)
          this.lastErrorLogTime = now
        }
        this.isConnected = false
      })

      this.client.on('connect', () => {
        logger.info(`Redis connected to ${RUNTIME_CONFIG.CACHE.REDIS.HOST}:${RUNTIME_CONFIG.CACHE.REDIS.PORT}`)
        this.isConnected = true
        this.connectionAttempts = 0
      })

      this.client.on('disconnect', () => {
        logger.info('Redis disconnected')
        this.isConnected = false
      })

      await this.client.connect()
    } catch (error) {
      logger.error('Failed to connect to Redis:', error)
      this.isConnected = false
      this.connectionAttempts++

      if (this.connectionAttempts < this.maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        const backoffDelay = Math.min(1000 * Math.pow(2, this.connectionAttempts), 16000)
        logger.info(`Retrying Redis connection in ${backoffDelay}ms (attempt ${this.connectionAttempts + 1}/${this.maxRetries})...`)
        setTimeout(() => this.connect(), backoffDelay)
      } else {
        // Активируем circuit breaker после исчерпания попыток
        this.circuitBreakerOpen = true
        this.lastFailTime = Date.now()
        logger.warn('Redis circuit breaker activated - falling back to in-memory cache')
      }
    } finally {
      this.isConnecting = false
    }
  }

  // Проверяем circuit breaker
  private checkCircuitBreaker(): boolean {
    if (this.circuitBreakerOpen) {
      // Проверяем, можно ли сбросить circuit breaker
      if (Date.now() - this.lastFailTime > this.circuitBreakerTimeout) {
        logger.info('Attempting to reset Redis circuit breaker...')
        this.circuitBreakerOpen = false
        this.connectionAttempts = 0
        this.connect() // Попытаемся переподключиться
        return false // На этот раз еще не готов
      }
      return true // Circuit breaker все еще открыт
    }
    return false
  }

  async get(key: string): Promise<string | null> {
    if (this.emergencyMode || this.checkCircuitBreaker() || !this.isConnected || !this.client) {
      // В аварийном режиме или circuit breaker активен - возвращаем null (cache miss)
      return null
    }

    try {
      const result = await this.client.get(key)
      return typeof result === 'string' ? result : null
    } catch (error) {
      logger.error('Redis GET error:', error)
      return null
    }
  }

  async set(key: string, value: string, options?: { EX?: number; PX?: number }): Promise<boolean> {
    if (this.emergencyMode || this.checkCircuitBreaker() || !this.isConnected || !this.client) {
      // В аварийном режиме или circuit breaker активен - притворяемся что кеш работает
      return true
    }

    try {
      const result = await this.client.set(key, value, options)
      return result === 'OK'
    } catch (error) {
      logger.error('Redis SET error:', error)
      return false
    }
  }

  async setJson(key: string, data: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(data)
      const options = ttlSeconds ? { EX: ttlSeconds } : undefined
      return await this.set(key, serialized, options)
    } catch (error) {
      logger.error('Redis setJson error:', error)
      return false
    }
  }

  async getJson<T = any>(key: string): Promise<T | null> {
    try {
      const data = await this.get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      logger.error('Redis getJson error:', error)
      return null
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false
    }

    try {
      const result = await this.client.del(key)
      return result > 0
    } catch (error) {
      logger.error('Redis DEL error:', error)
      return false
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false
    }

    try {
      const result = await this.client.exists(key)
      return result > 0
    } catch (error) {
      logger.error('Redis EXISTS error:', error)
      return false
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected || !this.client) {
      return []
    }

    try {
      return await this.client.keys(pattern)
    } catch (error) {
      logger.error('Redis KEYS error:', error)
      return []
    }
  }

  async flushPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.keys(pattern)
      if (keys.length === 0) return 0

      const deleted = await Promise.all(keys.map(key => this.del(key)))
      return deleted.filter(Boolean).length
    } catch (error) {
      logger.error('Redis flushPattern error:', error)
      return 0
    }
  }

  async flush(): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false
    }

    try {
      await this.client.flushDb()
      return true
    } catch (error) {
      logger.error('Redis FLUSH error:', error)
      return false
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.isConnected || !this.client) {
      return -1
    }

    try {
      return await this.client.ttl(key)
    } catch (error) {
      logger.error('Redis TTL error:', error)
      return -1
    }
  }

  async ping(): Promise<boolean> {
    if (this.emergencyMode) {
      // В аварийном режиме притворяемся что Redis работает
      return true
    }

    if (!this.isConnected || !this.client) {
      return false
    }

    try {
      const result = await this.client.ping()
      return result === 'PONG'
    } catch (error) {
      logger.error('Redis PING error:', error)
      return false
    }
  }

  getConnectionStatus(): { connected: boolean; attempts: number } {
    return {
      connected: this.isConnected,
      attempts: this.connectionAttempts
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect()
      this.isConnected = false
    }
  }
}

// Создаем глобальный экземпляр Redis менеджера
export const redisClient = new RedisManager()
export const redis = redisClient // Для обратной совместимости

// Утилиты для кеширования
export class RedisCache {
  private prefix: string

  constructor(prefix: string = 'medsip') {
    this.prefix = prefix
  }

  private getKey(key: string): string {
    return `${this.prefix}:${key}`
  }

  async get<T = any>(key: string): Promise<T | null> {
    return await redisClient.getJson<T>(this.getKey(key))
  }

  async set(key: string, data: any, ttlSeconds: number = RUNTIME_CONFIG.CACHE.TTL.SHORT): Promise<boolean> {
    return await redisClient.setJson(this.getKey(key), data, ttlSeconds)
  }

  async del(key: string): Promise<boolean> {
    return await redisClient.del(this.getKey(key))
  }

  async exists(key: string): Promise<boolean> {
    return await redisClient.exists(this.getKey(key))
  }

  async flush(): Promise<number> {
    return await redisClient.flushPattern(`${this.prefix}:*`)
  }

  async remember<T = any>(
    key: string,
    callback: () => Promise<T>,
    ttlSeconds: number = RUNTIME_CONFIG.CACHE.TTL.SHORT
  ): Promise<T> {
    // Пробуем получить из кеша
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Если нет в кеше, выполняем callback и сохраняем результат
    const data = await callback()
    await this.set(key, data, ttlSeconds)
    return data
  }

  async rememberForever<T = any>(
    key: string,
    callback: () => Promise<T>
  ): Promise<T> {
    return this.remember(key, callback, RUNTIME_CONFIG.CACHE.TTL.DAILY) // 24 часа
  }
}

// Экспортируем готовые кеш-менеджеры для разных целей
export const apiCache = new RedisCache('api')
export const pageCache = new RedisCache('page')
export const mediaCache = new RedisCache('media')
export const productCache = new RedisCache('product')
export const categoryCache = new RedisCache('category')

export default redisClient