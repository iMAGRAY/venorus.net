import { Pool, PoolConfig, QueryResult, QueryResultRow } from "pg"
import { logger } from "../logger"
import { performanceMonitor } from "../performance-monitor"

// Singleton Pool instance
let _pool: Pool | null = null

// Add legacy synchronous availability flag for existing routes
let connectionFailed = false

// Environment validation
function validateEnvironment(): void {
  const required = ['DATABASE_URL', 'POSTGRESQL_HOST', 'POSTGRESQL_USER', 'POSTGRESQL_PASSWORD', 'POSTGRESQL_DBNAME']
  const missing = required.filter(key => !process.env[key] && !process.env.DATABASE_URL)

  if (missing.length > 0 && !process.env.DATABASE_URL) {
    logger.error('Missing required environment variables', { missing })
    logger.info('Please create .env.local file based on .env.example')
    throw new Error(`Missing environment variables: ${missing.join(', ')}`)
  }
}

function createPool(): Pool {
  // Validate environment first
  validateEnvironment()

  // Особая конфигурация для build time - ограничиваем подключения
  const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build'
  
  const config: PoolConfig = {
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST || process.env.POSTGRESQL_HOST || "localhost",
    port: Number(process.env.DB_PORT || process.env.POSTGRESQL_PORT || 5432),
    user: process.env.DB_USER || process.env.POSTGRESQL_USER || "postgres",
    password: process.env.DB_PASSWORD || process.env.POSTGRESQL_PASSWORD || "",
    database: process.env.DB_NAME || process.env.POSTGRESQL_DBNAME || "medsip_protez",
    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Увеличиваем pool для предотвращения connection exhaustion под нагрузкой
    max: isBuildTime ? 2 : 5, // Увеличили до 5 для обработки параллельных запросов
    min: isBuildTime ? 1 : 2,  // Минимум 2 соединения для стабильности
    idleTimeoutMillis: 300_000, // 5 минут idle timeout для освобождения ресурсов
    connectionTimeoutMillis: 5_000, // 5 секунд на подключение (уменьшили для быстрого failover)
    query_timeout: 15_000, // 15 секунд на запрос (уменьшили для предотвращения блокировок)
    statement_timeout: 15_000, // 15 секунд statement timeout (уменьшили)
    keepAlive: true, // Включаем keepAlive
    keepAliveInitialDelayMillis: 10_000, // Начинаем keepAlive быстрее - через 10 секунд
    allowExitOnIdle: false, // Предотвращаем закрытие pool при idle
    
    // Агрессивные настройки для облачной БД
    application_name: 'venorus_web_app', // Идентификация приложения
    
    // SSL настройки для облачных БД - ИСПРАВЛЕНА ПОДДЕРЖКА ВСЕХ SSL РЕЖИМОВ
    ssl: (process.env.PGSSL === "true" || 
          process.env.DATABASE_SSL === "true" || 
          process.env.DATABASE_URL?.includes("sslmode=require") || 
          process.env.DATABASE_URL?.includes("sslmode=prefer") ||
          process.env.DATABASE_URL?.includes("sslmode=allow") ||
          (process.env.PGSSLMODE && process.env.PGSSLMODE !== "disable")) ? { 
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined,
      requestCert: false,
      ca: undefined,
      cert: undefined,
      key: undefined
    } : false,
  }

  logger.info('Connecting to database', {
    host: config.host,
    port: config.port,
    database: config.database,
    ssl: !!config.ssl
  })

  return new Pool(config)
}

export function getPool(): Pool {
  if (!_pool) {
    _pool = createPool()
    
    // Улучшенная обработка ошибок пула
    _pool.on("error", (err) => {
      logger.error("PostgreSQL Pool error", err)
      
      // Обрабатываем idle-session timeout специально
      if (err.message?.includes('idle-session timeout') || (err as any).code === '57P05') {
        logger.warn('Idle session timeout detected, connection will be recreated automatically')
        connectionFailed = false // Не считаем это критической ошибкой
      } else {
        connectionFailed = true
      }
    })
    
    _pool.on("connect", (client) => {
      logger.debug("New database connection established")
      connectionFailed = false
      startKeepAlive() // Запускаем keepalive пинги
      
      // Устанавливаем keep-alive на уровне соединения
      client.query('SET application_name = $1', ['venorus_web_app']).catch(() => {})
    })
    
    // Обработка удаления соединения
    _pool.on("remove", () => {
      logger.debug("Database connection removed from pool")
    })
  }
  return _pool
}

export function isDatabaseAvailableSync(): boolean {
  return !connectionFailed
}

// Keepalive ping interval
let keepAliveInterval: NodeJS.Timeout | null = null

// Start keepalive pings
function startKeepAlive(): void {
  if (keepAliveInterval) return
  
  keepAliveInterval = setInterval(async () => {
    if (_pool && !connectionFailed) {
      try {
        await _pool.query('SELECT 1 as keepalive')
        logger.debug('Keepalive ping successful')
      } catch (error) {
        logger.warn('Keepalive ping failed', { error: error.message })
      }
    }
  }, 120_000) // Ping every 2 minutes
}

// Stop keepalive pings
function stopKeepAlive(): void {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval)
    keepAliveInterval = null
  }
}

// Force reset connection function
export function forceResetConnection(): void {
  stopKeepAlive()
  connectionFailed = false
  if (_pool) {
    _pool.end().catch(err => logger.error("Error closing pool", err))
    _pool = null
  }
  logger.info("Database connection reset")
}

// Test connection function
export async function testConnection(): Promise<boolean> {
  const startTime = Date.now()
  try {
    const db = getPool()
    await db.query("SELECT 1")
    connectionFailed = false
    const duration = Date.now() - startTime
    // Connection test completed successfully
    performanceMonitor.recordQuery("SELECT 1", duration, true)
    return true
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error("Database connection test failed", error, 'DATABASE')
    performanceMonitor.recordQuery("SELECT 1", duration, false, (error as Error).message)
    connectionFailed = true
    return false
  }
}

// Типы для параметров запросов (включая массивы)
export type QueryParam = string | number | boolean | null | undefined | QueryParam[]

// Улучшенная типизация для executeQuery
export async function executeQuery<T extends QueryResultRow = QueryResultRow>(
  query: string,
  params: QueryParam[] = []
): Promise<QueryResult<T>> {
  const startTime = Date.now()
  
  // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Проверяем connection exhaustion перед выполнением запроса
  const db = getPool()
  if (db.totalCount >= (db.options.max || 5) && db.waitingCount > 2) {
    logger.warn('Connection pool near exhaustion - rejecting request for graceful degradation', {
      totalCount: db.totalCount,
      idleCount: db.idleCount,
      waitingCount: db.waitingCount,
      maxConnections: db.options.max
    })
    throw new Error('Service temporarily unavailable - connection pool exhausted')
  }
  
  // Автоматический прогрев при первом запросе
  if (!connectionWarmed) {
    await warmConnection().catch(() => {}) // Игнорируем ошибки прогрева
  }
  
  try {

    // Log connection pool status
    logger.info('Database query starting', {
      query: query.substring(0, 100) + '...',
      paramsCount: params?.length || 0,
      poolTotalCount: db.totalCount,
      poolIdleCount: db.idleCount,
      poolWaitingCount: db.waitingCount
    })

    const result = await db.query<T>(query, params)
    const duration = Date.now() - startTime
    connectionFailed = false

    // Логируем медленные запросы для мониторинга
    const logLevel = duration > 1000 ? 'warn' : duration > 500 ? 'info' : 'debug';
    logger[logLevel]('Database query completed', {
      query: query.substring(0, 100) + '...',
      duration,
      rowCount: result.rowCount,
      poolTotalCount: db.totalCount,
      poolIdleCount: db.idleCount,
      poolWaitingCount: db.waitingCount,
      isSlowQuery: duration > 500
    })

    logger.dbQuery(query, params, duration)
    performanceMonitor.recordQuery(query, duration, true)

    return result
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = (error as Error).message
    const db = getPool()

    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Обработка connection timeout
    if (errorMessage.includes('timeout exceeded when trying to connect') || errorMessage.includes('Connection terminated')) {
      logger.error('Connection pool exhaustion detected - force reset', {
        poolTotalCount: db.totalCount,
        poolIdleCount: db.idleCount,
        poolWaitingCount: db.waitingCount,
        error: errorMessage
      })
      
      // Принудительно сбрасываем состояние ошибки
      connectionFailed = false
    }

    logger.error('Database query error', {
      error: error,
      query: query.substring(0, 100) + '...',
      params: params?.length || 0,
      duration,
      poolTotalCount: db.totalCount,
      poolIdleCount: db.idleCount,
      poolWaitingCount: db.waitingCount,
      errorCode: (error as any).code,
      errorMessage: errorMessage
    }, 'DB')

    logger.dbError(query, error as Error, params)
    performanceMonitor.recordQuery(query, duration, false, errorMessage)
    connectionFailed = true
    throw error
  }
}

// Legacy alias used in routes (synchronous)
export const isDatabaseAvailable = isDatabaseAvailableSync;

// Connection warming for cold start optimization
let connectionWarmed = false
export async function warmConnection(): Promise<boolean> {
  if (connectionWarmed) return true
  
  try {
    const db = getPool()
    
    // Pre-warm the connection pool with multiple queries
    await db.query('SELECT 1 as warmup')
    await db.query('SELECT NOW() as server_time') 
    await db.query('SELECT version() as pg_version')
    
    connectionWarmed = true
    connectionFailed = false
    
    logger.info('Database connections warmed successfully', {
      poolSize: db.totalCount,
      idleConnections: db.idleCount,
      waitingClients: db.waitingCount
    })
    
    return true
  } catch (error) {
    logger.error('Failed to warm database connection', { error: error.message })
    connectionFailed = true
    return false
  }
}

// Проверяем статус прогрева
export function isConnectionWarmed(): boolean {
  return connectionWarmed && !connectionFailed
}

// Asynchronous deep health-check (can be used in cron/monitoring)
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const db = getPool()
    await db.query("SELECT 1")
    return true
  } catch (error) {
    logger.error("Database health check failed", error)
    return false
  }
}

// Graceful shutdown (useful for tests / Vercel edge)
export async function closePool() {
  stopKeepAlive() // Останавливаем keepalive пинги
  if (_pool) {
    await _pool.end()
    _pool = null
    logger.info("Database pool closed")
  }
}

// Get performance metrics
export function getDatabaseMetrics() {
  return performanceMonitor.getMetrics()
}

// Get performance report
export function getDatabaseReport(): string {
  return performanceMonitor.generateReport()
}

// Database service interface for backward compatibility
export interface DbSiteSettings {
  id: number
  site_name: string
  site_description: string | null
  hero_title: string | null
  hero_subtitle: string | null
  hero_cta: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  social_links: any
  created_at: string
  updated_at: string
}

export interface DbCategory {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DbFeature {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DatabaseProduct {
  id: number
  name: string
  category_id: number
  description: string | null
  image_url: string | null
  images: string | null
  weight: string | null
  battery_life: string | null
  warranty: string | null
  in_stock: boolean
  materials?: string[]
  features?: string[]
  category_name?: string
  created_at: Date
  updated_at: Date
}

// Экспорт для совместимости
export const db = getPool()

// КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Создаем константу pool для экспорта
const poolInstance = getPool()
export { poolInstance as pool }
