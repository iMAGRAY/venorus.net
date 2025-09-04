import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/database/db-connection'

export async function GET(request: NextRequest) {
  try {
    // Direct test without any guards
    const pool = getPool()
    
    // Try to execute a simple query
    const result = await pool.query('SELECT NOW() as time, version() as version, current_database() as database')
    
    return NextResponse.json({
      success: true,
      connection: 'working',
      data: result.rows[0],
      poolStats: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}