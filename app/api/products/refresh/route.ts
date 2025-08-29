import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db-connection'
import { logger } from '@/lib/logger'
import { getCacheManager } from '@/lib/dependency-injection'
import { invalidateCache } from '@/lib/cache/cache-middleware'

async function clearProductsCache(): Promise<void> {
  try {
    // Очищаем через унифицированную систему
    await invalidateCache.products()
    
    // Очищаем дополнительные паттерны для совместимости
    try {
      const { redisClient } = await import('@/lib/redis-client')
      await redisClient.flushPattern('products-*')
      await redisClient.flushPattern('product-*')
      await redisClient.flushPattern('medsip:products-*')
      logger.info('Legacy Redis cache cleared for products')
    } catch (redisError) {
      const errorMsg = redisError instanceof Error ? redisError.message : 'Unknown Redis error'
      logger.warn('Failed to clear legacy Redis cache', { error: errorMsg })
    }
    
    logger.info('Products cache cleared successfully')
  } catch (cacheError) {
    const errorMsg = cacheError instanceof Error ? cacheError.message : 'Unknown cache error'
    logger.warn('Failed to clear cache', { error: errorMsg })
  }
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

    // Очищаем кеш продуктов
    await clearProductsCache()

    // Получаем актуальные данные
    const products = await fetchLatestProducts()

    const responseData = {
      success: true,
      count: products.length,
      data: products,
      cache_refreshed: true
    }

    // Кэшируем обновленные данные
    const cacheKey = 'products:refresh:latest'
    cacheManager.set(cacheKey, responseData, 5 * 60 * 1000) // 5 минут

    logger.info('Products refreshed successfully', { count: products.length })

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