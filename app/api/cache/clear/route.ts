import { NextRequest, NextResponse } from 'next/server'
import { getServerCache } from '@/lib/cache/server-only'

// Debounce для предотвращения множественных одновременных очисток кеша
const clearCacheDebounce = new Map<string, {
  timeout: NodeJS.Timeout
  promise: Promise<NextResponse>
}>()

export async function POST(request: NextRequest) {
  try {
    const { patterns } = await request.json()
    
    // Создаем ключ для debounce на основе IP + patterns
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown'
    const debounceKey = `${ip}-${JSON.stringify(patterns?.sort() || [])}`
    
    // Проверяем есть ли уже запущенная очистка с такими же параметрами
    if (clearCacheDebounce.has(debounceKey)) {
      const existing = clearCacheDebounce.get(debounceKey)!
      // Возвращаем результат уже запущенной операции
      return existing.promise
    }
    
    // Создаем новую операцию очистки кеша
    const clearPromise = performCacheClear(patterns)
    
    // Сохраняем в debounce карте на 2 секунды
    const timeout = setTimeout(() => {
      clearCacheDebounce.delete(debounceKey)
    }, 2000)
    
    clearCacheDebounce.set(debounceKey, {
      timeout,
      promise: clearPromise
    })
    
    return clearPromise
    
  } catch (error) {
    console.error('❌ Error in cache clear:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to clear cache' },
      { status: 500 }
    )
  }
}

async function performCacheClear(_patterns?: string[]): Promise<NextResponse> {
  try {
    // Полная очистка через новый unified cache
    const { serverCache } = await getServerCache()
    await serverCache.clear()

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully'
    })
  } catch (error) {
    console.error('❌ Error clearing cache:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to clear cache' },
      { status: 500 }
    )
  }
}