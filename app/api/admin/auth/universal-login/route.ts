import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import bcrypt from 'bcrypt'

// Принудительно делаем маршрут динамическим
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

    // Попытка 1: Проверка через переменные окружения (старая система)
    const envUsername = process.env.ADMIN_USERNAME
    const envPassword = process.env.ADMIN_PASSWORD
    
    if (envUsername && envPassword && username === envUsername && password === envPassword) {
      logger.info('Authentication successful via environment variables', { username })
      
      const response = NextResponse.json({
        success: true,
        message: 'Successfully authenticated via ENV',
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

      // Устанавливаем cookie
      const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60 // 30 дней или 24 часа
      response.cookies.set('admin_session', 'env_auth_session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: cookieMaxAge,
        path: '/'
      })

      return response
    }

    // Попытка 2: Проверка через базу данных (новая система)
    try {
      const { getPool } = await import('@/lib/database/db-connection')
      const pool = getPool()

      const userResult = await pool.query(`
        SELECT
          u.id, u.username, u.email, u.first_name, u.last_name,
          u.password_hash, u.status, u.last_login, u.created_at,
          u.failed_login_attempts, u.locked_until,
          r.id as role_id, r.name as role_name, r.display_name as role_display_name,
          r.permissions as role_permissions
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.username = $1 AND u.status = 'active'
      `, [username])

      if (userResult.rows.length > 0) {
        const userData = userResult.rows[0]
        
        // Проверяем пароль
        const passwordValid = await bcrypt.compare(password, userData.password_hash)
        
        if (passwordValid) {
          logger.info('Authentication successful via database', { username, userId: userData.id })
          
          // Обновляем last_login
          await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [userData.id])
          
          const response = NextResponse.json({
            success: true,
            message: 'Successfully authenticated via DB',
            user: {
              id: userData.id,
              username: userData.username,
              email: userData.email,
              firstName: userData.first_name,
              lastName: userData.last_name,
              role: userData.role_name,
              permissions: userData.role_permissions
            },
            rememberMe: rememberMe
          })

          const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60
          response.cookies.set('admin_session', `db_auth_${userData.id}`, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: cookieMaxAge,
            path: '/'
          })

          return response
        }
      }
    } catch (dbError) {
      logger.error('Database authentication failed', dbError)
    }

    // Если ничего не сработало
    logger.warn('Authentication failed for username', { username })
    return NextResponse.json(
      { success: false, error: 'Invalid credentials' },
      { status: 401 }
    )

  } catch (error) {
    logger.error('Universal login endpoint error', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}