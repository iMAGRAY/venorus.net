import { NextResponse } from 'next/server'
import { pool } from '@/lib/database/db-connection'
import { logger } from '@/lib/logger'
import { getCacheManager } from '@/lib/dependency-injection'

/**
 * Warmup endpoint для прогрева соединений и кэшей
 * Может быть вызван при старте приложения или периодически
 */
export async function GET() {
  const startTime = Date.now()
  const results = {
    database: false,
    redis: false,
    cache: false,
    totalTime: 0
  }
  
  try {
    logger.info('Starting application warmup...')
    
    // 1. Прогрев БД соединения
    try {
      await pool.query('SELECT 1 as warmup_test')
      await pool.query('SELECT COUNT(*) FROM products LIMIT 1')
      results.database = true
      logger.debug('Database warmed up successfully')
    } catch (error) {
      logger.warn('Database warmup failed', { error: error.message })
    }
    
    // 2. Прогрев Redis/кэша
    try {
      const cacheManager = getCacheManager()
      // Тестируем кэш
      const testKey = `warmup:${Date.now()}`
      cacheManager.set(testKey, 'test', 1000)
      const testValue = cacheManager.get(testKey)
      if (testValue === 'test') {
        results.cache = true
        logger.debug('Cache warmed up successfully')
      }
    } catch (error) {
      logger.warn('Cache warmup failed', { error: error.message })
    }
    
    // 3. Прогрев основных таблиц (предварительные запросы)
    try {
      const warmupQueries = [
        'SELECT EXISTS (SELECT 1 FROM products LIMIT 1)',
        'SELECT EXISTS (SELECT 1 FROM manufacturers LIMIT 1)',
        'SELECT EXISTS (SELECT 1 FROM product_categories LIMIT 1)'
      ]
      
      await Promise.all(
        warmupQueries.map(query => 
          pool.query(query).catch(err => 
            logger.debug(`Warmup query failed: ${query}`, { error: err.message })
          )
        )
      )
    } catch (error) {
      logger.warn('Table warmup failed', { error: error.message })
    }
    
    results.totalTime = Date.now() - startTime
    
    // Устанавливаем кэш прогрева на 5 минут
    try {
      const cacheManager = getCacheManager()
      cacheManager.set('app:warmed', true, 300000) // 5 минут
    } catch {}
    
    logger.info('Application warmup completed', results)
    
    return NextResponse.json({
      success: true,
      message: 'Application warmed up successfully',
      results,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    results.totalTime = Date.now() - startTime
    logger.error('Application warmup failed', { error: error.message, results })
    
    return NextResponse.json({
      success: false,
      message: 'Application warmup failed',
      error: error.message,
      results,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// POST для принудительного прогрева (если нужно)
export async function POST() {
  return GET() // Просто вызываем GET
}