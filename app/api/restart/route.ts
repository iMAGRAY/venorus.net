import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requireAuth, hasPermission } from '@/lib/auth/database-auth'

// КРИТИЧЕСКИ ВАЖНО: Этот endpoint отключен из соображений безопасности
// Remote Code Execution через /api/restart представляет крайнюю угрозу

export async function POST(request: NextRequest) {
  // КРИТИЧЕСКАЯ ПРОВЕРКА БЕЗОПАСНОСТИ
  const session = await requireAuth(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Только суперадмины с системными правами
  if (!hasPermission(session.user, 'system.deploy') &&
      !hasPermission(session.user, '*')) {
    return NextResponse.json({ error: 'Access denied - system deployment privileges required' }, { status: 403 })
  }

  try {
    logger.warn('🚫 RESTART ENDPOINT DISABLED FOR SECURITY')
    logger.warn(`User ${session.user.username} attempted to use disabled restart endpoint`)
    
    return NextResponse.json({
      error: 'Restart endpoint disabled for security reasons',
      message: 'Use proper CI/CD deployment instead of remote command execution',
      security_note: 'This endpoint was disabled due to Remote Code Execution vulnerability',
      timestamp: new Date().toISOString()
    }, { status: 501 })
    
  } catch (error) {
    logger.error('❌ Restart API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Restart API Endpoint',
    status: 'active',
    usage: 'POST with Authorization: Bearer <token>',
    timestamp: new Date().toISOString()
  })
}