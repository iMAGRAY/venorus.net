import { NextRequest, NextResponse } from 'next/server'
import { getCacheStats } from '@/lib/cache/cache-utils'
import { unifiedCache } from '@/lib/cache/unified-cache'
import { logger } from '@/lib/logger'

// GET /api/cache-status - получить статус unified cache и статистику
export async function GET(_request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Проверяем существование unifiedCache
    if (!unifiedCache || typeof unifiedCache.set !== 'function') {
      return NextResponse.json({
        success: false,
        error: 'Unified cache is not properly initialized',
        status: 'not_initialized',
        timestamp: new Date().toISOString()
      }, { status: 503 })
    }

    // Проверяем подключение к unified cache с уникальным ключом
    const randomId = Math.random().toString(36).substring(2)
    const cacheTestKey = `cache_status_test_${Date.now()}_${randomId}`
    const cacheTestValue = { test: true, timestamp: startTime, id: randomId }
    
    let isConnected = false
    let connectionLatency = -1
    let connectionError: string | null = null
    
    try {
      const testStart = Date.now()
      await unifiedCache.set(cacheTestKey, cacheTestValue, { ttl: 5000 }) // 5 секунд TTL
      const retrieved = await unifiedCache.get(cacheTestKey)
      await unifiedCache.delete(cacheTestKey)
      
      // Строгая валидация полученных данных
      let parsedData = null
      
      if (retrieved !== null && retrieved !== undefined) {
        if (typeof retrieved === 'object' && !Array.isArray(retrieved)) {
          parsedData = retrieved
        } else if (typeof retrieved === 'string') {
          try {
            const parsed = JSON.parse(retrieved)
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              parsedData = parsed
            }
          } catch (parseError) {
            logger.warn('Failed to parse cache test data', { error: parseError.message })
          }
        }
      }
      
      // Проверяем точную структуру ожидаемых данных
      if (parsedData && 
          parsedData.test === true && 
          parsedData.id === randomId &&
          typeof parsedData.timestamp === 'number') {
        isConnected = true
        connectionLatency = Date.now() - testStart
      }
    } catch (testError) {
      connectionError = testError instanceof Error ? testError.message : 'Unknown test error'
      logger.warn('Unified cache connectivity test failed', { error: connectionError })
    }
    
    if (!isConnected) {
      return NextResponse.json({
        success: false,
        error: 'Unified cache is not connected',
        status: 'disconnected',
        connectionError,
        timestamp: new Date().toISOString()
      }, { status: 503 })
    }

    // Получаем статистику unified cache
    const cacheStats = await getCacheStats()
    
    // Получаем метрики unified cache
    const cacheMetrics = unifiedCache.getMetrics()
    
    // Получаем общую статистику unified cache
    const cacheInfo = unifiedCache.getStats()
    
    // Получаем безопасную статистику ключей (без раскрытия содержимого)
    const keyStats: Record<string, number> = {}
    const keyPatterns = [
      'product:*',
      'products:*', 
      'category:*',
      'categories:*',
      'page:*',
      'api:*',
      'media:*',
      'search:*'
      // Исключаем cart:* для безопасности пользователей
    ]
    
    try {
      for (const pattern of keyPatterns) {
        const keys = await unifiedCache.getKeysByPattern(pattern)
        const patternType = pattern.split(':')[0]
        keyStats[patternType] = keys.length
      }
    } catch (keysError) {
      logger.warn('Failed to get key stats from unified cache', { error: keysError.message })
    }

    // Быстрая проверка доступности операций (без тяжелых тестов)
    const basicOperationsTest = await testBasicOperations()
    
    const responseTime = Date.now() - startTime
    
    return NextResponse.json({
      success: true,
      data: {
        connection: {
          connected: isConnected,
          latency: connectionLatency,
          responseTime,
          error: connectionError
        },
        cache: {
          type: 'unified',
          stats: cacheStats,
          metrics: cacheMetrics,
          info: cacheInfo
        },
        keyStats,
        operations: basicOperationsTest,
        features: {
          unifiedCaching: true,
          namespaceVersioning: true,
          ttlJitter: true,
          singleflightPattern: true,
          negativeCaching: true,
          swrCaching: true,
          cacheInvalidation: true,
          securityValidation: true,
          metricsAndMonitoring: true
        },
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    const responseTime = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    
    logger.error('Failed to get unified cache status', { error: errorMsg, responseTime })
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get unified cache status',
      details: errorMsg,
      responseTime,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Быстрое тестирование основных операций кеша
async function testBasicOperations(): Promise<{
  set: boolean
  get: boolean
  delete: boolean
  errors: string[]
}> {
  const errors: string[] = []
  let setWorking = false
  let getWorking = false
  let deleteWorking = false
  
  try {
    const testKey = `basic_test_${Date.now()}`
    const testData = { test: 'basic_operations' }
    
    // Test SET operation
    try {
      await unifiedCache.set(testKey, testData, { ttl: 5000 })
      setWorking = true
    } catch (setError) {
      errors.push(`SET operation failed: ${setError instanceof Error ? setError.message : 'Unknown error'}`)
    }
    
    // Test GET operation with safe validation
    try {
      const retrieved = await unifiedCache.get(testKey)
      let parsedData = null
      
      if (retrieved !== null && retrieved !== undefined) {
        if (typeof retrieved === 'object' && !Array.isArray(retrieved)) {
          parsedData = retrieved
        } else if (typeof retrieved === 'string') {
          try {
            const parsed = JSON.parse(retrieved)
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              parsedData = parsed
            }
          } catch (parseError) {
            errors.push(`Failed to parse retrieved data: ${parseError.message}`)
          }
        }
      }
      
      if (parsedData && parsedData.test === 'basic_operations') {
        getWorking = true
      } else {
        errors.push('GET operation returned incorrect or invalid data')
      }
    } catch (getError) {
      errors.push(`GET operation failed: ${getError instanceof Error ? getError.message : 'Unknown error'}`)
    }
    
    // Test DELETE operation
    try {
      const deleted = await unifiedCache.delete(testKey)
      if (deleted) {
        deleteWorking = true
      } else {
        errors.push('DELETE operation returned false')
      }
    } catch (deleteError) {
      errors.push(`DELETE operation failed: ${deleteError instanceof Error ? deleteError.message : 'Unknown error'}`)
    }
    
  } catch (testError) {
    errors.push(`Basic operations test setup failed: ${testError instanceof Error ? testError.message : 'Unknown error'}`)
  }
  
  return { set: setWorking, get: getWorking, delete: deleteWorking, errors }
}