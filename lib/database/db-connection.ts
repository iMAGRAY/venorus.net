import { Pool, PoolConfig, QueryResult, QueryResultRow } from "pg"
import { logger } from "../logger"
import { performanceMonitor } from "../performance-monitor"
import { getSSLConfig, SSLConfig } from "./ssl-config"

// Singleton Pool instance
let _pool: Pool | null = null

// Add legacy synchronous availability flag for existing routes
let connectionFailed = false
let connectionInitialized = false
let lastDbErrorLogTime = 0
let dbReconnectAttempts = 0
let lastDbReconnectTime = 0
const MAX_DB_RECONNECT_ATTEMPTS = 5
const DB_RECONNECT_BASE_DELAY = 2000 // 2 seconds base delay

// Reconnection function with exponential backoff
async function tryReconnectDb(): Promise<void> {
  const now = Date.now()
  
  // Don't try to reconnect too frequently
  if (now - lastDbReconnectTime < DB_RECONNECT_BASE_DELAY) {
    return
  }
  
  if (dbReconnectAttempts >= MAX_DB_RECONNECT_ATTEMPTS) {
    logger.error('Max DB reconnect attempts reached, giving up')
    return
  }
  
  dbReconnectAttempts++
  lastDbReconnectTime = now
  
  const delay = DB_RECONNECT_BASE_DELAY * Math.pow(2, dbReconnectAttempts - 1)
  
  logger.info(`Attempting DB reconnection ${dbReconnectAttempts}/${MAX_DB_RECONNECT_ATTEMPTS} in ${delay}ms`)
  
  setTimeout(async () => {
    try {
      // Recreate connection pool with proper initialization
      if (_pool) {
        await _pool.end()
        _pool = null
      }
      // Use getPool() for proper initialization of all event handlers
      _pool = null // Reset so getPool() creates new pool
      getPool() // Creates new pool with proper event handlers
      logger.info('Database pool recreated successfully')
    } catch (error) {
      logger.error('Failed to recreate database pool', error)
    }
  }, delay)
}


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

  // Special configuration for build time - limit connections
  const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build'
  
  const config: PoolConfig = {
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST || process.env.POSTGRESQL_HOST || "localhost",
    port: Number(process.env.DB_PORT || process.env.POSTGRESQL_PORT || 5432),
    user: process.env.DB_USER || process.env.POSTGRESQL_USER || "postgres",
    password: process.env.DB_PASSWORD || process.env.POSTGRESQL_PASSWORD || "",
    database: process.env.DB_NAME || process.env.POSTGRESQL_DBNAME || "medsip_protez",
    // OPTIMIZED: Settings for remote cloud DB with high latency
    max: isBuildTime ? 2 : 15, // Increased to 15 to compensate for latency
    min: isBuildTime ? 1 : 5,  // Minimum 5 connections for quick response
    idleTimeoutMillis: 300_000, // 5 minute idle timeout (increased for stability)
    connectionTimeoutMillis: 15_000, // 15 seconds connection timeout (increased for cloud DB)
    query_timeout: 30_000, // 30 second query timeout
    statement_timeout: 30_000, // 30 second statement timeout
    keepAlive: true, // Enable keepAlive
    keepAliveInitialDelayMillis: 5_000, // Start keepAlive after 5 seconds
    allowExitOnIdle: false, // Prevent pool closure on idle
    
    // Additional settings for cloud DB stability
    application_name: 'venorus_web_app', // Application identification
    
    // SSL settings for cloud databases
    ssl: getSSLConfig(),  // Using imported ssl-config module
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
      const now = Date.now()
      // Log DB errors no more than once every 10 seconds
      if (now - lastDbErrorLogTime > 10000) {
        logger.error("PostgreSQL Pool error", err)
        lastDbErrorLogTime = now
      }
      
      // Handle idle-session timeout specially
      if (err.message?.includes('idle-session timeout') || (err as any).code === '57P05') {
        if (now - lastDbErrorLogTime > 10000) {
          logger.warn('Idle session timeout detected, connection will be recreated automatically')
        }
        connectionFailed = false // Don't consider this a critical error
      } else {
        connectionFailed = true
        // Пытаемся переподключиться с exponential backoff
        tryReconnectDb()
      }
    })
    
    _pool.on("connect", (client) => {
      logger.debug("New database connection established")
      connectionFailed = false
      connectionInitialized = true
      dbReconnectAttempts = 0 // Reset counter on successful connection
      startKeepAlive() // Start keepalive pings
      
      // Set keep-alive at connection level
      client.query('SET application_name = $1', ['venorus_web_app']).catch(() => {})
    })
    
    // Handle connection removal
    _pool.on("remove", () => {
      logger.debug("Database connection removed from pool")
    })
    
    // CRITICAL FIX: Immediately try to establish a connection
    // This ensures connectionInitialized gets set early
    _pool.query('SELECT 1 as init').then(() => {
      connectionInitialized = true
      connectionFailed = false
      logger.info('Database pool initialized successfully')
    }).catch(err => {
      // If SSL error, try to provide more helpful message
      if (err.message?.includes('self-signed certificate')) {
        logger.error('Database SSL certificate validation failed. TWC Cloud requires special SSL handling.', err)
        // Still mark as initialized but failed so we can retry
        connectionInitialized = true
        connectionFailed = true
      } else {
        logger.error('Database pool initialization failed', err)
        connectionFailed = true
      }
    })
  }
  return _pool
}

export function isDatabaseAvailableSync(): boolean {
  // CRITICAL FIX: Consider pool created as initialized to avoid blocking all requests
  // We'll handle actual connection failures during query execution
  if (!_pool) {
    return false // Pool not created yet
  }
  
  // Pool exists - allow requests through and let query execution handle errors
  return true
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
  }, 60_000) // Ping every 1 minute for remote DB
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
  connectionInitialized = false
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
  
  // CRITICAL FIX: Check connection exhaustion before executing query
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
  
  // Automatic warmup on first request
  if (!connectionWarmed) {
    await warmConnection().catch(() => {}) // Ignore warmup errors
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

    // Log slow queries for monitoring
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

    // CRITICAL FIX: Handle connection timeout
    if (errorMessage.includes('timeout exceeded when trying to connect') || errorMessage.includes('Connection terminated')) {
      logger.error('Connection pool exhaustion detected - force reset', {
        poolTotalCount: db.totalCount,
        poolIdleCount: db.idleCount,
        poolWaitingCount: db.waitingCount,
        error: errorMessage
      })
      
      // Force reset error state
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

// Check warmup status
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
  stopKeepAlive() // Stop keepalive pings
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

// Export for compatibility
export const db = getPool()

// CRITICAL FIX: Create pool constant for export
const poolInstance = getPool()
export { poolInstance as pool }
