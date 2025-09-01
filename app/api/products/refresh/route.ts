import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database/db-connection'
import { logger } from '@/lib/logger'
import { getCacheManager } from '@/lib/dependency-injection'
import { invalidateCache as invalidateApiCache } from '@/lib/cache/cache-middleware'
import { invalidateCache, cachePatterns } from '@/lib/cache/cache-utils'

async function clearProductsCache(): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = []
  let apiCacheCleared = false
  let unifiedCacheCleared = false

  // Try API cache invalidation with fallback
  try {
    await invalidateApiCache.products()
    apiCacheCleared = true
    logger.debug('API cache cleared for products')
  } catch (apiError) {
    const errorMsg = apiError instanceof Error ? apiError.message : 'Unknown API cache error'
    errors.push(`API cache: ${errorMsg}`)
    logger.warn('Failed to clear API cache, continuing with unified cache', { error: errorMsg })
  }

  // Try unified cache invalidation with selective patterns
  try {
    const patterns = [
      cachePatterns.allProducts,
      cachePatterns.searchResults,
      'api:products:*'
    ]
    await invalidateCache(patterns)
    unifiedCacheCleared = true
    logger.debug('Unified cache cleared for products')
  } catch (unifiedError) {
    const errorMsg = unifiedError instanceof Error ? unifiedError.message : 'Unknown unified cache error'
    errors.push(`Unified cache: ${errorMsg}`)
    logger.warn('Failed to clear unified cache', { error: errorMsg })
  }

  const success = apiCacheCleared || unifiedCacheCleared
  if (success) {
    logger.info('Products cache cleared successfully', { 
      apiCacheCleared, 
      unifiedCacheCleared, 
      errorsCount: errors.length 
    })
  } else {
    logger.error('Failed to clear any cache layers', { errors })
  }

  return { success, errors }
}

async function fetchLatestProducts() {
  const query = `
    SELECT
      p.*,
      ms.name as model_line_name,
      m.name as manufacturer_name,
      pc.name as category_name
    FROM products p
    LEFT JOIN model_series ms ON p.series_id = ms.id
    LEFT JOIN manufacturers m ON p.manufacturer_id = m.id
    LEFT JOIN product_categories pc ON p.category_id = pc.id
    WHERE (p.is_deleted = false OR p.is_deleted IS NULL)
    ORDER BY p.created_at DESC
  `
  
  const result = await executeQuery(query)
  return result.rows
}

export async function POST(_request: NextRequest) {
  const cacheManager = getCacheManager()

  try {
    logger.info('Forcing products cache refresh')

    // Очищаем кеш продуктов с fallback логикой
    const cacheResult = await clearProductsCache()
    
    // Если кеш полностью не очистился, логируем предупреждение но продолжаем
    if (!cacheResult.success) {
      logger.warn('Cache clearing failed completely, proceeding with data refresh', { 
        errors: cacheResult.errors 
      })
    }

    // Получаем актуальные данные
    const products = await fetchLatestProducts()

    const responseData = {
      success: true,
      count: products.length,
      data: products,
      cache_refreshed: cacheResult.success,
      cache_warnings: cacheResult.errors.length > 0 ? cacheResult.errors : undefined
    }

    // Кэшируем обновленные данные
    try {
      const cacheKey = 'products:refresh:latest'
      cacheManager.set(cacheKey, responseData, 5 * 60 * 1000) // 5 минут
    } catch (cacheError) {
      logger.warn('Failed to cache refreshed data', cacheError)
      // Не блокируем ответ если не можем закешировать
    }

    logger.info('Products refreshed successfully', { 
      count: products.length,
      cacheCleared: cacheResult.success,
      cacheErrors: cacheResult.errors.length
    })

    return NextResponse.json(responseData)

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Failed to refresh products:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to refresh products',
        message: errorMsg
      },
      { status: 500 }
    )
  }
}