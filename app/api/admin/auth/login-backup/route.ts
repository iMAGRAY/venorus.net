import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { username, password, rememberMe = false } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Простая проверка через переменные окружения
    const validUsername = process.env.ADMIN_USERNAME
    const validPassword = process.env.ADMIN_PASSWORD
    
    logger.info('Login attempt', { 
      username, 
      hasEnvUsername: !!validUsername, 
      hasEnvPassword: !!validPassword 
    })

    if (!validUsername || !validPassword) {
      logger.error('Admin credentials not configured')
      return NextResponse.json(
        { success: false, error: 'Authentication not configured' },
        { status: 500 }
      )
    }

    if (username === validUsername && password === validPassword) {
      logger.info('Authentication successful', { username })
      
      const response = NextResponse.json({
        success: true,
        message: 'Successfully authenticated',
        user: {
          id: 1,
          username: username,
          email: 'admin@venorus.net',
          firstName: 'Admin',
          lastName: 'User',
          role: 'super_admin',
          permissions: ['*']
        },
        rememberMe: rememberMe
      })

      const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60
      response.cookies.set('admin_session', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: cookieMaxAge,
        path: '/'
      })

      return response
    }

    logger.warn('Invalid credentials', { username })
    return NextResponse.json(
      { success: false, error: 'Invalid credentials' },
      { status: 401 }
    )

  } catch (error) {
    logger.error('Login endpoint error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}