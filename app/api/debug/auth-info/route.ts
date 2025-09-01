import { NextRequest, NextResponse } from 'next/server'

export async function GET(_request: NextRequest) {
  try {
    // Проверим переменные окружения
    const adminUsername = process.env.ADMIN_USERNAME || 'not_set'
    const adminPassword = process.env.ADMIN_PASSWORD ? 'set' : 'not_set'
    const nodeEnv = process.env.NODE_ENV
    const databaseUrl = process.env.DATABASE_URL ? 'set' : 'not_set'
    
    // Проверим систему аутентификации
    let authSystemInfo
    try {
      const authModule = await import('@/lib/auth/database-auth')
      authSystemInfo = authModule.authenticateUser ? 'database-auth system loaded' : 'auth functions not found'
    } catch (e) {
      authSystemInfo = 'auth system error: ' + (e as Error).message
    }
    
    // Проверим подключение к базе данных
    let dbStatus = 'unknown'
    try {
      const { getPool } = await import('@/lib/database/db-connection')
      const pool = getPool()
      await pool.query('SELECT 1 as test')
      dbStatus = 'connected'
    } catch (e) {
      dbStatus = 'error: ' + (e as Error).message
    }
    
    return NextResponse.json({
      environment: {
        NODE_ENV: nodeEnv,
        ADMIN_USERNAME: adminUsername,
        ADMIN_PASSWORD: adminPassword,
        DATABASE_URL: databaseUrl
      },
      authSystem: authSystemInfo,
      databaseStatus: dbStatus,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    return NextResponse.json({
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}