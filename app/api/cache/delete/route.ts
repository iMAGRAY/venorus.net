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
    await serverCache.delete(key)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cache DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}