import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser, AUTH_CONFIG } from '@/lib/auth/database-auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { username, password, rememberMe = false } = await request.json()

    // Валидация входных данных
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Получение информации о клиенте
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    logger.info('Authentication attempt', { 
      username, 
      ipAddress, 
      userAgent: userAgent.substring(0, 100) // Ограничиваем длину для логов
    })

    // Попытка аутентификации через базу данных
    const authResult = await authenticateUser(username, password, ipAddress, userAgent, rememberMe)

    if (!authResult.success) {
      logger.warn('Authentication failed', { 
        username, 
        ipAddress, 
        error: authResult.error 
      })
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      )
    }

    logger.info('Authentication successful', { 
      username, 
      userId: authResult.user?.id,
      sessionId: authResult.sessionId,
      ipAddress 
    })

    // Подготовка ответа с данными пользователя
    const response = NextResponse.json({
      success: true,
      message: 'Successfully authenticated',
      user: authResult.user,
      sessionId: authResult.sessionId,
      rememberMe: rememberMe
    })

    // Установка безопасной сессионной куки
    const cookieMaxAge = rememberMe ? AUTH_CONFIG.extendedSessionTTL / 1000 : AUTH_CONFIG.sessionTTL / 1000
    response.cookies.set(AUTH_CONFIG.sessionName, authResult.sessionId!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: cookieMaxAge,
      path: '/'
    })

    // Дополнительная кука для CSRF защиты
    if (authResult.csrfToken) {
      response.cookies.set('csrf_token', authResult.csrfToken, {
        httpOnly: false, // CSRF токен должен быть доступен для JavaScript
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: cookieMaxAge,
        path: '/'
      })
    }

    return response

  } catch (error) {
    logger.error('Login endpoint error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}