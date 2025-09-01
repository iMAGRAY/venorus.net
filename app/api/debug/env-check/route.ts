import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'NOT_SET',
    ADMIN_PASSWORD_SET: !!process.env.ADMIN_PASSWORD,
    ADMIN_PASSWORD_LENGTH: process.env.ADMIN_PASSWORD?.length || 0,
    DATABASE_URL_SET: !!process.env.DATABASE_URL,
    timestamp: new Date().toISOString()
  })
}