import { NextRequest, NextResponse } from 'next/server'
import { getPool, isDatabaseAvailableSync } from '@/lib/database/db-connection'

export async function GET(request: NextRequest) {
  // Only allow in development or with secret key
  const secretKey = request.headers.get('x-debug-key')
  const isDev = process.env.NODE_ENV === 'development'
  
  if (!isDev && secretKey !== 'venorus-debug-2025') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const debug = {
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
      POSTGRESQL_HOST: process.env.POSTGRESQL_HOST ? 'SET' : 'NOT SET',
      POSTGRESQL_PORT: process.env.POSTGRESQL_PORT || 'NOT SET', 
      POSTGRESQL_USER: process.env.POSTGRESQL_USER ? 'SET' : 'NOT SET',
      POSTGRESQL_PASSWORD: process.env.POSTGRESQL_PASSWORD ? 'SET' : 'NOT SET',
      POSTGRESQL_DBNAME: process.env.POSTGRESQL_DBNAME || 'NOT SET',
      DATABASE_SSL: process.env.DATABASE_SSL || 'NOT SET',
      PGSSLMODE: process.env.PGSSLMODE || 'NOT SET',
      PGSSLROOTCERT: process.env.PGSSLROOTCERT || 'NOT SET',
      NODE_ENV: process.env.NODE_ENV || 'NOT SET'
    },
    checks: {
      isDatabaseAvailableSync: false,
      poolCreated: false,
      connectionTest: 'not tested' as string,
      serverTime: undefined as any,
      pgVersion: undefined as string | undefined
    },
    error: null
  }

  try {
    // Check sync availability
    debug.checks.isDatabaseAvailableSync = isDatabaseAvailableSync()
    
    // Try to get pool
    const pool = getPool()
    debug.checks.poolCreated = !!pool
    
    // Try actual connection
    try {
      const result = await pool.query('SELECT NOW() as time, version() as version')
      debug.checks.connectionTest = 'success'
      debug.checks.serverTime = result.rows[0].time
      debug.checks.pgVersion = result.rows[0].version
    } catch (connError) {
      debug.checks.connectionTest = 'failed'
      debug.error = connError.message
    }
    
  } catch (error) {
    debug.error = error.message
  }
  
  return NextResponse.json(debug)
}