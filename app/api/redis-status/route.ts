import { NextRequest, NextResponse } from 'next/server'
import { unifiedCache } from '@/lib/cache/unified-cache'
import { getCacheStats } from '@/lib/cache/cache-utils'
import { logger } from '@/lib/logger'

// GET /api/redis-status - теперь unified-cache-status
export async function GET(_request: NextRequest) {
  try {
    const startTime = Date.now()

    // Проверяем доступность unified cache
    const isConnected = await testUnifiedCacheConnection()

    if (!isConnected.success) {
      return NextResponse.json({
        success: false,
        error: 'Unified cache is not available',
        details: isConnected.error,
        timestamp: new Date().toISOString()
      }, { status: 503 })
    }

    // Получаем статистику unified cache
    const cacheStats = await getCacheStats()
    const cacheMetrics = unifiedCache.getMetrics()
    const cacheInfo = unifiedCache.getStats()

    // Получаем информацию о ключах по типам (без раскрытия содержимого)
    const keyStatsByType = await getKeyStatsByType()

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      cache: {
        type: 'unified',
        connected: isConnected.success,
        latency: isConnected.latency,
        responseTime
      },
      stats: cacheStats,
      metrics: cacheMetrics,
      info: cacheInfo,
      keyStats: keyStatsByType,
      features: {
        unifiedCaching: true,
        namespaceVersioning: true,
        ttlJitter: true,
        singleflightPattern: true,
        negativeCaching: true,
        swrCaching: true,
        tagBasedInvalidation: true,
        securityValidation: true
      },
      operations: [
        'GET /api/redis-status - Get unified cache status',
        'POST /api/redis-status - Manage cache operations',
        'DELETE /api/redis-status - Clear cache'
      ],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Failed to get unified cache status', { error: errorMsg })
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get unified cache status',
      details: errorMsg,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// POST /api/redis-status - Управление unified cache
export async function POST(request: NextRequest) {
  try {
    // Validate request body exists and is valid JSON
    let body: any
    try {
      body = await request.json()
    } catch (jsonError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid JSON in request body',
        details: jsonError instanceof Error ? jsonError.message : 'JSON parsing failed'
      }, { status: 400 })
    }

    // Validate body is an object
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({
        success: false,
        error: 'Request body must be a valid JSON object'
      }, { status: 400 })
    }

    // Safely destructure with validation
    const { action, key, data, ttl, tags } = body

    // Validate required action parameter
    if (!action || typeof action !== 'string' || action.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Action parameter is required and must be a non-empty string'
      }, { status: 400 })
    }

    // Sanitize action parameter
    const validActions = ['set', 'get', 'delete', 'test']
    if (!validActions.includes(action)) {
      return NextResponse.json({
        success: false,
        error: `Invalid action. Allowed actions: ${validActions.join(', ')}`
      }, { status: 400 })
    }

    switch (action) {
      case 'set':
        if (!key || data === undefined) {
          return NextResponse.json({
            success: false,
            error: 'Parameters required: key, data'
          }, { status: 400 })
        }

        const setOptions = {
          ttl: typeof ttl === 'number' ? ttl * 1000 : 300000, // Default 5 minutes
          tags: Array.isArray(tags) ? tags : ['manual']
        }

        try {
          await unifiedCache.set(key, data, setOptions)
          logger.info('Manual cache set operation', { key, ttl: setOptions.ttl, tags: setOptions.tags })
          
          return NextResponse.json({
            success: true,
            action: 'set',
            key,
            ttl: setOptions.ttl / 1000,
            tags: setOptions.tags,
            timestamp: new Date().toISOString()
          })
        } catch (setError) {
          const errorMsg = setError instanceof Error ? setError.message : 'Set operation failed'
          logger.error('Cache set operation failed', { key, error: errorMsg })
          
          return NextResponse.json({
            success: false,
            error: 'Set operation failed',
            details: errorMsg
          }, { status: 500 })
        }

      case 'get':
        if (!key) {
          return NextResponse.json({
            success: false,
            error: 'Key parameter is required'
          }, { status: 400 })
        }

        try {
          const cachedData = await unifiedCache.get(key)
          const exists = cachedData !== null && cachedData !== undefined
          
          return NextResponse.json({
            success: true,
            action: 'get',
            key,
            exists,
            data: exists ? cachedData : null,
            timestamp: new Date().toISOString()
          })
        } catch (getError) {
          const errorMsg = getError instanceof Error ? getError.message : 'Get operation failed'
          logger.error('Cache get operation failed', { key, error: errorMsg })
          
          return NextResponse.json({
            success: false,
            error: 'Get operation failed',
            details: errorMsg
          }, { status: 500 })
        }

      case 'delete':
        if (!key) {
          return NextResponse.json({
            success: false,
            error: 'Key parameter is required'
          }, { status: 400 })
        }

        try {
          const deleted = await unifiedCache.delete(key)
          logger.info('Manual cache delete operation', { key, deleted })
          
          return NextResponse.json({
            success: true,
            action: 'delete',
            key,
            deleted,
            timestamp: new Date().toISOString()
          })
        } catch (deleteError) {
          const errorMsg = deleteError instanceof Error ? deleteError.message : 'Delete operation failed'
          logger.error('Cache delete operation failed', { key, error: errorMsg })
          
          return NextResponse.json({
            success: false,
            error: 'Delete operation failed',
            details: errorMsg
          }, { status: 500 })
        }

      case 'test':
        const testResult = await testUnifiedCacheConnection()
        return NextResponse.json({
          success: true,
          action: 'test',
          result: testResult,
          timestamp: new Date().toISOString()
        })

      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown action. Available: set, get, delete, test'
        }, { status: 400 })
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Redis-status POST operation failed', { error: errorMsg })
    
    return NextResponse.json({
      success: false,
      error: 'Operation failed',
      details: errorMsg
    }, { status: 500 })
  }
}

// DELETE /api/redis-status - Очистить unified cache
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pattern = searchParams.get('pattern')
    const tags = searchParams.get('tags')
    const clearAll = searchParams.get('all') === 'true'

    if (clearAll) {
      // Полная очистка unified cache
      try {
        await unifiedCache.clear()
        logger.warn('Full unified cache cleared via API')
        
        return NextResponse.json({
          success: true,
          action: 'clear_all',
          message: 'All unified cache cleared',
          timestamp: new Date().toISOString()
        })
      } catch (clearError) {
        const errorMsg = clearError instanceof Error ? clearError.message : 'Clear operation failed'
        logger.error('Full cache clear failed', { error: errorMsg })
        
        return NextResponse.json({
          success: false,
          error: 'Clear operation failed',
          details: errorMsg
        }, { status: 500 })
      }
    }

    if (pattern) {
      // Очистка по паттерну
      try {
        const keys = await unifiedCache.getKeysByPattern(pattern)
        let deleted = 0
        
        for (const key of keys) {
          const result = await unifiedCache.delete(key)
          if (result) deleted++
        }
        
        logger.info('Pattern-based cache clear', { pattern, deleted, total: keys.length })
        
        return NextResponse.json({
          success: true,
          action: 'clear_pattern',
          pattern,
          deletedKeys: deleted,
          totalKeys: keys.length,
          timestamp: new Date().toISOString()
        })
      } catch (patternError) {
        const errorMsg = patternError instanceof Error ? patternError.message : 'Pattern clear failed'
        logger.error('Pattern cache clear failed', { pattern, error: errorMsg })
        
        return NextResponse.json({
          success: false,
          error: 'Pattern clear failed',
          details: errorMsg
        }, { status: 500 })
      }
    }

    if (tags) {
      // Очистка по тегам
      try {
        const tagList = tags.split(',').map(tag => tag.trim()).filter(Boolean)
        await unifiedCache.invalidateByTags(tagList)
        
        logger.info('Tag-based cache invalidation', { tags: tagList })
        
        return NextResponse.json({
          success: true,
          action: 'invalidate_tags',
          tags: tagList,
          message: 'Cache invalidated by tags',
          timestamp: new Date().toISOString()
        })
      } catch (tagsError) {
        const errorMsg = tagsError instanceof Error ? tagsError.message : 'Tag invalidation failed'
        logger.error('Tag cache invalidation failed', { tags, error: errorMsg })
        
        return NextResponse.json({
          success: false,
          error: 'Tag invalidation failed',
          details: errorMsg
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Required parameter: pattern, tags, or all=true'
    }, { status: 400 })

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Cache delete operation failed', { error: errorMsg })
    
    return NextResponse.json({
      success: false,
      error: 'Delete operation failed',
      details: errorMsg
    }, { status: 500 })
  }
}

// Вспомогательные функции
interface CacheTestData {
  test: boolean
  timestamp: number
}

function isCacheTestData(obj: unknown): obj is CacheTestData {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    !Array.isArray(obj) &&
    'test' in obj &&
    'timestamp' in obj &&
    typeof (obj as any).test === 'boolean' &&
    typeof (obj as any).timestamp === 'number'
  )
}

async function testUnifiedCacheConnection(): Promise<{ success: boolean; latency: number; error?: string }> {
  try {
    const testStart = Date.now()
    const testKey = `connection_test_${Date.now()}_${Math.random().toString(36).substring(2)}`
    const testData: CacheTestData = { test: true, timestamp: testStart }
    
    await unifiedCache.set(testKey, testData, { ttl: 5000 })
    const retrieved = await unifiedCache.get(testKey)
    await unifiedCache.delete(testKey)
    
    const latency = Date.now() - testStart
    
    // Проверяем корректность данных с proper типизацией
    let isValid = false
    if (retrieved !== null && retrieved !== undefined) {
      if (isCacheTestData(retrieved) && retrieved.test === true) {
        isValid = true
      } else if (typeof retrieved === 'string') {
        try {
          const parsed = JSON.parse(retrieved)
          if (isCacheTestData(parsed) && parsed.test === true) {
            isValid = true
          }
        } catch (parseError) {
          logger.warn('Cache connection test: failed to parse string response', { retrieved })
        }
      }
    }
    
    return {
      success: isValid,
      latency,
      error: isValid ? undefined : `Data integrity check failed - expected test object, got: ${typeof retrieved}`
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Connection test failed'
    logger.error('Cache connection test failed', { error: errorMsg })
    
    return {
      success: false,
      latency: -1,
      error: errorMsg
    }
  }
}

async function getKeyStatsByType(): Promise<Record<string, number>> {
  const keyTypes = ['product', 'products', 'category', 'categories', 'page', 'api', 'media', 'search']
  const stats: Record<string, number> = {}
  
  try {
    for (const type of keyTypes) {
      try {
        const keys = await unifiedCache.getKeysByPattern(`${type}:*`)
        stats[type] = keys.length
      } catch (typeError) {
        logger.warn(`Failed to get key stats for type: ${type}`, { error: typeError.message })
        stats[type] = 0
      }
    }
  } catch (error) {
    logger.error('Failed to get key stats by type', { error: error.message })
  }
  
  return stats
}