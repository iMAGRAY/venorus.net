import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireAuth, hasPermission } from '@/lib/auth/database-auth'
import { unifiedCache } from '@/lib/cache/unified-cache'
import { getCacheStats } from '@/lib/cache/cache-utils'

// GET - получить значение из кеша
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return NextResponse.json(
        { error: 'Key parameter is required' },
        { status: 400 }
      )
    }

    const data = await unifiedCache.get(key)

    logger.debug('Cache GET request', { key, found: data !== null })

    return NextResponse.json({
      success: true,
      data,
      exists: data !== null
    })

  } catch (error) {
    logger.error('Cache GET API error', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - установить значение в кеш
export async function POST(request: NextRequest) {
  // Проверяем аутентификацию
  const session = await requireAuth(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Проверяем права доступа
  if (!hasPermission(session.user, 'cache.manage') &&
      !hasPermission(session.user, 'system.*') &&
      !hasPermission(session.user, '*')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  try {
    const { action, key, value, ttl } = await request.json()

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'Key and value are required' },
        { status: 400 }
      )
    }

    if (action === 'set') {
      await unifiedCache.set(key, value, { ttl: (ttl || 300) * 1000 }) // TTL в миллисекундах

      logger.debug('Cache SET request', { key, ttl: ttl || 300 })

      return NextResponse.json({
        success: true,
        message: 'Cache set successfully'
      })
    }

    if (action === 'stats') {
      const stats = await getCacheStats()
      return NextResponse.json({
        success: true,
        stats
      })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "set" or "stats"' },
      { status: 400 }
    )

  } catch (error) {
    logger.error('Cache POST API error', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - удалить значение из кеша
export async function DELETE(request: NextRequest) {
  // Проверяем аутентификацию
  const session = await requireAuth(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Проверяем права доступа
  if (!hasPermission(session.user, 'cache.manage') &&
      !hasPermission(session.user, 'system.*') &&
      !hasPermission(session.user, '*')) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  try {
    const { key, action } = await request.json()

    if (action === 'clear') {
      await unifiedCache.clear()
      logger.info('Cache cleared completely')

      return NextResponse.json({
        success: true,
        message: 'Cache cleared successfully'
      })
    }

    if (!key) {
      return NextResponse.json(
        { error: 'Key is required' },
        { status: 400 }
      )
    }

    const success = await unifiedCache.delete(key)

    logger.debug('Cache DELETE request', { key, deleted: success })

    return NextResponse.json({
      success,
      message: success ? 'Cache deleted successfully' : 'Key not found'
    })

  } catch (error) {
    logger.error('Cache DELETE API error', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}