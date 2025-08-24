import { NextRequest, NextResponse } from 'next/server'
import { getServerCache } from '@/lib/cache/server-only'

export async function POST(request: NextRequest) {
  try {
    const { tags } = await request.json()
    
    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json(
        { success: false, error: 'Tags array is required' },
        { status: 400 }
      )
    }

    const { serverCache } = await getServerCache()
    const invalidatedCount = await serverCache.invalidateByTags(tags)
    
    return NextResponse.json({ 
      success: true, 
      invalidated: invalidatedCount 
    })
  } catch (error) {
    console.error('Cache INVALIDATE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}