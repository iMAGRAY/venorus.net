import { NextResponse } from 'next/server'
import { executeQuery, testConnection } from '@/lib/database/db-connection'
import { getSSLStatus, clearSSLCache, getSSLConfig } from '@/lib/database/ssl-config'

export async function GET() {
  try {
    // Clear SSL cache to get fresh config
    clearSSLCache()
    
    // Get SSL status and actual config
    const sslStatus = getSSLStatus()
    const sslConfig = getSSLConfig()
    
    // Test database connection
    const isConnected = await testConnection()
    
    // Try a simple query if connected
    let queryResult = null
    if (isConnected) {
      try {
        const result = await executeQuery('SELECT NOW() as current_time, version() as pg_version')
        queryResult = result.rows[0]
      } catch (queryError) {
        queryResult = { error: queryError.message }
      }
    }
    
    // Get environment info
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      DATABASE_URL: process.env.DATABASE_URL ? 'configured' : 'not set',
      POSTGRESQL_HOST: process.env.POSTGRESQL_HOST || 'not set',
      DATABASE_SSL: process.env.DATABASE_SSL || 'not set',
      SSL_CA_CERT_PATH: process.env.SSL_CA_CERT_PATH || 'not set'
    }
    
    return NextResponse.json({
      success: isConnected,
      message: isConnected ? 'Database connection successful' : 'Database connection failed',
      ssl: sslStatus,
      environment: envInfo,
      query: queryResult,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      ssl: getSSLStatus(),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}