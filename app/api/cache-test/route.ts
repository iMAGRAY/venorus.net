import { NextRequest, NextResponse } from 'next/server'
import { invalidateCache } from '@/lib/cache/cache-middleware'
import { unifiedCache } from '@/lib/cache/unified-cache'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Test endpoint для управления кешем (только для development)
 */
export async function POST(request: NextRequest) {
  // Только в development режиме
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    )
  }

  try {
    const { action, target } = await request.json()
    
    let result: { success: boolean; message: string; data?: any } = { success: false, message: '' }
    
    switch (action) {
      case 'invalidate':
        // Инвалидация по типу сущности
        switch (target) {
          case 'products':
            await invalidateCache.products()
            result = { success: true, message: 'Products cache invalidated' }
            break
          case 'categories':
            await invalidateCache.categories()
            result = { success: true, message: 'Categories cache invalidated' }
            break
          case 'manufacturers':
            await invalidateCache.manufacturers()
            result = { success: true, message: 'Manufacturers cache invalidated' }
            break
          case 'settings':
            await invalidateCache.settings()
            result = { success: true, message: 'Settings cache invalidated' }
            break
          case 'all':
            await invalidateCache.all()
            result = { success: true, message: 'All cache cleared' }
            break
          default:
            result = { success: false, message: `Unknown target: ${target}` }
        }
        break
        
      case 'stats':
        // Получение статистики кеша
        const stats = unifiedCache.getStats()
        result = { success: true, message: 'Cache stats retrieved', data: stats }
        break
        
      case 'clear':
        // Полная очистка кеша
        await unifiedCache.clear()
        result = { success: true, message: 'Cache completely cleared' }
        break
        
      default:
        result = { success: false, message: `Unknown action: ${action}` }
    }
    
    logger.info('Cache test action performed', { action, target, result })
    return NextResponse.json(result)
    
  } catch (error) {
    logger.error('Cache test endpoint error:', error)
    return NextResponse.json(
      { error: 'Failed to perform cache action', details: (error as any).message },
      { status: 500 }
    )
  }
}

// GET endpoint для получения статистики
export async function GET(_request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    )
  }
  
  try {
    const stats = unifiedCache.getStats()
    const metrics = unifiedCache.getMetrics()
    
    return NextResponse.json({
      success: true,
      stats,
      metrics,
      environment: process.env.NODE_ENV
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get cache stats', details: (error as any).message },
      { status: 500 }
    )
  }
}