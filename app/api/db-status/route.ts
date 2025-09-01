import { NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database/db-connection'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Try a simple query to test database connection
    await executeQuery('SELECT 1')
    
    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      status: 'degraded',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 503 })
  }
}