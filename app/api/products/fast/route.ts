import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database/db-connection'
import { logger } from '@/lib/logger'
import { cacheRemember, cacheKeys, CACHE_TTL } from '@/lib/cache/cache-utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Супер-быстрый endpoint для получения списка продуктов (только essential поля)
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const categoryId = searchParams.get('category_id')
    const nocache = searchParams.get('nocache') === 'true'
    
    const cacheKey = cacheKeys.productList({ fast: true, limit, offset, categoryId })
    
    const fetchProducts = async () => {
      let whereConditions = ['(p.is_deleted = false OR p.is_deleted IS NULL)']
      let queryParams: any[] = []
      let paramCounter = 1
      
      if (categoryId) {
        whereConditions.push(`p.category_id = $${paramCounter}`)
        queryParams.push(parseInt(categoryId))
        paramCounter++
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
      
      // Минимальный набор полей для максимальной скорости
      const query = `
        SELECT 
          p.id,
          p.name,
          p.price,
          p.discount_price,
          p.image_url,
          p.in_stock,
          p.stock_quantity,
          p.category_id,
          COALESCE(p.discount_price, p.price) as effective_price,
          -- Быстрый подсчет вариантов без JOIN
          (SELECT COUNT(*) FROM product_variants pv 
           WHERE pv.master_id = p.id 
           AND pv.is_active = true 
           AND (pv.is_deleted = false OR pv.is_deleted IS NULL)
          ) > 0 as has_variants
        FROM products p
        ${whereClause}
        ORDER BY p.created_at DESC
        LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
      `
      
      queryParams.push(limit, offset)
      
      const result = await executeQuery(query, queryParams)
      
      // Минимальная обработка данных
      const products = result.rows.map(row => ({
        id: row.id,
        name: row.name,
        price: row.price ? parseFloat(row.price) : null,
        discountPrice: row.discount_price ? parseFloat(row.discount_price) : null,
        effectivePrice: row.effective_price ? parseFloat(row.effective_price) : null,
        imageUrl: row.image_url,
        inStock: row.in_stock,
        stockQuantity: row.stock_quantity,
        categoryId: row.category_id,
        hasVariants: row.has_variants
      }))
      
      const duration = Date.now() - startTime
      
      logger.info('Fast products loaded', { 
        count: products.length, 
        duration,
        cached: false
      })
      
      return {
        success: true,
        data: products,
        count: products.length,
        duration,
        cached: false
      }
    }
    
    let responseData
    if (nocache) {
      responseData = await fetchProducts()
    } else {
      responseData = await cacheRemember(
        cacheKey,
        CACHE_TTL.MEDIUM, // 1 час кэш для быстрых запросов
        fetchProducts,
        'product'
      )
      // Добавляем информацию о кэше
      responseData.cached = true
      responseData.duration = Date.now() - startTime
    }
    
    return NextResponse.json(responseData)
    
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Fast products API error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch products',
      duration,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}