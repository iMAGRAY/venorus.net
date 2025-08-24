import { NextRequest, NextResponse } from 'next/server'
import { getServerCache } from '@/lib/cache/server-only'

export async function POST(request: NextRequest) {
  try {
    const { key, data, ttl, tags } = await request.json()
    
    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Key is required' },
        { status: 400 }
      )
    }

    const { serverCache } = await getServerCache()
    await serverCache.set(key, data, {
      ttl: ttl || 300000, // 5 минут по умолчанию
      tags: tags || []
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cache SET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}