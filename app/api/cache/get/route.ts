import { NextRequest, NextResponse } from 'next/server'
import { getServerCache } from '@/lib/cache/server-only'

export async function POST(request: NextRequest) {
  try {
    const { key } = await request.json()
    
    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Key is required' },
        { status: 400 }
      )
    }

    const { serverCache } = await getServerCache()
    const data = await serverCache.get(key)
    
    return NextResponse.json({
      success: true,
      data: data || null
    })
  } catch (error) {
    console.error('Cache GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}